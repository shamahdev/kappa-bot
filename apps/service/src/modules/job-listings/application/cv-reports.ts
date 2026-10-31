import {
  CV_REPORT_JOB_COUNT,
  matchGradeForScore,
  weightedMatchScore,
} from "@kappa/contracts";
import type { CvReportJobType, MatchBreakdownType } from "@kappa/contracts";
import { cvReportDeliveries, cvReports, subscriptions } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";

import type { Logger } from "../../../core/logger";
import type { JobPosting } from "../domain/posting";
import { dmUserIdForScope, JobSubscriptionError } from "../domain/subscription";
import { summarizeCvReport } from "../infrastructure/ai";
import { createCvProfiles } from "./cv";
import type { createJobEnrichment } from "./enrichment";

const reportJob = (posting: JobPosting): CvReportJobType => ({
  company: posting.company,
  grade: null,
  source: posting.source,
  title: posting.position,
  url: posting.url,
});

export const averageCvReportFactors = (
  assessments: MatchBreakdownType[]
): MatchBreakdownType => {
  if (assessments.length !== CV_REPORT_JOB_COUNT) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "A CV report requires 20 complete job assessments."
    );
  }
  const average = (key: keyof MatchBreakdownType) =>
    assessments.reduce((sum, factors) => sum + factors[key].score, 0) /
    CV_REPORT_JOB_COUNT;
  return {
    keywordMatch: {
      reason: "Average keyword alignment across all 20 jobs.",
      score: average("keywordMatch"),
    },
    relevantExperience: {
      reason: "Average relevant experience alignment across all 20 jobs.",
      score: average("relevantExperience"),
    },
    skills: {
      reason: "Average skills alignment across all 20 jobs.",
      score: average("skills"),
    },
  };
};

/** PostgreSQL row locks serialize batching/generation without invented lease timeouts. */
export const createCvReports = ({
  db,
  log,
  enrichment,
  notify,
}: {
  db: Database;
  log: Logger;
  enrichment: ReturnType<typeof createJobEnrichment>;
  notify: (userId: string, reportId: number, grade: string) => Promise<void>;
}) => {
  const notifyReady = async (id: number) => {
    await db.transaction(async (tx) => {
      const [report] = await tx
        .select()
        .from(cvReports)
        .where(
          and(
            eq(cvReports.id, id),
            eq(cvReports.status, "ready"),
            isNull(cvReports.notifiedAt)
          )
        )
        .for("update", { skipLocked: true });
      if (!report?.grade) {
        return;
      }
      await notify(report.userId, report.id, report.grade);
      await tx
        .update(cvReports)
        .set({ notifiedAt: new Date() })
        .where(eq(cvReports.id, report.id));
    });
  };

  const generate = async (id: number) => {
    const completed = await db.transaction(async (tx) => {
      const [report] = await tx
        .select()
        .from(cvReports)
        .where(eq(cvReports.id, id))
        .for("update", { skipLocked: true });
      if (!report || report.status !== "pending") {
        return null;
      }
      // One snapshot for the entire report, irrespective of prior job scores.
      const current = await createCvProfiles(tx).get(report.userId);
      if (!current) {
        await tx
          .update(cvReports)
          .set({
            message:
              "Upload a CV to assess future 20-job batches. No score was calculated for this batch.",
            status: "cv_required",
          })
          .where(eq(cvReports.id, id));
        return null;
      }
      const assessments: MatchBreakdownType[] = [];
      const evidence: {
        title: string;
        company: string;
        description: string;
      }[] = [];
      const jobs: CvReportJobType[] = [];
      for (const posting of report.postings) {
        // One CV snapshot is assessed against each of the requester's 20 jobs.
        // oxlint-disable-next-line no-await-in-loop
        const assessment = await enrichment.assessForReport(
          posting,
          current.text
        );
        if (!assessment.match) {
          // Stop the incomplete report before assessing subsequent jobs.
          // oxlint-disable-next-line no-await-in-loop
          await tx
            .update(cvReports)
            .set({
              cvFilename: current.filename,
              cvUploadedAt: current.updatedAt,
              message:
                "The assessment could not complete for all 20 jobs. No partial overall grade was calculated.",
              status: "unavailable",
            })
            .where(eq(cvReports.id, id));
          return null;
        }
        assessments.push(assessment.match.factors);
        jobs.push({ ...reportJob(posting), grade: assessment.match.grade });
        evidence.push({
          company: posting.company,
          description: assessment.description,
          title: posting.position,
        });
      }
      const factors = averageCvReportFactors(assessments);
      const score = Math.round(weightedMatchScore(factors));
      const grade = matchGradeForScore(score);
      const summary = await summarizeCvReport(current.text, evidence, factors);
      if (!summary) {
        await tx
          .update(cvReports)
          .set({
            cvFilename: current.filename,
            cvUploadedAt: current.updatedAt,
            message:
              "The report summary could not be generated. No completed report was published.",
            status: "unavailable",
          })
          .where(eq(cvReports.id, id));
        return null;
      }
      await tx
        .update(cvReports)
        .set({
          cvFilename: current.filename,
          cvUploadedAt: current.updatedAt,
          factors,
          grade,
          jobs,
          message: null,
          status: "ready",
          summary,
        })
        .where(eq(cvReports.id, id));
      return { grade, userId: report.userId };
    });
    if (completed) {
      await notifyReady(id);
    }
  };

  return {
    async processPending() {
      const pending = await db
        .select({ id: cvReports.id, status: cvReports.status })
        .from(cvReports)
        .where(
          or(
            eq(cvReports.status, "pending"),
            and(eq(cvReports.status, "ready"), isNull(cvReports.notifiedAt))
          )
        )
        .orderBy(asc(cvReports.id));
      for (const report of pending) {
        try {
          // Resume persisted batches/unsent notifications on later polling runs.
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
        await db.transaction(async (tx) => {
          const [sub] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId))
            .for("update");
          const userId = sub && dmUserIdForScope(sub.guildId);
          if (!sub || !userId) {
            return;
          }
          await tx
            .insert(cvReportDeliveries)
            .values(
              delivered.map((item) => ({
                posting: item.job,
                seenId: item.seenId,
                subscriptionId,
              }))
            )
            .onConflictDoNothing();
          const pending = await tx
            .select()
            .from(cvReportDeliveries)
            .where(
              and(
                eq(cvReportDeliveries.subscriptionId, subscriptionId),
                isNull(cvReportDeliveries.reportId)
              )
            )
            .orderBy(asc(cvReportDeliveries.id));
          for (
            let offset = 0;
            offset + CV_REPORT_JOB_COUNT <= pending.length;
            offset += CV_REPORT_JOB_COUNT
          ) {
            const batch = pending.slice(offset, offset + CV_REPORT_JOB_COUNT);
            const postings = batch.map((item) => item.posting);
            // Each immutable report consumes exactly 20 delivery queue rows.
            // oxlint-disable-next-line no-await-in-loop
            const [report] = await tx
              .insert(cvReports)
              .values({
                jobs: postings.map(reportJob),
                keywords: sub.keywords,
                postings,
                source: sub.source,
                subscriptionId,
                userId,
              })
              .returning({ id: cvReports.id });
            // oxlint-disable-next-line no-await-in-loop
            await tx
              .update(cvReportDeliveries)
              .set({ reportId: report.id })
              .where(
                inArray(
                  cvReportDeliveries.id,
                  batch.map((item) => item.id)
                )
              );
          }
        });
      } catch (error) {
        log.warn(
          { error, subscriptionId },
          "CV report accumulation failed; job delivery remains successful"
        );
      }
    },
  };
};
