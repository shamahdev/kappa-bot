import { createHash } from "node:crypto";

import type { PostingFactsType } from "@kappa/contracts";
import {
  postingEvaluations,
  postingFacts,
  seenJobs,
  subscriptions,
} from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, eq, inArray, isNull, or, sql, count, lt } from "drizzle-orm";

import type { Logger } from "../../../core/logger";
import type { JobPosting } from "../domain/posting";
import { matchesPostingFacts } from "../domain/posting-facts";
import { hasPostingFilters } from "../domain/subscription";
import type { JobActor, JobSubscription } from "../domain/subscription";
import {
  extractPostingFacts,
  extractionUnavailable,
  sourcePostingFacts,
} from "../infrastructure/fact-extraction";
import type { FactExtraction } from "../infrastructure/fact-extraction";
import { jobKey } from "../infrastructure/job-store";

const FACT_TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const POLL_LIMIT = 20;
const POLL_BUDGET_MS = 120_000;
const LEASE_MS = 60_000;

export const evaluationCriteriaKey = (sub: JobSubscription): string =>
  createHash("sha256")
    .update(
      JSON.stringify([
        sub.keywordAlternatives ?? [sub.keywords],
        sub.source,
        sub.location,
        sub.geoId,
        sub.distance,
        sub.filters,
        sub.minimumSalary ?? null,
        (sub.workEnvironments ?? []).toSorted(),
        Boolean(sub.includeUnspecifiedSalary),
        Boolean(sub.includeUnspecifiedEnvironment),
      ])
    )
    .digest("hex");

const metadataHash = (posting: JobPosting): string =>
  createHash("sha256")
    .update(
      JSON.stringify([
        posting.salary,
        posting.salaryData,
        posting.workEnvironment,
        posting.description,
      ])
    )
    .digest("hex");

export const sourceFactsSufficient = (
  sub: JobSubscription,
  facts: PostingFactsType
): boolean =>
  (sub.minimumSalary === null ||
    sub.minimumSalary === undefined ||
    Boolean(
      facts.salary?.currency &&
      facts.salary.period &&
      (facts.salary.min !== null || facts.salary.max !== null)
    )) &&
  (!sub.workEnvironments?.length || facts.workEnvironment !== null);

export interface EvaluationStatus {
  pending: number;
  failed: number;
  unavailable: string | null;
}

interface EvaluationOutcome {
  facts: PostingFactsType | null;
  status: string;
}

interface EvaluationBudget {
  started: number;
  worked: number;
  unavailable: string | null;
}

const cacheIsFresh = (
  cached: typeof postingFacts.$inferSelect,
  hash: string,
  now: number
): boolean =>
  cached.status === "complete" &&
  Boolean(
    cached.facts &&
    cached.fetchedAt &&
    now - cached.fetchedAt.getTime() < FACT_TTL_MS &&
    cached.evidenceHash === hash
  );

const workIsDeferred = (
  cached: typeof postingFacts.$inferSelect | undefined,
  hash: string,
  budget: EvaluationBudget,
  now: number
): boolean =>
  Boolean(
    budget.unavailable ||
    budget.worked >= POLL_LIMIT ||
    now - budget.started >= POLL_BUDGET_MS ||
    (cached?.retryAt &&
      cached.retryAt.getTime() > now &&
      cached.evidenceHash === hash) ||
    (cached?.claimedAt && now - cached.claimedAt.getTime() < LEASE_MS)
  );

export const createPostingEvaluation = (
  db: Database,
  log: Logger,
  authorize: (actor: JobActor, id: number) => Promise<JobSubscription>,
  dependencies: {
    extract?: typeof extractPostingFacts;
    now?: () => number;
    unavailable?: () => string | null;
  } = {}
) => {
  const now = dependencies.now ?? Date.now;
  const extract = dependencies.extract ?? extractPostingFacts;
  const configurationUnavailable =
    dependencies.unavailable ?? extractionUnavailable;

  const extractClaim = async (
    job: JobPosting,
    cached: typeof postingFacts.$inferSelect | undefined,
    hash: string,
    budget: EvaluationBudget
  ): Promise<EvaluationOutcome> => {
    const stale =
      cached?.status === "complete" || cached?.evidenceHash !== hash;
    const claimedAt = new Date(now());
    const [claim] = await db
      .insert(postingFacts)
      .values({
        claimedAt,
        evidenceHash: hash,
        externalId: job.id,
        source: job.source,
      })
      .onConflictDoUpdate({
        set: {
          attempts: stale ? 0 : sql`${postingFacts.attempts}`,
          claimedAt,
          evidenceHash: hash,
          status: "pending",
          updatedAt: claimedAt,
        },
        setWhere: or(
          isNull(postingFacts.claimedAt),
          lt(postingFacts.claimedAt, new Date(now() - LEASE_MS))
        ),
        target: [postingFacts.source, postingFacts.externalId],
      })
      .returning();
    if (!claim) {
      return { facts: null, status: "pending" };
    }
    budget.worked += 1;
    const result: FactExtraction = await extract(
      job,
      AbortSignal.timeout(
        Math.max(1, Math.min(30_000, POLL_BUDGET_MS - (now() - budget.started)))
      )
    );
    let { attempts } = claim;
    let status = "complete";
    let facts: PostingFactsType | null = null;
    let failureReason: string | null = null;
    let retryAt: Date | null = null;
    let fetchedAt: Date | null = null;
    if (result.kind === "complete") {
      attempts += 1;
      facts = { ...result.facts, closed: result.closed };
      fetchedAt = new Date(now());
    } else {
      if (result.unavailable) {
        budget.unavailable = result.reason;
      } else {
        attempts += 1;
      }
      status = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
      failureReason = result.reason;
      retryAt = new Date(now() + RETRY_MS);
      log.warn(
        { job: job.id, reason: result.reason, source: job.source },
        "posting extraction deferred"
      );
    }
    // Only this lease owner may publish facts; no AI call is inside a transaction.
    const saved = await db
      .update(postingFacts)
      .set({
        attempts,
        claimedAt: null,
        facts,
        failureReason,
        fetchedAt,
        retryAt,
        status,
        updatedAt: new Date(now()),
      })
      .where(
        and(
          eq(postingFacts.id, claim.id),
          eq(postingFacts.claimedAt, claimedAt)
        )
      )
      .returning();
    return saved.length
      ? { facts, status }
      : { facts: null, status: "pending" };
  };

  const cachedOutcome = async (
    job: JobPosting,
    budget: EvaluationBudget
  ): Promise<EvaluationOutcome> => {
    const [cached] = await db
      .select()
      .from(postingFacts)
      .where(
        and(
          eq(postingFacts.source, job.source),
          eq(postingFacts.externalId, job.id)
        )
      );
    const hash = metadataHash(job);
    if (cached && cacheIsFresh(cached, hash, now())) {
      return { facts: cached.facts, status: "complete" };
    }
    if (
      cached?.status === "failed" &&
      cached.attempts >= MAX_ATTEMPTS &&
      cached.evidenceHash === hash
    ) {
      return { facts: null, status: "failed" };
    }
    if (workIsDeferred(cached, hash, budget, now())) {
      return { facts: null, status: "pending" };
    }
    return extractClaim(job, cached, hash, budget);
  };

  const enqueue = async (
    sub: JobSubscription,
    jobs: JobPosting[]
  ): Promise<void> => {
    if (!jobs.length || !hasPostingFilters(sub)) {
      return;
    }
    const criteriaKey = evaluationCriteriaKey(sub);
    const unique = [
      ...new Map(jobs.map((job) => [jobKey(job.source, job.id), job])).values(),
    ];
    await db
      .insert(postingEvaluations)
      .values(
        unique.map((posting) => ({
          criteriaKey,
          externalId: posting.id,
          posting,
          source: posting.source,
          subscriptionId: sub.id,
        }))
      )
      .onConflictDoUpdate({
        set: {
          criteriaKey: sql`excluded.criteria_key`,
          posting: sql`excluded.posting`,
          status: sql`CASE WHEN ${postingEvaluations.criteriaKey} <> excluded.criteria_key OR ${postingEvaluations.posting} IS DISTINCT FROM excluded.posting THEN 'pending' ELSE ${postingEvaluations.status} END`,
          updatedAt: new Date(now()),
        },
        target: [
          postingEvaluations.subscriptionId,
          postingEvaluations.source,
          postingEvaluations.externalId,
        ],
      });
  };

  const process = async (
    subs: JobSubscription[],
    options: { includeSeen?: boolean; candidates?: JobPosting[] } = {}
  ): Promise<Map<number, JobPosting[]>> => {
    const filtered = subs.filter(hasPostingFilters);
    const accepted = new Map<number, JobPosting[]>();
    if (options.candidates?.length === 0) {
      return accepted;
    }
    if (!filtered.length) {
      return accepted;
    }
    const byId = new Map(filtered.map((sub) => [sub.id, sub]));
    // Seen postings need no evaluation; this also preserves failed-send dedup behavior.
    const candidates = await db
      .select({ evaluation: postingEvaluations })
      .from(postingEvaluations)
      .leftJoin(
        seenJobs,
        and(
          eq(seenJobs.subscriptionId, postingEvaluations.subscriptionId),
          eq(seenJobs.source, postingEvaluations.source),
          eq(seenJobs.externalId, postingEvaluations.externalId)
        )
      )
      .where(
        and(
          inArray(postingEvaluations.subscriptionId, [...byId.keys()]),
          options.includeSeen ? undefined : isNull(seenJobs.id),
          options.candidates
            ? or(
                ...options.candidates.map((job) =>
                  and(
                    eq(postingEvaluations.source, job.source),
                    eq(postingEvaluations.externalId, job.id)
                  )
                )
              )
            : undefined
        )
      )
      .orderBy(postingEvaluations.createdAt, postingEvaluations.id);
    const budget: EvaluationBudget = {
      started: now(),
      unavailable: configurationUnavailable(),
      worked: 0,
    };
    const outcomes = new Map<string, EvaluationOutcome>();
    for (const { evaluation } of candidates) {
      const sub = byId.get(evaluation.subscriptionId);
      if (!sub || evaluation.criteriaKey !== evaluationCriteriaKey(sub)) {
        continue;
      }
      const job = evaluation.posting;
      const key = `${jobKey(job.source, job.id)}:${metadataHash(job)}`;
      let outcome = outcomes.get(key);
      const source = sourcePostingFacts(job);
      if (sourceFactsSufficient(sub, source)) {
        outcome = { facts: source, status: "complete" };
      }
      if (!outcome) {
        // Shared cache and external calls stay serial and respect the per-poll budget.
        // oxlint-disable-next-line no-await-in-loop
        outcome = await cachedOutcome(job, budget);
        outcomes.set(key, outcome);
      }
      const passes = Boolean(
        outcome.facts && matchesPostingFacts(sub, outcome.facts)
      );
      let { status } = outcome;
      if (outcome.facts) {
        status = passes ? "accepted" : "rejected";
      }
      // Persist evaluation independently from SeenJob; failures never consume delivery claims.
      // oxlint-disable-next-line no-await-in-loop
      await db
        .update(postingEvaluations)
        .set({
          status,
          updatedAt: new Date(now()),
        })
        .where(
          and(
            eq(postingEvaluations.id, evaluation.id),
            eq(postingEvaluations.criteriaKey, evaluation.criteriaKey)
          )
        );
      if (passes) {
        const postings = accepted.get(sub.id) ?? [];
        postings.push(job);
        accepted.set(sub.id, postings);
      }
    }
    return accepted;
  };

  const statuses = async (
    rows: JobSubscription[]
  ): Promise<Map<number, EvaluationStatus>> => {
    const ids = rows.filter(hasPostingFilters).map((sub) => sub.id);
    const result = new Map<number, EvaluationStatus>();
    if (!ids.length) {
      return result;
    }
    const counts = await db
      .select({
        criteriaKey: postingEvaluations.criteriaKey,
        status: postingEvaluations.status,
        subscriptionId: postingEvaluations.subscriptionId,
        total: count(),
      })
      .from(postingEvaluations)
      .innerJoin(
        subscriptions,
        eq(subscriptions.id, postingEvaluations.subscriptionId)
      )
      .where(inArray(postingEvaluations.subscriptionId, ids))
      .groupBy(
        postingEvaluations.subscriptionId,
        postingEvaluations.criteriaKey,
        postingEvaluations.status
      );
    for (const row of counts) {
      const subscription = rows.find((sub) => sub.id === row.subscriptionId);
      if (
        !subscription ||
        row.criteriaKey !== evaluationCriteriaKey(subscription)
      ) {
        continue;
      }
      const value = result.get(row.subscriptionId) ?? {
        failed: 0,
        pending: 0,
        unavailable: configurationUnavailable(),
      };
      if (row.status === "pending") {
        value.pending += row.total;
      }
      if (row.status === "failed") {
        value.failed += row.total;
      }
      result.set(row.subscriptionId, value);
    }
    for (const id of ids) {
      if (!result.has(id)) {
        result.set(id, {
          failed: 0,
          pending: 0,
          unavailable: configurationUnavailable(),
        });
      }
    }
    const failures = await db
      .select({
        reason: postingFacts.failureReason,
        subscriptionId: postingEvaluations.subscriptionId,
        updatedAt: postingFacts.updatedAt,
      })
      .from(postingEvaluations)
      .innerJoin(
        postingFacts,
        and(
          eq(postingFacts.source, postingEvaluations.source),
          eq(postingFacts.externalId, postingEvaluations.externalId)
        )
      )
      .where(
        and(
          inArray(postingEvaluations.subscriptionId, ids),
          eq(postingEvaluations.status, "pending")
        )
      );
    for (const row of failures) {
      if (
        row.reason?.startsWith("AI provider") &&
        now() - row.updatedAt.getTime() < RETRY_MS
      ) {
        const status = result.get(row.subscriptionId);
        if (status) {
          status.unavailable = row.reason;
        }
      }
    }
    return result;
  };

  const retry = async (actor: JobActor, id: number): Promise<void> => {
    const sub = await authorize(actor, id);
    const failed = await db
      .select({
        externalId: postingEvaluations.externalId,
        source: postingEvaluations.source,
      })
      .from(postingEvaluations)
      .where(
        and(
          eq(postingEvaluations.subscriptionId, id),
          eq(postingEvaluations.criteriaKey, evaluationCriteriaKey(sub)),
          eq(postingEvaluations.status, "failed")
        )
      );
    if (failed.length) {
      await db
        .update(postingFacts)
        .set({
          attempts: 0,
          retryAt: null,
          status: "pending",
          updatedAt: new Date(now()),
        })
        .where(
          and(
            eq(postingFacts.status, "failed"),
            or(
              ...failed.map((posting) =>
                and(
                  eq(postingFacts.source, posting.source),
                  eq(postingFacts.externalId, posting.externalId)
                )
              )
            )
          )
        );
    }
    await db
      .update(postingEvaluations)
      .set({ status: "pending", updatedAt: new Date(now()) })
      .where(
        and(
          eq(postingEvaluations.subscriptionId, id),
          eq(postingEvaluations.criteriaKey, evaluationCriteriaKey(sub)),
          eq(postingEvaluations.status, "failed")
        )
      );
  };

  return { enqueue, process, retry, statuses };
};
