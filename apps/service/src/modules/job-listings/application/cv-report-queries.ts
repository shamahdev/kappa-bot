import { decodeCvReport } from "@kappa/contracts";
import { cvReports } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, desc, eq } from "drizzle-orm";

/** Serialize only owner-facing report content, never raw postings or CV text. */
export const reportDto = (row: typeof cvReports.$inferSelect) =>
  decodeCvReport({
    createdAt: row.createdAt.toISOString(),
    cvFilename: row.cvFilename,
    cvUploadedAt: row.cvUploadedAt?.toISOString() ?? null,
    factors: row.factors,
    grade: row.grade,
    id: row.id,
    jobs: row.jobs,
    keywords: row.keywords,
    message: row.message,
    source: row.source,
    status: row.status,
    subscriptionId: row.subscriptionId,
    summary: row.summary,
  });

export const createCvReportQueries = (db: Database) => ({
  async get(userId: string, reportId: number) {
    const [row] = await db
      .select()
      .from(cvReports)
      .where(and(eq(cvReports.id, reportId), eq(cvReports.userId, userId)));
    return row ? reportDto(row) : null;
  },
  async list(userId: string) {
    const rows = await db
      .select()
      .from(cvReports)
      .where(eq(cvReports.userId, userId))
      .orderBy(desc(cvReports.createdAt), desc(cvReports.id));
    return rows.map(reportDto);
  },
});
