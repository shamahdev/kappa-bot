import {
  clampCvReportSummary,
  decodeCvReport,
  weightedMatchScore,
} from "@kappa/contracts";
import type { CvReportBaselineType, MatchGradeType } from "@kappa/contracts";
import { cvReports } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, desc, eq, lt } from "drizzle-orm";

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
        factors: row.factors,
        grade: row.grade as MatchGradeType,
        id: row.id,
        score,
      }
    : null;
};

/** Serialize only owner-facing report content, never raw postings or CV text. */
export const reportDto = (row: ReportRow, previous?: ReportRow) =>
  decodeCvReport({
    createdAt: row.createdAt.toISOString(),
    cvFilename: row.cvFilename,
    cvUploadedAt: row.cvUploadedAt?.toISOString() ?? null,
    factors: row.factors,
    grade: row.grade,
    id: row.id,
    jobs: row.jobs,
    message: row.message,
    previous: baselineOf(previous),
    score: scoreOf(row),
    status: row.status,
    summary: row.summary ? clampCvReportSummary(row.summary) : null,
    trigger: row.trigger,
    windowEnd: row.windowEnd.toISOString(),
    windowStart: row.windowStart.toISOString(),
  });

/** Newest first; each report is compared with the closest older ready report. */
export const reportDtos = (rows: ReportRow[]) =>
  rows.map((row, index) =>
    reportDto(
      row,
      rows.slice(index + 1).find((older) => older.status === "ready")
    )
  );

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
    return reportDto(row, previous);
  },
  async list(userId: string) {
    const rows = await db
      .select()
      .from(cvReports)
      .where(eq(cvReports.userId, userId))
      .orderBy(desc(cvReports.windowEnd), desc(cvReports.id));
    return reportDtos(rows);
  },
});
