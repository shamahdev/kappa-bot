// Poll pipeline (ADR-0004): group active subscriptions by filter fingerprint,
// fetch each fingerprint ONCE, fan out to matching subs with insert-first
// dedup, then enforce per-subscription seen_jobs TTL (ADR-0003).
import { createHash } from 'node:crypto';
import { eq, lt, sql } from 'drizzle-orm';
import { incCounter, setGauge } from '../../core/metrics';
import type { FeatureContext } from '../../core/feature';
import { deliveryMessages, seenJobs, subscriptions } from './schema';
import { recordDelivery } from './events/reply';
import { circuitCount, pollSources, searchJobPostings } from './adapter';
import { embedsForDelivery, formatDeliveryTitle, renderJobPostingCard, type DeliveryItem } from './embed';
import type { FingerprintQuery, JobPosting } from './types';

type Subscription = typeof subscriptions.$inferSelect;

function fingerprintOf(sub: Subscription, sourceOverride?: string): { key: string; query: FingerprintQuery } {
  const source = sourceOverride ?? sub.source;
  const query: FingerprintQuery = {
    keywords: sub.keywords ?? '',
    location: sub.location,
    geoId: sub.geoId,
    distance: sub.distance,
    filters: (sub.filters ?? {}) as Record<string, string>,
  };
  const key = createHash('sha1')
    .update(JSON.stringify([source, query.keywords, query.location, query.geoId, query.distance, query.filters]))
    .digest('hex')
    .slice(0, 16);
  return { key, query };
}

/**
 * Claim-first collection: insert the seen row (dedup, covers horizontal
 * duplicates). Does NOT fetch detail during collection to keep polling fast.
 */
async function collectIfNew(
  ctx: FeatureContext,
  sub: Subscription,
  job: JobPosting,
): Promise<DeliveryItem | null> {
  const inserted = await ctx.db
    .insert(seenJobs)
    .values({
      subscriptionId: sub.id,
      source: job.source,
      externalId: job.id,
      url: job.url,
      snapshot: { title: job.position, company: job.company, location: job.location },
    })
    .onConflictDoNothing()
    .returning({ id: seenJobs.id });
  if (inserted.length === 0) return null; // already seen (covers horizontal duplicates)
  return { job };
}

function deliveryHeader(sub: Subscription, count: number, itemSource?: string): string {
  return formatDeliveryTitle(count, sub.keywords, itemSource ?? sub.source);
}

/**
 * One delivery per subscription per tick:
 * - When items.length === 1: fetch detail to enrich description/salary and render rich card.
 * - When items.length > 1: deliver numbered-list embeds without fetching details.
 */
export async function flushSub(
  ctx: FeatureContext,
  sub: Subscription,
  items: DeliveryItem[],
): Promise<number> {
  if (items.length === 0) return 0;
  try {
    const keyword = sub.keywords;
    if (items.length === 1) {
      const job = items[0]!.job;
      const card = await renderJobPostingCard(ctx.log, job, keyword);
      await ctx.deliverMessage(sub.channelId, { embeds: [card.toJSON()] });
      incCounter('jobs_delivered_total', { source: job.source });
      ctx.log.info({ feature: 'job-subscription', sub: sub.id, single: true }, 'delivered single');
      return 1;
    }
    const source = items[0]?.job?.source ?? sub.source;
    const title = deliveryHeader(sub, items.length, source);

    const embeds = embedsForDelivery(title, items, keyword).map((e) => e.toJSON());
    const sent = await ctx.deliverMessage(sub.channelId, { embeds });
    if (sent?.messageId) await recordDelivery(ctx, sub.channelId, sent.messageId, items, keyword);
    for (const item of items) incCounter('jobs_delivered_total', { source: item.job.source });
    ctx.log.info(
      { feature: 'job-subscription', sub: sub.id, count: items.length, list: true },
      'delivered list',
    );
    return items.length;
  } catch (e) {
    ctx.log.warn(
      { feature: 'job-subscription', sub: sub.id, count: items.length, err: e },
      'delivery failed (dedup rows kept)',
    );
    return 0;
  }
}

async function enforceTtl(ctx: FeatureContext): Promise<void> {
  await ctx.db.execute(sql`
    DELETE FROM ${seenJobs} USING ${subscriptions}
    WHERE ${seenJobs.subscriptionId} = ${subscriptions.id}
      AND ${subscriptions.retentionDays} IS NOT NULL
      AND ${seenJobs.firstSeenAt} < now() - ((${subscriptions.retentionDays}::text || ' days'))::interval`);
  // Reply-by-number recall window for old deliveries (30d, fixed).
  await ctx.db
    .delete(deliveryMessages)
    .where(lt(deliveryMessages.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
}

export type PollResult = {
  subscriptionsCount: number;
  newJobsDelivered: number;
  durationMs: number;
};

export async function pollSubscriptions(
  ctx: FeatureContext,
  targetSubs?: Subscription[],
): Promise<PollResult> {
  const started = Date.now();
  const subs =
    targetSubs ??
    (await ctx.db.select().from(subscriptions).where(eq(subscriptions.isActive, true)));

  if (subs.length === 0) {
    ctx.log.info({ feature: 'job-subscription' }, 'poll tick: no active subscriptions');
    return { subscriptionsCount: 0, newJobsDelivered: 0, durationMs: Date.now() - started };
  }

  const groups = new Map<string, { query: FingerprintQuery; source: string; subs: Subscription[] }>();
  for (const sub of subs) {
    const sourcesToPoll = sub.source === 'all' ? pollSources() : [sub.source];
    for (const src of sourcesToPoll) {
      const { key, query } = fingerprintOf(sub, src);
      const group = groups.get(key) ?? { query, source: src, subs: [] };
      group.subs.push(sub);
      groups.set(key, group);
    }
  }
  ctx.log.info({ feature: 'job-subscription', subs: subs.length, fingerprints: groups.size }, 'poll tick start');

  let newJobsDelivered = 0;
  for (const [key, group] of groups) {
    let jobs: JobPosting[];
    try {
      jobs = await searchJobPostings(group.source, group.query, key);
    } catch (e) {
      ctx.log.warn({ feature: 'job-subscription', source: group.source, fingerprint: key, err: e }, 'fingerprint fetch failed');
      continue;
    }
    const pending = new Map<number, DeliveryItem[]>();
    for (const job of jobs) {
      for (const sub of group.subs) {
        try {
          const item = await collectIfNew(ctx, sub, job);
          if (!item) continue;
          const list = pending.get(sub.id);
          if (list) list.push(item);
          else pending.set(sub.id, [item]);
        } catch (e) {
          ctx.log.warn(
            { feature: 'job-subscription', sub: sub.id, job: job.id, err: e },
            'collect failed (skipped)',
          );
        }
      }
    }
    for (const sub of group.subs) {
      const items = pending.get(sub.id);
      if (items && items.length > 0) {
        newJobsDelivered += await flushSub(ctx, sub, items);
      }
    }
  }

  await enforceTtl(ctx);
  setGauge('linkedin_circuit_open', circuitCount());
  incCounter('cron_ticks_total', { feature: 'job-subscription' });
  const durationMs = Date.now() - started;
  ctx.log.info(
    { feature: 'job-subscription', ms: durationMs, delivered: newJobsDelivered },
    'poll tick done',
  );

  return {
    subscriptionsCount: subs.length,
    newJobsDelivered,
    durationMs,
  };
}

export async function pollAll(ctx: FeatureContext): Promise<void> {
  await pollSubscriptions(ctx);
}
