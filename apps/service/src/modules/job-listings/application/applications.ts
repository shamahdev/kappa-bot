import { matchGradeForScore } from "@kappa/contracts";
import type {
  ApplicationDtoType,
  ApplicationStatusType,
} from "@kappa/contracts";
import { jobApplications, seenJobs, subscriptions } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, desc, eq } from "drizzle-orm";

import { dmScopeKey, JobSubscriptionError } from "../domain/subscription";

type ApplicationRow = typeof jobApplications.$inferSelect;

export const applicationDto = (row: ApplicationRow): ApplicationDtoType => ({
  company: row.company,
  createdAt: row.createdAt.toISOString(),
  id: row.id,
  location: row.location,
  matchGrade: (row.matchGrade as ApplicationDtoType["matchGrade"]) ?? null,
  source: row.source,
  status: row.status as ApplicationStatusType,
  title: row.title,
  updatedAt: row.updatedAt.toISOString(),
  url: row.url,
});

/** Personal-only tracking: every read/write is scoped to the session user. */
export const createJobApplications = (db: Database) => ({
  async list(userId: string): Promise<ApplicationDtoType[]> {
    const rows = await db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.userId, userId))
      .orderBy(desc(jobApplications.updatedAt), desc(jobApplications.id));
    return rows.map(applicationDto);
  },

  async move(
    userId: string,
    id: number,
    status: ApplicationStatusType
  ): Promise<ApplicationDtoType | null> {
    const [row] = await db
      .update(jobApplications)
      .set({ status, updatedAt: new Date() })
      .where(
        and(eq(jobApplications.id, id), eq(jobApplications.userId, userId))
      )
      .returning();
    return row ? applicationDto(row) : null;
  },

  async remove(userId: string, id: number): Promise<boolean> {
    const rows = await db
      .delete(jobApplications)
      .where(
        and(eq(jobApplications.id, id), eq(jobApplications.userId, userId))
      )
      .returning({ id: jobApplications.id });
    return rows.length > 0;
  },
  /** Track a delivered personal job; re-tagging an existing card moves it. */
  async track(
    userId: string,
    seenJobId: number,
    status: ApplicationStatusType
  ): Promise<ApplicationDtoType> {
    const [job] = await db
      .select({ job: seenJobs })
      .from(seenJobs)
      .innerJoin(subscriptions, eq(seenJobs.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(seenJobs.id, seenJobId),
          eq(subscriptions.guildId, dmScopeKey(userId))
        )
      );
    if (!job) {
      throw new JobSubscriptionError("NOT_FOUND", "job not found");
    }
    const { job: seen } = job;
    const now = new Date();
    const [row] = await db
      .insert(jobApplications)
      .values({
        company: seen.snapshot?.company ?? null,
        externalId: seen.externalId,
        location: seen.snapshot?.location ?? null,
        matchGrade:
          seen.matchScore === null ? null : matchGradeForScore(seen.matchScore),
        seenJobId: seen.id,
        source: seen.source,
        status,
        title: seen.snapshot?.title ?? null,
        updatedAt: now,
        url: seen.url,
        userId,
      })
      .onConflictDoUpdate({
        set: { seenJobId: seen.id, status, updatedAt: now },
        target: [
          jobApplications.userId,
          jobApplications.source,
          jobApplications.externalId,
        ],
      })
      .returning();
    return applicationDto(row);
  },
});
