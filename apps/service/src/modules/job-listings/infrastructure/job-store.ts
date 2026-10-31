// Shared posting rows + enrichment cache for the jobs/seen_jobs split.
// `jobs` holds one row per real posting (deduped across subscriptions and
// keywords) with the cached AI summary; `seen_jobs` stays per-subscription
// with the personal match score. Cache writes never throw — enrichment must
// never break delivery or card rendering.

import { jobs, seenJobs, subscriptions } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, eq, or } from "drizzle-orm";

import type { Logger } from "../../../core/logger";
import type { JobMatch, JobPosting } from "../domain/posting";
import { dmScopeKey } from "../domain/subscription";

export const jobKey = (source: string, externalId: string): string =>
  `${source}:${externalId}`;

/**
 * Ensure one jobs row per posting in a fetched listing; returns the id by
 * `jobKey`. First sighting wins the listing fields. Throws on failure — the
 * caller falls back to null jobIds so delivery is never blocked.
 */
export const ensureJobIds = async (
  db: Database,
  listing: JobPosting[]
): Promise<Map<string, number>> => {
  const unique = new Map(
    listing.map((job) => [jobKey(job.source, job.id), job])
  );
  if (unique.size === 0) {
    return new Map();
  }
  await db
    .insert(jobs)
    .values(
      [...unique.values()].map((job) => ({
        company: job.company,
        externalId: job.id,
        location: job.location,
        source: job.source,
        title: job.position,
        url: job.url,
      }))
    )
    .onConflictDoNothing({ target: [jobs.source, jobs.externalId] });
  const rows = await db
    .select({ externalId: jobs.externalId, id: jobs.id, source: jobs.source })
    .from(jobs)
    .where(
      or(
        ...[...unique.values()].map((job) =>
          and(eq(jobs.source, job.source), eq(jobs.externalId, job.id))
        )
      )
    );
  return new Map(
    rows.map((row) => [jobKey(row.source, row.externalId), row.id])
  );
};

/** Cached AI summary for one posting; null when absent or on any failure. */
export const readCachedSummary = async (
  db: Database,
  source: string,
  externalId: string
): Promise<string | null> => {
  try {
    const [row] = await db
      .select({ aiSummary: jobs.aiSummary })
      .from(jobs)
      .where(and(eq(jobs.source, source), eq(jobs.externalId, externalId)));
    return row?.aiSummary ?? null;
  } catch {
    return null;
  }
};

/** Upsert the cached summary (self-heals when the collect-time insert failed). */
export const storeCachedSummary = async (
  log: Logger,
  db: Database,
  job: JobPosting,
  summary: string
): Promise<void> => {
  try {
    await db
      .insert(jobs)
      .values({
        aiSummary: summary,
        company: job.company,
        externalId: job.id,
        location: job.location,
        source: job.source,
        title: job.position,
        updatedAt: new Date(),
        url: job.url,
      })
      .onConflictDoUpdate({
        set: { aiSummary: summary, updatedAt: new Date() },
        target: [jobs.source, jobs.externalId],
      });
  } catch (error) {
    log.warn(
      { err: error, job: job.id, module: "job-listings" },
      "summary cache store failed"
    );
  }
};

/** Persist one DM card's match score on its seen_jobs row. */
export const storeMatchScore = async (
  log: Logger,
  db: Database,
  seenId: number,
  match: JobMatch
): Promise<void> => {
  try {
    await db
      .update(seenJobs)
      .set({
        matchBreakdown: match.factors,
        matchReason: match.reason,
        matchScore: match.score,
      })
      .where(eq(seenJobs.id, seenId));
  } catch (error) {
    log.warn(
      { err: error, module: "job-listings", seen: seenId },
      "match store failed"
    );
  }
};

/**
 * Persist a DM reply's match score: every matching row in the replier's own
 * DM channel shares their CV, so one score fits all of them.
 */
export const storeMatchScoreForChannelDelivery = async (
  log: Logger,
  db: Database,
  args: {
    channelId: string;
    userId: string;
    source: string;
    externalId: string;
    match: JobMatch;
  }
): Promise<void> => {
  try {
    const rows = await db
      .select({ id: seenJobs.id })
      .from(seenJobs)
      .innerJoin(subscriptions, eq(seenJobs.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.channelId, args.channelId),
          eq(subscriptions.guildId, dmScopeKey(args.userId)),
          eq(seenJobs.source, args.source),
          eq(seenJobs.externalId, args.externalId)
        )
      );
    for (const row of rows) {
      // Keep score writes ordered; a failed write must prevent later writes as before.
      // oxlint-disable-next-line no-await-in-loop
      await db
        .update(seenJobs)
        .set({
          matchBreakdown: args.match.factors,
          matchReason: args.match.reason,
          matchScore: args.match.score,
        })
        .where(eq(seenJobs.id, row.id));
    }
  } catch (error) {
    log.warn(
      { channel: args.channelId, err: error, module: "job-listings" },
      "match store failed"
    );
  }
};
