import { createHash } from "node:crypto";

import {
  deliveryMessages,
  fingerprintSnapshots,
  jobs as jobRows,
  seenJobs,
  subscriptions,
} from "@kappa/db";
import { eq, lt, notExists, notInArray, sql } from "drizzle-orm";

import { incCounter, setGauge } from "../../../core/metrics";
import type { FingerprintQuery, JobPosting } from "../domain/posting";
import {
  ensureJobIds,
  jobKey,
  storeMatchScore,
} from "../infrastructure/job-store";
import {
  linkedinCircuitCount,
  pollSources,
  searchJobPostings,
} from "../infrastructure/sources";
import type { JobPollingContext } from "./ports";

interface DeliveryItem {
  job: JobPosting;
  seenId: number;
}

type Subscription = typeof subscriptions.$inferSelect;

const fingerprintOf = (
  sub: Subscription,
  sourceOverride?: string
): { key: string; query: FingerprintQuery } => {
  const source = sourceOverride ?? sub.source;
  const query: FingerprintQuery = {
    distance: sub.distance,
    filters: (sub.filters ?? {}) as Record<string, string>,
    geoId: sub.geoId,
    keywords: sub.keywords ?? "",
    location: sub.location,
  };
  const key = createHash("sha1")
    .update(
      JSON.stringify([
        source,
        query.keywords,
        query.location,
        query.geoId,
        query.distance,
        query.filters,
      ])
    )
    .digest("hex")
    .slice(0, 16);
  return { key, query };
};

/**
 * Claim-first collection: insert the seen row (dedup, covers horizontal
 * duplicates). Does NOT fetch detail during collection to keep polling fast.
 */
const collectIfNew = async (
  ctx: JobPollingContext,
  sub: Subscription,
  job: JobPosting,
  jobId: number | null
): Promise<DeliveryItem | null> => {
  const inserted = await ctx.db
    .insert(seenJobs)
    .values({
      externalId: job.id,
      jobId,
      snapshot: {
        company: job.company,
        location: job.location,
        title: job.position,
      },
      source: job.source,
      subscriptionId: sub.id,
      url: job.url,
    })
    .onConflictDoNothing()
    .returning({ id: seenJobs.id });
  const [row] = inserted;
  if (!row) {
    // Already seen (covers horizontal duplicates).
    return null;
  }
  return { job, seenId: row.id };
};

type FingerprintSnapshot = typeof fingerprintSnapshots.$inferSelect;

/**
 * Order-insensitive identity of one fetched listing: sorted `source:id`
 * pairs. Same ids → same dedup/delivery outcome, so a tick whose hash
 * matches the stored snapshot can skip the per-subscription collect.
 */
export const listingHashFor = (jobs: JobPosting[]): string => {
  const ids = jobs.map((job) => `${job.source}:${job.id}`).toSorted();
  return createHash("sha1").update(JSON.stringify(ids)).digest("hex");
};

const sameIds = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Skip conditions for one fingerprint group on a full cron tick: the listing
 * is identical to last tick (same ids), the group membership is unchanged (a
 * new/reactivated sub must still receive the current listing on its first
 * tick), and the snapshot is fresher than the group's tightest seen_jobs TTL
 * (so a long outage still re-delivers after retention expiry, as before).
 */
export const shouldSkipGroup = (
  snapshot: FingerprintSnapshot | undefined,
  listingHash: string,
  subIds: number[],
  minRetentionDays: number,
  now = Date.now()
): boolean => {
  if (!snapshot) {
    return false;
  }
  if (snapshot.listingHash !== listingHash) {
    return false;
  }
  const stored = (snapshot.subscriptionIds ?? []).toSorted((x, y) => x - y);
  if (!sameIds(stored, subIds)) {
    return false;
  }
  const ttlMs = Math.max(1, minRetentionDays) * 24 * 60 * 60 * 1000;
  return now - snapshot.updatedAt.getTime() < ttlMs;
};

/** Snapshot reads never block a tick: on failure the group is processed. */
const readSnapshot = async (
  ctx: JobPollingContext,
  fingerprint: string
): Promise<FingerprintSnapshot | undefined> => {
  try {
    const [row] = await ctx.db
      .select()
      .from(fingerprintSnapshots)
      .where(eq(fingerprintSnapshots.fingerprint, fingerprint));
    return row;
  } catch (error) {
    ctx.log.warn(
      { err: error, fingerprint, module: "job-listings" },
      "snapshot read failed (processing anyway)"
    );
    return undefined;
  }
};

const storeSnapshot = async (
  ctx: JobPollingContext,
  fingerprint: string,
  source: string,
  listingHash: string,
  jobCount: number,
  subIds: number[]
): Promise<void> => {
  try {
    await ctx.db
      .insert(fingerprintSnapshots)
      .values({
        fingerprint,
        jobCount,
        listingHash,
        source,
        subscriptionIds: subIds,
      })
      .onConflictDoUpdate({
        set: {
          jobCount,
          listingHash,
          source,
          subscriptionIds: subIds,
          updatedAt: new Date(),
        },
        target: fingerprintSnapshots.fingerprint,
      });
  } catch (error) {
    ctx.log.warn(
      { err: error, fingerprint, module: "job-listings" },
      "snapshot store failed (next tick reprocesses)"
    );
  }
};

/**
 * One delivery per subscription per tick:
 * - When items.length === 1: fetch detail to enrich description/salary and render rich card.
 * - When items.length > 1: deliver numbered-list embeds without fetching details.
 */
export const flushSub = async (
  ctx: JobPollingContext,
  sub: Subscription,
  items: DeliveryItem[]
): Promise<number> => {
  if (items.length === 0) {
    return 0;
  }
  let delivered = 0;
  try {
    const keyword = sub.keywords;
    const [first] = items;
    if (items.length === 1 && first) {
      const { job } = first;
      // Personal-only: DM subs resolve the owner's CV; guild subs get none.
      // (Multi-item lists skip scoring — the reply-by-number card scores.)
      const cvText = await ctx.cv.textForScope(sub.guildId);
      const posting = await ctx.enrichment.enrich(job, cvText);
      await ctx.notifications.card(sub.channelId, posting, keyword);
      delivered = 1;
      await ctx.reports?.recordDelivered(sub.id, [
        { job, seenId: first.seenId },
      ]);
      const { match } = posting;
      const seenId = items[0]?.seenId;
      if (match && seenId !== undefined) {
        await storeMatchScore(ctx.log, ctx.db, seenId, match);
      }
      incCounter("jobs_delivered_total", { source: job.source });
      ctx.log.info(
        { module: "job-listings", single: true, sub: sub.id },
        "delivered single"
      );
      return 1;
    }
    for await (const sent of ctx.notifications.batch(
      sub.channelId,
      items.map((item) => item.job),
      keyword
    )) {
      delivered += sent.jobs.length;
      const deliveredItems = sent.jobs.flatMap((job) => {
        const item = items.find(
          (candidate) =>
            candidate.job.id === job.id && candidate.job.source === job.source
        );
        return item ? [item] : [];
      });
      await ctx.reports?.recordDelivered(sub.id, deliveredItems);
      if (sent.messageId) {
        await ctx.recall.record(
          sub.channelId,
          sent.messageId,
          sent.jobs,
          keyword
        );
      }
      for (const job of sent.jobs) {
        incCounter("jobs_delivered_total", { source: job.source });
      }
    }
    ctx.log.info(
      { count: delivered, list: true, module: "job-listings", sub: sub.id },
      "delivered list"
    );
    return delivered;
  } catch (error) {
    ctx.log.warn(
      {
        count: items.length,
        delivered,
        err: error,
        module: "job-listings",
        sub: sub.id,
      },
      "delivery failed (dedup rows kept)"
    );
    return delivered;
  }
};

const enforceTtl = async (ctx: JobPollingContext): Promise<void> => {
  await ctx.db.execute(sql`
  DELETE FROM ${seenJobs} USING ${subscriptions}
  WHERE ${seenJobs.subscriptionId} = ${subscriptions.id}
    AND ${subscriptions.retentionDays} IS NOT NULL
    AND ${seenJobs.firstSeenAt} < now() - ((${subscriptions.retentionDays}::text || ' days'))::interval`);
  // Reply-by-number recall window for old deliveries (30d, fixed).
  await ctx.db
    .delete(deliveryMessages)
    .where(
      lt(
        deliveryMessages.createdAt,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      )
    );
  // Drop shared posting rows no delivery references anymore.
  await ctx.db
    .delete(jobRows)
    .where(
      notExists(
        ctx.db
          .select({ id: seenJobs.id })
          .from(seenJobs)
          .where(eq(seenJobs.jobId, jobRows.id))
      )
    );
};

const collectPending = async (
  ctx: JobPollingContext,
  jobs: JobPosting[],
  subs: Subscription[],
  jobIds: Map<string, number>
): Promise<Map<number, DeliveryItem[]>> => {
  const pending = new Map<number, DeliveryItem[]>();
  for (const job of jobs) {
    const jobId = jobIds.get(jobKey(job.source, job.id)) ?? null;
    for (const sub of subs) {
      try {
        // Claim rows in posting/subscription order before any delivery begins.
        // oxlint-disable-next-line no-await-in-loop
        const item = await collectIfNew(ctx, sub, job, jobId);
        if (!item) {
          continue;
        }
        const list = pending.get(sub.id);
        if (list) {
          list.push(item);
        } else {
          pending.set(sub.id, [item]);
        }
      } catch (error) {
        ctx.log.warn(
          { err: error, job: job.id, module: "job-listings", sub: sub.id },
          "collect failed (skipped)"
        );
      }
    }
  }
  return pending;
};

export interface PollResult {
  subscriptionsCount: number;
  newJobsDelivered: number;
  fingerprintsSkipped: number;
  durationMs: number;
}

const processReports = (ctx: JobPollingContext): Promise<void> =>
  ctx.reports?.processPending() ?? Promise.resolve();

export const pollSubscriptions = async (
  ctx: JobPollingContext,
  targetSubs?: Subscription[]
): Promise<PollResult> => {
  const started = Date.now();
  // Manual /jobs fetch passes a channel subset: it always processes fresh and
  // never reads/writes snapshots, so a subset tick can't poison the stored
  // membership the full cron tick compares against.
  const isFullTick = targetSubs === undefined;
  const subs =
    targetSubs ??
    (await ctx.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.isActive, true)));

  if (subs.length === 0) {
    await processReports(ctx);
    ctx.log.info(
      { module: "job-listings" },
      "poll tick: no active subscriptions"
    );
    return {
      durationMs: Date.now() - started,
      fingerprintsSkipped: 0,
      newJobsDelivered: 0,
      subscriptionsCount: 0,
    };
  }

  const groups = new Map<
    string,
    { query: FingerprintQuery; source: string; subs: Subscription[] }
  >();
  for (const sub of subs) {
    const sourcesToPoll = sub.source === "all" ? pollSources() : [sub.source];
    for (const src of sourcesToPoll) {
      const { key, query } = fingerprintOf(sub, src);
      const group = groups.get(key) ?? { query, source: src, subs: [] };
      group.subs.push(sub);
      groups.set(key, group);
    }
  }
  ctx.log.info(
    { fingerprints: groups.size, module: "job-listings", subs: subs.length },
    "poll tick start"
  );

  let newJobsDelivered = 0;
  let fingerprintsSkipped = 0;
  for (const [key, group] of groups) {
    let jobs: JobPosting[];
    try {
      // Fingerprints share external sources; preserve serial polling and rate limiting.
      // oxlint-disable-next-line no-await-in-loop
      jobs = await searchJobPostings(group.source, group.query, key);
    } catch (error) {
      ctx.log.warn(
        {
          err: error,
          fingerprint: key,
          module: "job-listings",
          source: group.source,
        },
        "fingerprint fetch failed"
      );
      continue;
    }
    const subIds = group.subs.map((sub) => sub.id).toSorted((a, b) => a - b);
    const listingHash = listingHashFor(jobs);
    if (isFullTick) {
      // Read this fingerprint's snapshot before deciding whether to collect or deliver.
      // oxlint-disable-next-line no-await-in-loop
      const snapshot = await readSnapshot(ctx, key);
      const minRetention = Math.min(
        ...group.subs.map((sub) => sub.retentionDays ?? 14)
      );
      if (shouldSkipGroup(snapshot, listingHash, subIds, minRetention)) {
        fingerprintsSkipped += 1;
        incCounter("fingerprint_skipped_total", { source: group.source });
        ctx.log.info(
          { fingerprint: key, jobs: jobs.length, module: "job-listings" },
          "poll tick: listing unchanged since last tick (skipped)"
        );
        continue;
      }
    }
    // One shared jobs row per posting; failures fall back to null jobIds.
    let jobIds = new Map<string, number>();
    try {
      // Complete this fingerprint's shared-row writes before claim-first collection.
      // oxlint-disable-next-line no-await-in-loop
      jobIds = await ensureJobIds(ctx.db, jobs);
    } catch (error) {
      ctx.log.warn(
        {
          err: error,
          fingerprint: key,
          module: "job-listings",
          source: group.source,
        },
        "jobs upsert failed (collecting without links)"
      );
    }
    // Finish all claims for this fingerprint before delivering in subscription order.
    // oxlint-disable-next-line no-await-in-loop
    const pending = await collectPending(ctx, jobs, group.subs, jobIds);
    for (const sub of group.subs) {
      const items = pending.get(sub.id);
      if (items && items.length > 0) {
        // Deliver subscriptions serially, retaining transport and recall ordering.
        // oxlint-disable-next-line no-await-in-loop
        newJobsDelivered += await flushSub(ctx, sub, items);
      }
    }
    if (isFullTick) {
      // Snapshot only after this fingerprint's deliveries, before starting the next group.
      // oxlint-disable-next-line no-await-in-loop
      await storeSnapshot(
        ctx,
        key,
        group.source,
        listingHash,
        jobs.length,
        subIds
      );
    }
  }

  // Drop snapshots for filters with no active subscription left behind.
  if (isFullTick && groups.size > 0) {
    try {
      await ctx.db
        .delete(fingerprintSnapshots)
        .where(
          notInArray(fingerprintSnapshots.fingerprint, [...groups.keys()])
        );
    } catch (error) {
      ctx.log.warn(
        { err: error, module: "job-listings" },
        "snapshot prune failed (harmless)"
      );
    }
  }

  await processReports(ctx);
  await enforceTtl(ctx);
  setGauge("linkedin_circuit_open", linkedinCircuitCount());
  incCounter("poll_ticks_total", { module: "job-listings" });
  const durationMs = Date.now() - started;
  ctx.log.info(
    {
      delivered: newJobsDelivered,
      module: "job-listings",
      ms: durationMs,
      skipped: fingerprintsSkipped,
    },
    "poll tick done"
  );

  return {
    durationMs,
    fingerprintsSkipped,
    newJobsDelivered,
    subscriptionsCount: subs.length,
  };
};
