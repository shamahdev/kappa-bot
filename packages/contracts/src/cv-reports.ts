import { Schema } from "effect";

import { MatchBreakdown, MatchGrade } from "./matching";

// Requester's batch contract: per-subscription, non-overlapping delivered jobs.
export const CV_REPORT_JOB_COUNT = 20;
export const CvReportSummary = Schema.Struct({
  candidateFit: Schema.String,
  commonGaps: Schema.Array(Schema.String),
  employerRequirements: Schema.Array(Schema.String),
  suitableRoles: Schema.Array(Schema.String),
});
export const decodeCvReportSummary = Schema.decodeUnknownSync(CvReportSummary);
export type CvReportSummaryType = typeof CvReportSummary.Type;

export const CvReportJob = Schema.Struct({
  company: Schema.String,
  grade: Schema.NullOr(MatchGrade),
  source: Schema.String,
  title: Schema.String,
  url: Schema.String,
});
export type CvReportJobType = typeof CvReportJob.Type;

export const CvReport = Schema.Struct({
  createdAt: Schema.String,
  cvFilename: Schema.NullOr(Schema.String),
  cvUploadedAt: Schema.NullOr(Schema.String),
  factors: Schema.NullOr(MatchBreakdown),
  grade: Schema.NullOr(MatchGrade),
  id: Schema.Number,
  jobs: Schema.Array(CvReportJob),
  keywords: Schema.NullOr(Schema.String),
  message: Schema.NullOr(Schema.String),
  source: Schema.String,
  status: Schema.Literal("pending", "ready", "cv_required", "unavailable"),
  subscriptionId: Schema.Number,
  summary: Schema.NullOr(CvReportSummary),
});
export const decodeCvReport = Schema.decodeUnknownSync(CvReport);
export type CvReportType = typeof CvReport.Type;
export const CvReportsResponse = Schema.Struct({
  reports: Schema.Array(CvReport),
});
