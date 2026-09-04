// Poll pipeline (ADR-0004): group active subscriptions by filter fingerprint,
// fetch each fingerprint ONCE, fan out to matching subs with insert-first
// dedup, then enforce per-subscription seen_jobs TTL (ADR-0003).
import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { incCounter, setGauge } from '../../core/metrics';
import type { FeatureContext } from '../../core/feature';
import { seenJobs, subscriptions } from './schema';
import { circuitCount, fetchDetail, searchLinkedIn } from './adapter/linkedin';
import { summarizeJob } from './ai';
import { embedForJob } from './embed';
import type { FingerprintQuery, JobAiSummary, JobDetail, JobPosting } from './types';

type Sub = typeof subscriptions.$inferSelect;

function fingerprintOf(sub: Sub): { key: string; query: FingerprintQuery } {
  const query: FingerprintQuery = {
    keywords: sub.keywords ?? '',
    location: sub.location,
    geoId: sub.geoId,
    distance: sub.distance,
    filters: (sub.filters ?? {}) as Record<string, string>,
  };
  const key = createHash('sha1')
    .update(JSON.stringify([sub.source, query.keywords, query.location, query.geoId, query.distance, query.filters]))
    .digest('hex')
    .slice(0, 16);
  return { key, query };
}

async function deliverIfNew(
  ctx: FeatureContext,
  sub: Sub,
  job: JobPosting,
  details: Map<string, JobDetail | null>,
  summaries: Map<string, JobAiSummary | null>,
): Promise<boolean> {
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
  if (inserted.length === 0) return false; // already seen (covers horizontal duplicates)
  // Detail + AI enrichment per unique job (ADR-0005 correction); caches shared
  // across subscriptions so a job is fetched/summarized at most once per tick.
  // Either step failing is non-fatal: embed falls back, delivery proceeds.
  if (!details.has(job.id)) {
    const detail = await fetchDetail(job.id);
    details.set(job.id, detail);
    ctx.log.info({ feature: 'job-subscription', job: job.id, got: detail !== null }, 'detail fetched');
    if (detail?.description) {
      summaries.set(job.id, await summarizeJob(detail.description));
      ctx.log.info(
        { feature: 'job-subscription', job: job.id, summarized: summaries.get(job.id) !== null },
        'ai summary',
      );
    }
  }
  await ctx.sendMessage(
    sub.channelId,
    { embeds: [embedForJob(job, details.get(job.id), summaries.get(job.id)).toJSON()] },
  );
  incCounter('jobs_delivered_total', { source: job.source });
  return true;
}

async function enforceTtl(ctx: FeatureContext): Promise<void> {
  await ctx.db.execute(sql`
    DELETE FROM ${seenJobs} USING ${subscriptions}
    WHERE ${seenJobs.subscriptionId} = ${subscriptions.id}
      AND ${subscriptions.retentionDays} IS NOT NULL
      AND ${seenJobs.firstSeenAt} < now() - ((${subscriptions.retentionDays}::text || ' days'))::interval`);
}

export async function pollAll(ctx: FeatureContext): Promise<void> {
  const started = Date.now();
  const subs = await ctx.db.select().from(subscriptions).where(eq(subscriptions.isActive, true));
  if (subs.length === 0) {
    ctx.log.info({ feature: 'job-subscription' }, 'poll tick: no active subscriptions');
    return;
  }
  const groups = new Map<string, { query: FingerprintQuery; source: string; subs: Sub[] }>();
  for (const sub of subs) {
    const { key, query } = fingerprintOf(sub);
    const group = groups.get(key) ?? { query, source: sub.source, subs: [] };
    group.subs.push(sub);
    groups.set(key, group);
  }
  ctx.log.info({ feature: 'job-subscription', subs: subs.length, fingerprints: groups.size }, 'poll tick start');

  const details = new Map<string, JobDetail | null>();
  const summaries = new Map<string, JobAiSummary | null>();
  for (const [key, group] of groups) {
    let jobs: JobPosting[];
    try {
      jobs = await searchLinkedIn(group.query, key);
    } catch (e) {
      ctx.log.warn({ feature: 'job-subscription', fingerprint: key, err: e }, 'fingerprint fetch failed');
      continue;
    }
    for (const job of jobs) {
      for (const sub of group.subs) {
        try {
          await deliverIfNew(ctx, sub, job, details, summaries);
        } catch (e) {
          ctx.log.warn(
            { feature: 'job-subscription', sub: sub.id, job: job.id, err: e },
            'delivery failed (dedup row kept)',
          );
        }
      }
    }
  }

  await enforceTtl(ctx);
  setGauge('linkedin_circuit_open', circuitCount());
  incCounter('cron_ticks_total', { feature: 'job-subscription' });
  ctx.log.info(
    { feature: 'job-subscription', ms: Date.now() - started },
    'poll tick done',
  );
}
