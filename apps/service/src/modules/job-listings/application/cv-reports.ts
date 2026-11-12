import {
  CV_REPORT_MAX_ATTEMPTS,
  CV_REPORT_NOTIFICATION_LEASE_MS,
  CV_REPORT_PERIOD_MS,
  matchGradeForScore,
  weightedMatchScore,
} from "@kappa/contracts";
import type {
  CvReportAssessmentType,
  CvReportJobType,
  MatchBreakdownType,
  MatchGradeType,
} from "@kappa/contracts";
import {
  createMemoryGenerationLock,
  cvReportDeliveries,
  cvReports,
  subscriptions,
} from "@kappa/db";
import type { Database, GenerationLock } from "@kappa/db";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type { Logger } from "../../../core/logger";
import type { JobPosting } from "../domain/posting";
import { dmUserIdForScope } from "../domain/subscription";
import { summarizeCvReport } from "../infrastructure/ai";
import type { CvReportEvidence } from "../infrastructure/ai";
import { createCvProfiles } from "./cv";
import type { createJobEnrichment, ReportAssessment } from "./enrichment";

type ReportRow = typeof cvReports.$inferSelect;
type DeliveryRow = typeof cvReportDeliveries.$inferSelect;
type CvProfile = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createCvProfiles>["get"]>>
>;
interface DeliveryUpdate {
  assessment?: CvReportAssessmentType;
  attempts: number;
  factors?: MatchBreakdownType;
  failureReason: string | null;
  grade?: MatchGradeType;
}

const unassessedMessage = (rows: DeliveryRow[]): string => {
  const failed = rows.filter((row) => row.assessment === "failed").length;
  const skipped = rows.filter((row) => row.assessment === "skipped").length;
  return [
    failed > 0
      ? `${failed} job${failed === 1 ? "" : "s"} could not be assessed.`
      : null,
    skipped > 0
      ? `${skipped} job${skipped === 1 ? "" : "s"} had no description to assess.`
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
};

const unavailableMessage = (rows: DeliveryRow[]): string => {
  const failed = rows.filter((row) => row.assessment === "failed").length;
  const skipped = rows.filter((row) => row.assessment === "skipped").length;
  if (rows.length === 0) {
    return "No jobs remain in this period.";
  }
  if (failed > 0 && skipped > 0) {
    return `None of the ${rows.length} jobs could be assessed: ${failed} failed and ${skipped} had no description.`;
  }
  if (failed > 0) {
    return `None of the ${rows.length} jobs could be assessed.`;
  }
  return `None of the ${rows.length} jobs had a description to assess.`;
};

const reportJob = (
  posting: JobPosting,
  seenJobId: number,
  assessment: CvReportAssessmentType | null = null,
  grade: MatchGradeType | null = null
): CvReportJobType => ({
  assessment,
  company: posting.company,
  grade,
  seenJobId,
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

export type RetryReportResult =
  | "queued"
  | "not_found"
  | "not_retryable"
  | "cv_required";

/**
 * Transactions are short and never span network calls: creation and each
 * per-job write are separate statements, and every AI call happens outside a
 * transaction. Generation is serialized per report with a cross-process lock;
 * assessment writes are idempotent and publication is a compare-and-set.
 */
export const createCvReports = ({
  db,
  log,
  enrichment,
  notify,
  lock = createMemoryGenerationLock(),
}: {
  db: Database;
  log: Logger;
  enrichment: ReturnType<typeof createJobEnrichment>;
  notify?: (userId: string, reportId: number, grade: string) => Promise<void>;
  lock?: GenerationLock;
}) => {
  const profiles = createCvProfiles(db);
  const inFlight = new Set<number>();
  // One generation at a time per process. Besides making provider calls
  // predictable, this bounds the dedicated advisory-lock connections to one,
  // so the shared query pool cannot be exhausted by lock holders.
  let generationTail: Promise<unknown> = Promise.resolve();

  const notifyReady = async (id: number) => {
    if (!notify) {
      return;
    }
    const now = new Date();
    const leaseCutoff = new Date(
      now.getTime() - CV_REPORT_NOTIFICATION_LEASE_MS
    );
    // Claim first, so two processes never DM the same report. A stale claim
    // (crashed process) is reclaimable after the lease; a handled failure
    // releases it immediately.
    const [claimed] = await db
      .update(cvReports)
      .set({ notificationClaimedAt: now })
      .where(
        and(
          eq(cvReports.id, id),
          eq(cvReports.status, "ready"),
          isNull(cvReports.notifiedAt),
          or(
            isNull(cvReports.notificationClaimedAt),
            lt(cvReports.notificationClaimedAt, leaseCutoff)
          )
        )
      )
      .returning({ grade: cvReports.grade, userId: cvReports.userId });
    if (!claimed) {
      return;
    }
    if (!claimed.grade) {
      // A ready report without a grade cannot be notified; stop selecting it.
      await db
        .update(cvReports)
        .set({ notificationClaimedAt: null, notifiedAt: new Date() })
        .where(eq(cvReports.id, id));
      return;
    }
    try {
      await notify(claimed.userId, id, claimed.grade);
      await db
        .update(cvReports)
        .set({ notificationClaimedAt: null, notifiedAt: new Date() })
        .where(and(eq(cvReports.id, id), isNull(cvReports.notifiedAt)));
    } catch (error) {
      await db
        .update(cvReports)
        .set({ notificationClaimedAt: null })
        .where(and(eq(cvReports.id, id), isNull(cvReports.notifiedAt)));
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
          seenId: cvReportDeliveries.seenId,
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
          jobs: queued.map((row) => reportJob(row.posting, row.seenId)),
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

  // One CV snapshot per report: a replaced CV restarts its assessments. The
  // status guard prevents a stale generator from mutating a published report.
  /** Returns the summary attempt count to use, or null when generation must stop. */
  const resetSnapshot = async (
    id: number,
    report: ReportRow,
    cv: CvProfile
  ): Promise<number | null> => {
    if (report.cvUploadedAt?.getTime() === cv.updatedAt.getTime()) {
      return report.summaryAttempts;
    }
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(cvReports)
        .set({
          cvFilename: cv.filename,
          cvUploadedAt: cv.updatedAt,
          message: null,
          summaryAttempts: 0,
        })
        .where(and(eq(cvReports.id, id), eq(cvReports.status, "pending")))
        .returning({ id: cvReports.id });
      if (!updated) {
        return null;
      }
      if (report.cvUploadedAt) {
        await tx
          .update(cvReportDeliveries)
          .set({
            assessment: null,
            attempts: 0,
            factors: null,
            failureReason: null,
            grade: null,
          })
          .where(eq(cvReportDeliveries.reportId, id));
      }
      return 0;
    });
  };

  const assessmentValues = (
    outcome: ReportAssessment,
    attempts: number,
    reportId: number,
    seenId: number
  ): DeliveryUpdate => {
    if (outcome.kind === "scored") {
      return {
        assessment: "scored",
        attempts,
        factors: outcome.match.factors,
        failureReason: null,
        grade: outcome.match.grade,
      };
    }
    if (outcome.kind === "skipped") {
      return {
        assessment: "skipped",
        attempts,
        failureReason: outcome.reason,
      };
    }
    const terminal = !outcome.transient || attempts >= CV_REPORT_MAX_ATTEMPTS;
    log.warn(
      {
        attempts,
        module: "job-listings",
        reason: outcome.reason,
        reportId,
        seenId,
        terminal,
        transient: outcome.transient,
      },
      "CV report job assessment failed"
    );
    return terminal
      ? { assessment: "failed", attempts, failureReason: outcome.reason }
      : { attempts, failureReason: outcome.reason };
  };

  const assessRows = async (
    id: number,
    rows: DeliveryRow[],
    cvText: string
  ): Promise<void> => {
    for (const row of rows) {
      if (row.assessment) {
        continue;
      }
      // Sequential on purpose: one provider call at a time per report.
      // oxlint-disable-next-line no-await-in-loop
      const outcome = await enrichment.assessForReport(row.posting, cvText);
      const values = assessmentValues(
        outcome,
        row.attempts + 1,
        id,
        row.seenId
      );
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
  };

  const publishReport = async (
    id: number,
    summaryAttempts: number,
    rows: DeliveryRow[],
    cvText: string
  ): Promise<void> => {
    const pending = rows.filter((row) => row.assessment === null);
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
    if (pending.length > 0) {
      await setPendingMessage(
        id,
        `Scored ${scored.length} of ${rows.length} jobs. ${pending.length} will be retried automatically.`
      );
      return;
    }
    const jobs = rows.map((row) =>
      reportJob(
        row.posting,
        row.seenId,
        (row.assessment as CvReportAssessmentType | null) ?? null,
        (row.grade as MatchGradeType | null) ?? null
      )
    );
    const unassessed = unassessedMessage(rows);
    if (scored.length === 0) {
      await db
        .update(cvReports)
        .set({ jobs, message: unavailableMessage(rows), status: "unavailable" })
        .where(and(eq(cvReports.id, id), eq(cvReports.status, "pending")));
      return;
    }
    const factors = averageMatchFactors(scored.map((job) => job.factors));
    const score = Math.round(weightedMatchScore(factors));
    const grade = matchGradeForScore(score);
    const summaryOutcome = await summarizeCvReport(cvText, scored, factors);
    if (summaryOutcome.kind === "failed") {
      const attempts = summaryAttempts + 1;
      const terminal =
        !summaryOutcome.transient || attempts >= CV_REPORT_MAX_ATTEMPTS;
      log.warn(
        {
          attempts,
          module: "job-listings",
          reason: summaryOutcome.reason,
          reportId: id,
          terminal,
          transient: summaryOutcome.transient,
        },
        "CV report summary failed"
      );
      if (!terminal) {
        await db
          .update(cvReports)
          .set({ summaryAttempts: attempts })
          .where(and(eq(cvReports.id, id), eq(cvReports.status, "pending")));
        await setPendingMessage(
          id,
          `Scored ${scored.length} of ${rows.length} jobs. The written summary will be retried automatically.`
        );
        return;
      }
      const message = [
        unassessed,
        "Scores are ready; the written summary could not be generated.",
      ]
        .filter(Boolean)
        .join(" ");
      const published = await db
        .update(cvReports)
        .set({
          factors,
          grade,
          jobs,
          message,
          score,
          status: "ready",
          summary: null,
          summaryAttempts: attempts,
        })
        .where(and(eq(cvReports.id, id), eq(cvReports.status, "pending")))
        .returning({ id: cvReports.id });
      if (published.length > 0) {
        await notifyReady(id);
      }
      return;
    }
    const published = await db
      .update(cvReports)
      .set({
        factors,
        grade,
        jobs,
        message: unassessed || null,
        score,
        status: "ready",
        summary: summaryOutcome.summary,
      })
      .where(and(eq(cvReports.id, id), eq(cvReports.status, "pending")))
      .returning({ id: cvReports.id });
    if (published.length > 0) {
      await notifyReady(id);
    }
  };

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
    const summaryAttempts = await resetSnapshot(id, report, cv);
    if (summaryAttempts === null) {
      return;
    }
    let rows = await db
      .select()
      .from(cvReportDeliveries)
      .where(eq(cvReportDeliveries.reportId, id))
      .orderBy(asc(cvReportDeliveries.id));
    await assessRows(id, rows, cv.text);
    // Re-read persisted state: another process may have completed rows while
    // this one was waiting on the provider.
    rows = await db
      .select()
      .from(cvReportDeliveries)
      .where(eq(cvReportDeliveries.reportId, id))
      .orderBy(asc(cvReportDeliveries.id));
    await publishReport(id, summaryAttempts, rows, cv.text);
  };

  const generate = async (id: number) => {
    if (inFlight.has(id)) {
      return;
    }
    inFlight.add(id);
    const runGeneration = async () => {
      const release = await lock.acquire(`cv-report:${id}`);
      if (release) {
        try {
          await generateOnce(id);
        } finally {
          try {
            await release();
          } catch (error) {
            log.warn({ error, reportId: id }, "CV report lock release failed");
          }
        }
      }
      return null;
    };
    const run = generationTail.then(runGeneration);
    // Keep the queue alive; the caller still receives the rejection.
    generationTail = run.catch(() => null);
    try {
      await run;
    } finally {
      inFlight.delete(id);
    }
  };

  const retry = async (
    userId: string,
    id: number
  ): Promise<RetryReportResult> => {
    const [report] = await db
      .select({ id: cvReports.id, status: cvReports.status })
      .from(cvReports)
      .where(and(eq(cvReports.id, id), eq(cvReports.userId, userId)));
    if (!report) {
      return "not_found";
    }
    if (report.status !== "cv_required" && report.status !== "unavailable") {
      return "not_retryable";
    }
    if (!(await profiles.get(userId))) {
      return "cv_required";
    }
    const queued = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(cvReports)
        .set({
          factors: null,
          grade: null,
          message: null,
          notificationClaimedAt: null,
          notifiedAt: null,
          score: null,
          status: "pending",
          summary: null,
          summaryAttempts: 0,
        })
        .where(
          and(
            eq(cvReports.id, id),
            eq(cvReports.userId, userId),
            inArray(cvReports.status, ["cv_required", "unavailable"])
          )
        )
        .returning({ id: cvReports.id });
      if (!updated) {
        return false;
      }
      await tx
        .update(cvReportDeliveries)
        .set({
          assessment: null,
          attempts: 0,
          factors: null,
          failureReason: null,
          grade: null,
        })
        .where(eq(cvReportDeliveries.reportId, id));
      return true;
    });
    return queued ? "queued" : "not_retryable";
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
    retry,
  };
};
