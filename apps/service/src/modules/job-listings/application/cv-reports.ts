import {
  CV_REPORT_PERIOD_MS,
  matchGradeForScore,
  weightedMatchScore,
} from "@kappa/contracts";
import type {
  CvReportJobType,
  MatchBreakdownType,
  MatchGradeType,
} from "@kappa/contracts";
import { cvReportDeliveries, cvReports, subscriptions } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import type { Logger } from "../../../core/logger";
import type { JobPosting } from "../domain/posting";
import { dmUserIdForScope } from "../domain/subscription";
import { summarizeCvReport } from "../infrastructure/ai";
import type { CvReportEvidence } from "../infrastructure/ai";
import { createCvProfiles } from "./cv";
import type { createJobEnrichment } from "./enrichment";

const reportJob = (
  posting: JobPosting,
  grade: MatchGradeType | null = null
): CvReportJobType => ({
  company: posting.company,
  grade,
  source: posting.source,
  title: posting.position,
  url: posting.url,
});

/** Mean of each factor over every scored job in the report. */
export const averageMatchFactors = (
  assessments: MatchBreakdownType[]
): MatchBreakdownType => {
  if (assessments.length === 0) {
    throw new Error("averageMatchFactors needs at least one assessment");
  }
  const count = assessments.length;
  const average = (key: keyof MatchBreakdownType) =>
    assessments.reduce((sum, factors) => sum + factors[key].score, 0) / count;
  const reason = (label: string) =>
    `Average ${label} alignment across ${count} assessed job${count === 1 ? "" : "s"}.`;
  return {
    keywordMatch: { reason: reason("keyword"), score: average("keywordMatch") },
    relevantExperience: {
      reason: reason("relevant experience"),
      score: average("relevantExperience"),
    },
    skills: { reason: reason("skills"), score: average("skills") },
  };
};

/** A window opens at the previous report's end, or at the first unreported delivery. */
export const isReportDue = (windowStart: Date, now: Date): boolean =>
  now.getTime() - windowStart.getTime() >= CV_REPORT_PERIOD_MS;

export type CreateReportResult =
  | { kind: "created"; id: number }
  | { kind: "empty" }
  | { kind: "not_due" };

/**
 * Transactions are short and never span network calls: creation and each
 * per-job write are separate statements, and every AI call happens outside a
 * transaction. Concurrent generators (bot tick + dashboard trigger) are safe
 * because assessment writes are idempotent and publication is a single
 * compare-and-set on status.
 */
export const createCvReports = ({
  db,
  log,
  enrichment,
  notify,
}: {
  db: Database;
  log: Logger;
  enrichment: ReturnType<typeof createJobEnrichment>;
  notify?: (userId: string, reportId: number, grade: string) => Promise<void>;
}) => {
  const profiles = createCvProfiles(db);
  const inFlight = new Set<number>();

  const notifyReady = async (id: number) => {
    if (!notify) {
      return;
    }
    // Claim first, so two processes never DM the same report; release on failure.
    const [claimed] = await db
      .update(cvReports)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(cvReports.id, id),
          eq(cvReports.status, "ready"),
          isNull(cvReports.notifiedAt)
        )
      )
      .returning({ grade: cvReports.grade, userId: cvReports.userId });
    if (!claimed?.grade) {
      return;
    }
    try {
      await notify(claimed.userId, id, claimed.grade);
    } catch (error) {
      await db
        .update(cvReports)
        .set({ notifiedAt: null })
        .where(eq(cvReports.id, id));
      throw error;
    }
  };

  const create = async (
    userId: string,
    trigger: "scheduled" | "manual",
    now = new Date()
  ): Promise<CreateReportResult> =>
    await db.transaction(async (tx) => {
      // Serialize window creation per user; held only for these few statements.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`cv_report:${userId}`}))`
      );
      const [previous] = await tx
        .select({ windowEnd: cvReports.windowEnd })
        .from(cvReports)
        .where(eq(cvReports.userId, userId))
        .orderBy(desc(cvReports.windowEnd))
        .limit(1);
      const queued = await tx
        .select({
          deliveredAt: cvReportDeliveries.deliveredAt,
          id: cvReportDeliveries.id,
          posting: cvReportDeliveries.posting,
        })
        .from(cvReportDeliveries)
        .where(
          and(
            eq(cvReportDeliveries.userId, userId),
            isNull(cvReportDeliveries.reportId),
            lte(cvReportDeliveries.deliveredAt, now)
          )
        )
        .orderBy(asc(cvReportDeliveries.id));
      const [first] = queued;
      if (!first) {
        return { kind: "empty" } as const;
      }
      const windowStart =
        previous?.windowEnd ??
        new Date(Math.min(...queued.map((row) => row.deliveredAt.getTime())));
      if (trigger === "scheduled" && !isReportDue(windowStart, now)) {
        return { kind: "not_due" } as const;
      }
      const [report] = await tx
        .insert(cvReports)
        .values({
          jobs: queued.map((row) => reportJob(row.posting)),
          trigger,
          userId,
          windowEnd: now,
          windowStart,
        })
        .returning({ id: cvReports.id });
      await tx
        .update(cvReportDeliveries)
        .set({ reportId: report.id })
        .where(
          inArray(
            cvReportDeliveries.id,
            queued.map((row) => row.id)
          )
        );
      return { id: report.id, kind: "created" } as const;
    });

  const setPendingMessage = (id: number, message: string) =>
    db
      .update(cvReports)
      .set({ message })
      .where(and(eq(cvReports.id, id), eq(cvReports.status, "pending")));

  const generateOnce = async (id: number) => {
    const [report] = await db
      .select()
      .from(cvReports)
      .where(eq(cvReports.id, id));
    if (!report || report.status !== "pending") {
      return;
    }
    const cv = await profiles.get(report.userId);
    if (!cv) {
      await db
        .update(cvReports)
        .set({
          message:
            "No CV was uploaded when this period ended, so no score was calculated.",
          status: "cv_required",
        })
        .where(and(eq(cvReports.id, id), eq(cvReports.status, "pending")));
      return;
    }
    // One CV snapshot per report: a replaced CV restarts its assessments.
    if (report.cvUploadedAt?.getTime() !== cv.updatedAt.getTime()) {
      await db.transaction(async (tx) => {
        if (report.cvUploadedAt) {
          await tx
            .update(cvReportDeliveries)
            .set({ assessment: null, factors: null, grade: null })
            .where(eq(cvReportDeliveries.reportId, id));
        }
        await tx
          .update(cvReports)
          .set({ cvFilename: cv.filename, cvUploadedAt: cv.updatedAt })
          .where(eq(cvReports.id, id));
      });
    }

    const rows = await db
      .select()
      .from(cvReportDeliveries)
      .where(eq(cvReportDeliveries.reportId, id))
      .orderBy(asc(cvReportDeliveries.id));
    let failed = 0;
    for (const row of rows) {
      if (row.assessment) {
        continue;
      }
      // Sequential on purpose: one provider call at a time per report.
      // oxlint-disable-next-line no-await-in-loop
      const outcome = await enrichment.assessForReport(row.posting, cv.text);
      if (outcome.kind === "failed") {
        failed += 1;
        continue;
      }
      const values =
        outcome.kind === "scored"
          ? {
              assessment: "scored",
              factors: outcome.match.factors,
              grade: outcome.match.grade,
            }
          : { assessment: "skipped" };
      Object.assign(row, values);
      // oxlint-disable-next-line no-await-in-loop
      await db
        .update(cvReportDeliveries)
        .set(values)
        .where(
          and(
            eq(cvReportDeliveries.id, row.id),
            isNull(cvReportDeliveries.assessment)
          )
        );
    }

    const assessed = rows.length - failed;
    if (failed > 0) {
      await setPendingMessage(
        id,
        `Assessed ${assessed} of ${rows.length} jobs. The rest will be retried automatically.`
      );
      return;
    }
    const jobs = rows.map((row) =>
      reportJob(row.posting, (row.grade as MatchGradeType | null) ?? null)
    );
    const scored = rows.flatMap((row) =>
      row.assessment === "scored" && row.factors && row.grade
        ? [
            {
              company: row.posting.company,
              factors: row.factors,
              grade: row.grade as MatchGradeType,
              title: row.posting.position,
            } satisfies CvReportEvidence,
          ]
        : []
    );
    if (scored.length === 0) {
      await db
        .update(cvReports)
        .set({
          jobs,
          message:
            rows.length === 0
              ? "No jobs remain in this period."
              : `None of the ${rows.length} jobs in this period had a description to assess.`,
          status: "unavailable",
        })
        .where(and(eq(cvReports.id, id), eq(cvReports.status, "pending")));
      return;
    }
    const factors = averageMatchFactors(scored.map((job) => job.factors));
    const score = Math.round(weightedMatchScore(factors));
    const grade = matchGradeForScore(score);
    const summary = await summarizeCvReport(cv.text, scored, factors);
    if (!summary) {
      await setPendingMessage(
        id,
        "All jobs are scored. The written summary will be retried automatically."
      );
      return;
    }
    const published = await db
      .update(cvReports)
      .set({
        factors,
        grade,
        jobs,
        message: null,
        score,
        status: "ready",
        summary,
      })
      .where(and(eq(cvReports.id, id), eq(cvReports.status, "pending")))
      .returning({ id: cvReports.id });
    if (published.length > 0) {
      await notifyReady(id);
    }
  };

  const generate = async (id: number) => {
    if (inFlight.has(id)) {
      return;
    }
    inFlight.add(id);
    try {
      await generateOnce(id);
    } finally {
      inFlight.delete(id);
    }
  };

  const openDueReports = async (now: Date) => {
    const users = await db
      .selectDistinct({ userId: cvReportDeliveries.userId })
      .from(cvReportDeliveries)
      .where(isNull(cvReportDeliveries.reportId));
    for (const { userId } of users) {
      try {
        // oxlint-disable-next-line no-await-in-loop
        await create(userId, "scheduled", now);
      } catch (error) {
        log.warn({ error, userId }, "CV report window creation failed");
      }
    }
  };

  return {
    create,
    generate,
    /** Opens due 3-day windows, then resumes pending reports and unsent DMs. */
    async processPending(now = new Date()) {
      await openDueReports(now);
      const statuses = notify
        ? or(
            eq(cvReports.status, "pending"),
            and(eq(cvReports.status, "ready"), isNull(cvReports.notifiedAt))
          )
        : eq(cvReports.status, "pending");
      const pending = await db
        .select({ id: cvReports.id, status: cvReports.status })
        .from(cvReports)
        .where(statuses)
        .orderBy(asc(cvReports.id));
      for (const report of pending) {
        try {
          // oxlint-disable-next-line no-await-in-loop
          await (report.status === "pending"
            ? generate(report.id)
            : notifyReady(report.id));
        } catch (error) {
          log.warn(
            { error, reportId: report.id },
            "CV report processing failed"
          );
        }
      }
    },
    async recordDelivered(
      subscriptionId: number,
      delivered: { seenId: number; job: JobPosting }[]
    ) {
      if (!delivered.length) {
        return;
      }
      try {
        const [sub] = await db
          .select({ guildId: subscriptions.guildId })
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        const userId = sub && dmUserIdForScope(sub.guildId);
        if (!userId) {
          return;
        }
        await db
          .insert(cvReportDeliveries)
          .values(
            delivered.map((item) => ({
              posting: item.job,
              seenId: item.seenId,
              subscriptionId,
              userId,
            }))
          )
          .onConflictDoNothing();
      } catch (error) {
        log.warn(
          { error, subscriptionId },
          "CV report accumulation failed; job delivery remains successful"
        );
      }
    },
  };
};
