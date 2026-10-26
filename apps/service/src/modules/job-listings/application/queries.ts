import { SUBSCRIPTION_SOURCES } from "@kappa/contracts";
import { jobs, seenJobs, subscriptions } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import {
  assertScopeAccess,
  dmScopeKey,
  JobSubscriptionError,
} from "../domain/subscription";
import type { JobActor, JobScope } from "../domain/subscription";

const CONCRETE_SOURCES = SUBSCRIPTION_SOURCES.filter(
  (source) => source !== "all"
);
// Existing jobs API pagination contract.
const MAX_PAGE_SIZE = 100;

const positiveInt = (
  raw: string | undefined,
  fallback: number
): number | null => {
  if (raw === undefined) {
    return fallback;
  }
  if (!/^\d+$/u.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

export interface JobListingFilters {
  subscription?: string;
  source?: string;
  q?: string;
  page?: string;
  pageSize?: string;
}

export const createJobQueries = (db: Database) => ({
  /** Account metadata, not a management grant: historical creation count is intentional. */
  async accountCounts(
    userId: string
  ): Promise<{ dmSubscriptions: number; guildSubscriptionsCreated: number }> {
    const personalKey = dmScopeKey(userId);
    const [[personal], [created]] = await Promise.all([
      db
        .select({ n: count() })
        .from(subscriptions)
        .where(eq(subscriptions.guildId, personalKey)),
      db
        .select({ n: count() })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.createdBy, userId),
            ne(subscriptions.guildId, personalKey)
          )
        ),
    ]);
    return {
      dmSubscriptions: personal?.n ?? 0,
      guildSubscriptionsCreated: created?.n ?? 0,
    };
  },
  async guildCounts(
    actor: JobActor,
    guildIds: string[]
  ): Promise<Map<string, { total: number; active: number }>> {
    for (const guildId of guildIds) {
      // Stop at the first denied guild before issuing subsequent live permission checks.
      // oxlint-disable-next-line no-await-in-loop
      await assertScopeAccess(actor, { guildId, kind: "guild" });
    }
    const counts = new Map<string, { total: number; active: number }>();
    if (guildIds.length === 0) {
      return counts;
    }
    const rows = await db
      .select({
        guildId: subscriptions.guildId,
        isActive: subscriptions.isActive,
      })
      .from(subscriptions)
      .where(inArray(subscriptions.guildId, guildIds));
    for (const row of rows) {
      const entry = counts.get(row.guildId) ?? { active: 0, total: 0 };
      entry.total += 1;
      if (row.isActive) {
        entry.active += 1;
      }
      counts.set(row.guildId, entry);
    }
    return counts;
  },
  async list(actor: JobActor, scope: JobScope, query: JobListingFilters = {}) {
    const key = await assertScopeAccess(actor, scope);
    const page = positiveInt(query.page, 1);
    const pageSize = positiveInt(query.pageSize, 20);
    if (page === null || pageSize === null || pageSize > MAX_PAGE_SIZE) {
      throw new JobSubscriptionError(
        "VALIDATION",
        `page >= 1 and 1 <= pageSize <= ${MAX_PAGE_SIZE} required`
      );
    }
    if (
      query.source !== undefined &&
      !(CONCRETE_SOURCES as readonly string[]).includes(query.source)
    ) {
      throw new JobSubscriptionError(
        "VALIDATION",
        `unknown source (one of ${CONCRETE_SOURCES.join("|")})`
      );
    }
    const subscriptionId =
      query.subscription === undefined
        ? null
        : positiveInt(query.subscription, 0);
    if (query.subscription !== undefined && subscriptionId === null) {
      throw new JobSubscriptionError(
        "VALIDATION",
        "subscription filter must be a positive integer"
      );
    }
    if (subscriptionId !== null) {
      const [row] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.id, subscriptionId),
            eq(subscriptions.guildId, key)
          )
        );
      if (!row) {
        throw new JobSubscriptionError("NOT_FOUND", "subscription not found");
      }
    }
    const filters: SQL[] = [eq(subscriptions.guildId, key)];
    if (subscriptionId !== null) {
      filters.push(eq(seenJobs.subscriptionId, subscriptionId));
    }
    if (query.source !== undefined) {
      filters.push(eq(seenJobs.source, query.source));
    }
    const search = query.q?.trim();
    if (search) {
      const pattern = `%${search.replaceAll(/[\\%_]/gu, (character) => `\\${character}`)}%`;
      filters.push(
        sql`(${seenJobs.snapshot}->>'title' ILIKE ${pattern} OR ${seenJobs.snapshot}->>'company' ILIKE ${pattern})`
      );
    }
    const where = and(...filters);
    const [total] = await db
      .select({ total: count() })
      .from(seenJobs)
      .innerJoin(subscriptions, eq(seenJobs.subscriptionId, subscriptions.id))
      .where(where);
    const rows = await db
      .select({ aiSummary: jobs.aiSummary, job: seenJobs })
      .from(seenJobs)
      .innerJoin(subscriptions, eq(seenJobs.subscriptionId, subscriptions.id))
      .leftJoin(jobs, eq(seenJobs.jobId, jobs.id))
      .where(where)
      .orderBy(desc(seenJobs.firstSeenAt), desc(seenJobs.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { page, pageSize, rows, total: total?.total ?? 0 };
  },
});
