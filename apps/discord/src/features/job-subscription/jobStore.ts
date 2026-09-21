// Shared posting rows + enrichment cache for the jobs/seen_jobs split.
// `jobs` holds one row per real posting (deduped across subscriptions and
// keywords) with the cached AI summary; `seen_jobs` stays per-subscription
// with the personal match score. Cache writes never throw — enrichment must
// never break delivery or card rendering.
import { and, eq, or } from 'drizzle-orm';
import { jobs, seenJobs, subscriptions } from '@kappa/db';
import type { GatewayDb } from '../../core/feature';
import type { Logger } from '../../core/logger';
import type { JobMatch } from './ai';
import type { JobPosting } from './types';

export function jobKey(source: string, externalId: string): string {
  return `${source}:${externalId}`;
}

/**
 * Ensure one jobs row per posting in a fetched listing; returns the id by
 * `jobKey`. First sighting wins the listing fields. Throws on failure — the
 * caller falls back to null jobIds so delivery is never blocked.
 */
export async function ensureJobIds(
  db: GatewayDb,
  listing: JobPosting[],
): Promise<Map<string, number>> {
  const unique = new Map(listing.map((job) => [jobKey(job.source, job.id), job]));
  if (unique.size === 0) return new Map();
  await db
    .insert(jobs)
    .values(
      [...unique.values()].map((job) => ({
        source: job.source,
        externalId: job.id,
        url: job.url,
        title: job.position,
        company: job.company,
        location: job.location,
      })),
    )
    .onConflictDoNothing({ target: [jobs.source, jobs.externalId] });
  const rows = await db
    .select({ id: jobs.id, source: jobs.source, externalId: jobs.externalId })
    .from(jobs)
    .where(
      or(
        ...[...unique.values()].map((job) =>
          and(eq(jobs.source, job.source), eq(jobs.externalId, job.id)),
        ),
      ),
    );
  return new Map(rows.map((row) => [jobKey(row.source, row.externalId), row.id]));
}

/** Cached AI summary for one posting; null when absent or on any failure. */
export async function readCachedSummary(
  db: GatewayDb,
  source: string,
  externalId: string,
): Promise<string | null> {
  try {
    const [row] = await db
      .select({ aiSummary: jobs.aiSummary })
      .from(jobs)
      .where(and(eq(jobs.source, source), eq(jobs.externalId, externalId)));
    return row?.aiSummary ?? null;
  } catch {
    return null;
  }
}

/** Upsert the cached summary (self-heals when the collect-time insert failed). */
export async function storeCachedSummary(
  log: Logger,
  db: GatewayDb,
  job: JobPosting,
  summary: string,
): Promise<void> {
  try {
    await db
      .insert(jobs)
      .values({
        source: job.source,
        externalId: job.id,
        url: job.url,
        title: job.position,
        company: job.company,
        location: job.location,
        aiSummary: summary,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [jobs.source, jobs.externalId],
        set: { aiSummary: summary, updatedAt: new Date() },
      });
  } catch (e) {
    log.warn({ feature: 'job-subscription', job: job.id, err: e }, 'summary cache store failed');
  }
}

/** Persist one DM card's match score on its seen_jobs row. */
export async function storeMatchScore(
  log: Logger,
  db: GatewayDb,
  seenId: number,
  match: JobMatch,
): Promise<void> {
  try {
    await db
      .update(seenJobs)
      .set({ matchScore: match.score, matchReason: match.reason })
      .where(eq(seenJobs.id, seenId));
  } catch (e) {
    log.warn({ feature: 'job-subscription', seen: seenId, err: e }, 'match store failed');
  }
}

/**
 * Persist a DM reply's match score: every matching row in the replier's own
 * DM channel shares their CV, so one score fits all of them.
 */
export async function storeMatchScoreForChannelDelivery(
  log: Logger,
  db: GatewayDb,
  args: {
    channelId: string;
    userId: string;
    source: string;
    externalId: string;
    match: JobMatch;
  },
): Promise<void> {
  try {
    const rows = await db
      .select({ id: seenJobs.id })
      .from(seenJobs)
      .innerJoin(subscriptions, eq(seenJobs.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.channelId, args.channelId),
          eq(subscriptions.guildId, `dm:${args.userId}`),
          eq(seenJobs.source, args.source),
          eq(seenJobs.externalId, args.externalId),
        ),
      );
    for (const row of rows) {
      await db
        .update(seenJobs)
        .set({ matchScore: args.match.score, matchReason: args.match.reason })
        .where(eq(seenJobs.id, row.id));
    }
  } catch (e) {
    log.warn({ feature: 'job-subscription', channel: args.channelId, err: e }, 'match store failed');
  }
}
