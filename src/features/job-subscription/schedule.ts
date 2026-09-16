// Poll pipeline (ADR-0004): group active subscriptions by filter fingerprint,
// fetch each fingerprint ONCE, skip when the listing is unchanged since the
// last tick, else fan out to matching subs with insert-first dedup, then
// enforce per-subscription seen_jobs TTL (ADR-0003).
import { createHash } from 'node:crypto';
import { eq, lt, notInArray, sql } from 'drizzle-orm';
import { incCounter, setGauge } from '../../core/metrics';
import type { FeatureContext } from '../../core/feature';
import { botConfig, deliveryMessages, fingerprintSnapshots, seenJobs, subscriptions } from './schema';
import { recordDelivery } from './events/reply';
import { linkedinCircuitCount, pollSources, searchJobPostings } from './adapter';
import { embedsForDelivery, formatDeliveryTitle, renderJobPostingCard, type DeliveryItem } from './embed';
import type { FingerprintQuery, JobPosting } from './types';

type Subscription = typeof subscriptions.$inferSelect;

/**
 * `/jobs config poll_interval_minutes` → cron. Resolved at boot via
 * `ScheduleDef.resolveCron`. Rounds to whole hours for ≥ 60m; 1440m maps to a
 * daily midnight job instead of an out-of-range hourly cron.
 */
export async function pollCron(ctx: FeatureContext): Promise<string> {
  const [row] = await ctx.db.select().from(botConfig).where(eq(botConfig.id, 1));
  const minutes = row?.pollIntervalMinutes ?? 30;
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    if (hours >= 24) return '0 0 * * *';
    return `0 */${Math.max(1, hours)} * * * *`;
  }
  return `*/${Math.min(59, Math.max(1, minutes))} * * * *`;
}

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

type FingerprintSnapshot = typeof fingerprintSnapshots.$inferSelect;

/**
 * Order-insensitive identity of one fetched listing: sorted `source:id`
 * pairs. Same ids → same dedup/delivery outcome, so a tick whose hash
 * matches the stored snapshot can skip the per-subscription collect.
 */
export function listingHashFor(jobs: JobPosting[]): string {
  const ids = jobs.map((job) => `${job.source}:${job.id}`).sort();
  return createHash('sha1').update(JSON.stringify(ids)).digest('hex');
}

function sameIds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Skip conditions for one fingerprint group on a full cron tick: the listing
 * is identical to last tick (same ids), the group membership is unchanged (a
 * new/reactivated sub must still receive the current listing on its first
 * tick), and the snapshot is fresher than the group's tightest seen_jobs TTL
 * (so a long outage still re-delivers after retention expiry, as before).
 */
export function shouldSkipGroup(
  snapshot: FingerprintSnapshot | undefined,
  listingHash: string,
  subIds: number[],
  minRetentionDays: number,
  now = Date.now(),
): boolean {
  if (!snapshot) return false;
  if (snapshot.listingHash !== listingHash) return false;
  const stored = [...(snapshot.subscriptionIds ?? [])].sort((x, y) => x - y);
  if (!sameIds(stored, subIds)) return false;
  const ttlMs = Math.max(1, minRetentionDays) * 24 * 60 * 60 * 1000;
  return now - snapshot.updatedAt.getTime() < ttlMs;
}

/** Snapshot reads never block a tick: on failure the group is processed. */
async function readSnapshot(
  ctx: FeatureContext,
  fingerprint: string,
): Promise<FingerprintSnapshot | undefined> {
  try {
    const [row] = await ctx.db
      .select()
      .from(fingerprintSnapshots)
      .where(eq(fingerprintSnapshots.fingerprint, fingerprint));
    return row;
  } catch (e) {
    ctx.log.warn(
      { feature: 'job-subscription', fingerprint, err: e },
      'snapshot read failed (processing anyway)',
    );
    return undefined;
  }
}

async function storeSnapshot(
  ctx: FeatureContext,
  fingerprint: string,
  source: string,
  listingHash: string,
  jobCount: number,
  subIds: number[],
): Promise<void> {
  try {
    await ctx.db
      .insert(fingerprintSnapshots)
      .values({ fingerprint, source, listingHash, jobCount, subscriptionIds: subIds })
      .onConflictDoUpdate({
        target: fingerprintSnapshots.fingerprint,
        set: {
          source,
          listingHash,
          jobCount,
          subscriptionIds: subIds,
          updatedAt: new Date(),
        },
      });
  } catch (e) {
    ctx.log.warn(
      { feature: 'job-subscription', fingerprint, err: e },
      'snapshot store failed (next tick reprocesses)',
    );
  }
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
  fingerprintsSkipped: number;
  durationMs: number;
};

export async function pollSubscriptions(
  ctx: FeatureContext,
  targetSubs?: Subscription[],
): Promise<PollResult> {
  const started = Date.now();
  // Manual /jobs fetch passes a channel subset: it always processes fresh and
  // never reads/writes snapshots, so a subset tick can't poison the stored
  // membership the full cron tick compares against.
  const isFullTick = targetSubs === undefined;
  const subs =
    targetSubs ??
    (await ctx.db.select().from(subscriptions).where(eq(subscriptions.isActive, true)));

  if (subs.length === 0) {
    ctx.log.info({ feature: 'job-subscription' }, 'poll tick: no active subscriptions');
    return {
      subscriptionsCount: 0,
      newJobsDelivered: 0,
      fingerprintsSkipped: 0,
      durationMs: Date.now() - started,
    };
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
  let fingerprintsSkipped = 0;
  for (const [key, group] of groups) {
    let jobs: JobPosting[];
    try {
      jobs = await searchJobPostings(group.source, group.query, key);
    } catch (e) {
      ctx.log.warn({ feature: 'job-subscription', source: group.source, fingerprint: key, err: e }, 'fingerprint fetch failed');
      continue;
    }
    const subIds = group.subs.map((sub) => sub.id).sort((a, b) => a - b);
    const listingHash = listingHashFor(jobs);
    if (isFullTick) {
      const snapshot = await readSnapshot(ctx, key);
      const minRetention = Math.min(...group.subs.map((sub) => sub.retentionDays ?? 30));
      if (shouldSkipGroup(snapshot, listingHash, subIds, minRetention)) {
        fingerprintsSkipped += 1;
        incCounter('fingerprint_skipped_total', { source: group.source });
        ctx.log.info(
          { feature: 'job-subscription', fingerprint: key, jobs: jobs.length },
          'poll tick: listing unchanged since last tick (skipped)',
        );
        continue;
      }
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
    if (isFullTick) {
      await storeSnapshot(ctx, key, group.source, listingHash, jobs.length, subIds);
    }
  }

  // Drop snapshots for filters with no active subscription left behind.
  if (isFullTick && groups.size > 0) {
    try {
      await ctx.db
        .delete(fingerprintSnapshots)
        .where(notInArray(fingerprintSnapshots.fingerprint, [...groups.keys()]));
    } catch (e) {
      ctx.log.warn({ feature: 'job-subscription', err: e }, 'snapshot prune failed (harmless)');
    }
  }

  await enforceTtl(ctx);
  setGauge('linkedin_circuit_open', linkedinCircuitCount());
  incCounter('cron_ticks_total', { feature: 'job-subscription' });
  const durationMs = Date.now() - started;
  ctx.log.info(
    {
      feature: 'job-subscription',
      ms: durationMs,
      delivered: newJobsDelivered,
      skipped: fingerprintsSkipped,
    },
    'poll tick done',
  );

  return {
    subscriptionsCount: subs.length,
    newJobsDelivered,
    fingerprintsSkipped,
    durationMs,
  };
}

export async function pollAll(ctx: FeatureContext): Promise<void> {
  await pollSubscriptions(ctx);
}
