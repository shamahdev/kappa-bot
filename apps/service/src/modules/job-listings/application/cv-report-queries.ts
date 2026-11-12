import {
  clampCvReportSummary,
  decodeCvReport,
  decodeCvReportListItem,
  weightedMatchScore,
} from "@kappa/contracts";
import type { CvReportBaselineType, MatchGradeType } from "@kappa/contracts";
import { cvReports, seenJobs } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, count, desc, eq, inArray, lt } from "drizzle-orm";

type ReportRow = typeof cvReports.$inferSelect;

/** Legacy ready rows predate the stored score; derive it the same way. */
const scoreOf = (row: ReportRow): number | null => {
  if (row.score !== null) {
    return row.score;
  }
  return row.status === "ready" && row.factors
    ? Math.round(weightedMatchScore(row.factors))
    : null;
};

const baselineOf = (
  row: ReportRow | undefined
): CvReportBaselineType | null => {
  const score = row ? scoreOf(row) : null;
  return row?.grade && score !== null
    ? {
        cvUploadedAt: row.cvUploadedAt?.toISOString() ?? null,
        factors: row.factors,
        grade: row.grade as MatchGradeType,
        id: row.id,
        score,
      }
    : null;
};

/** Serialize only owner-facing report content, never raw postings or CV text. */
export const reportDto = (
  row: ReportRow,
  previous?: ReportRow,
  liveSeenIds?: Set<number>
) =>
  decodeCvReport({
    createdAt: row.createdAt.toISOString(),
    cvFilename: row.cvFilename,
    cvUploadedAt: row.cvUploadedAt?.toISOString() ?? null,
    factors: row.factors,
    grade: row.grade,
    id: row.id,
    jobs: row.jobs.map((job) => ({
      ...job,
      trackable:
        typeof job.seenJobId === "number"
          ? (liveSeenIds?.has(job.seenJobId) ?? job.trackable)
          : undefined,
    })),
    message: row.message,
    previous: baselineOf(previous),
    score: scoreOf(row),
    status: row.status,
    summary: row.summary ? clampCvReportSummary(row.summary) : null,
    trigger: row.trigger,
    windowEnd: row.windowEnd.toISOString(),
    windowStart: row.windowStart.toISOString(),
  });

export const reportListItem = (row: ReportRow, previous?: ReportRow) =>
  decodeCvReportListItem({
    createdAt: row.createdAt.toISOString(),
    cvUploadedAt: row.cvUploadedAt?.toISOString() ?? null,
    grade: row.grade,
    id: row.id,
    jobCount: row.jobs.length,
    message: row.message,
    previous: baselineOf(previous),
    score: scoreOf(row),
    status: row.status,
    trigger: row.trigger,
    windowEnd: row.windowEnd.toISOString(),
    windowStart: row.windowStart.toISOString(),
  });

/**
 * Newest-first rows; each row compares with the closest older ready report.
 * The optional baseline is the closest ready report older than the page, so
 * the oldest row on a page still gets a correct comparison.
 */
export const reportListDtos = (rows: ReportRow[], baseline?: ReportRow) => {
  const previousById = new Map<number, ReportRow | undefined>();
  let lastReady = baseline;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }
    previousById.set(row.id, lastReady);
    if (row.status === "ready") {
      lastReady = row;
    }
  }
  return rows.map((row) => reportListItem(row, previousById.get(row.id)));
};

export const createCvReportQueries = (db: Database) => ({
  async get(userId: string, reportId: number) {
    const [row] = await db
      .select()
      .from(cvReports)
      .where(and(eq(cvReports.id, reportId), eq(cvReports.userId, userId)));
    if (!row) {
      return null;
    }
    const [previous] = await db
      .select()
      .from(cvReports)
      .where(
        and(
          eq(cvReports.userId, userId),
          eq(cvReports.status, "ready"),
          lt(cvReports.windowEnd, row.windowEnd)
        )
      )
      .orderBy(desc(cvReports.windowEnd), desc(cvReports.id))
      .limit(1);
    // Retention and subscription deletion can remove the seen_jobs row while
    // the report snapshot remains; tell the client which handles are live.
    const seenIds = row.jobs.flatMap((job) =>
      typeof job.seenJobId === "number" ? [job.seenJobId] : []
    );
    let liveSeenIds = new Set<number>();
    if (seenIds.length > 0) {
      const liveRows = await db
        .select({ id: seenJobs.id })
        .from(seenJobs)
        .where(inArray(seenJobs.id, seenIds));
      liveSeenIds = new Set(liveRows.map((seen) => seen.id));
    }
    return reportDto(row, previous, liveSeenIds);
  },
  async list(userId: string, page = 1, pageSize = 50) {
    const [totalRow] = await db
      .select({ total: count() })
      .from(cvReports)
      .where(eq(cvReports.userId, userId));
    const rows = await db
      .select()
      .from(cvReports)
      .where(eq(cvReports.userId, userId))
      .orderBy(desc(cvReports.windowEnd), desc(cvReports.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const oldest = rows.at(-1);
    let baseline: ReportRow | undefined;
    if (oldest) {
      [baseline] = await db
        .select()
        .from(cvReports)
        .where(
          and(
            eq(cvReports.userId, userId),
            eq(cvReports.status, "ready"),
            lt(cvReports.windowEnd, oldest.windowEnd)
          )
        )
        .orderBy(desc(cvReports.windowEnd), desc(cvReports.id))
        .limit(1);
    }
    return {
      page,
      pageSize,
      reports: reportListDtos(rows, baseline),
      total: totalRow?.total ?? 0,
    };
  },
});
