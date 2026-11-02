import { Schema } from "effect";

import { MatchBreakdown, MatchGrade } from "./matching";

// Requester's contract: one personal report per user covering every job
// delivered to their DMs during each 3-day window (or since the previous
// report when triggered manually from the dashboard).
export const CV_REPORT_PERIOD_DAYS = 3;
export const CV_REPORT_PERIOD_MS = CV_REPORT_PERIOD_DAYS * 24 * 60 * 60 * 1000;
// Requester-chosen word caps: the fit paragraph and each list item.
export const CV_REPORT_FIT_MAX_WORDS = 60;
export const CV_REPORT_ITEM_MAX_WORDS = 12;

/** Keep at most `max` whitespace-separated words, marking a cut with an ellipsis. */
export const clampWords = (text: string, max: number): string => {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (words.length <= max) {
    return words.join(" ");
  }
  return `${words
    .slice(0, max)
    .join(" ")
    .replace(/[,;:.\s-]+$/u, "")}…`;
};

export const CvReportSummary = Schema.Struct({
  candidateFit: Schema.String,
  commonGaps: Schema.Array(Schema.String),
  employerRequirements: Schema.Array(Schema.String),
  suitableRoles: Schema.Array(Schema.String),
});
export const decodeCvReportSummary = Schema.decodeUnknownSync(CvReportSummary);
export type CvReportSummaryType = typeof CvReportSummary.Type;

/** Enforce the word caps deterministically, whatever the model returned. */
export const clampCvReportSummary = (
  summary: CvReportSummaryType
): CvReportSummaryType => {
  const items = (list: readonly string[]) =>
    list
      .map((item) => clampWords(item, CV_REPORT_ITEM_MAX_WORDS))
      .filter(Boolean);
  return {
    candidateFit: clampWords(summary.candidateFit, CV_REPORT_FIT_MAX_WORDS),
    commonGaps: items(summary.commonGaps),
    employerRequirements: items(summary.employerRequirements),
    suitableRoles: items(summary.suitableRoles),
  };
};

export const CvReportJob = Schema.Struct({
  company: Schema.String,
  // null: the posting had no description to assess.
  grade: Schema.NullOr(MatchGrade),
  // The delivered job it came from, so the dashboard can track it. Reports
  // created before this field existed omit it.
  seenJobId: Schema.optional(Schema.NullOr(Schema.Number)),
  source: Schema.String,
  title: Schema.String,
  url: Schema.String,
});
export type CvReportJobType = typeof CvReportJob.Type;

export const CvReportStatus = Schema.Literal(
  "pending",
  "ready",
  "cv_required",
  "unavailable"
);
export const CvReportTrigger = Schema.Literal("scheduled", "manual");

/** The previous ready report, so clients can show +/- change. */
export const CvReportBaseline = Schema.Struct({
  factors: Schema.NullOr(MatchBreakdown),
  grade: MatchGrade,
  id: Schema.Number,
  score: Schema.Number,
});
export type CvReportBaselineType = typeof CvReportBaseline.Type;

export const CvReport = Schema.Struct({
  createdAt: Schema.String,
  cvFilename: Schema.NullOr(Schema.String),
  cvUploadedAt: Schema.NullOr(Schema.String),
  factors: Schema.NullOr(MatchBreakdown),
  grade: Schema.NullOr(MatchGrade),
  id: Schema.Number,
  jobs: Schema.Array(CvReportJob),
  message: Schema.NullOr(Schema.String),
  previous: Schema.NullOr(CvReportBaseline),
  score: Schema.NullOr(Schema.Number),
  status: CvReportStatus,
  summary: Schema.NullOr(CvReportSummary),
  trigger: CvReportTrigger,
  windowEnd: Schema.String,
  windowStart: Schema.String,
});
export const decodeCvReport = Schema.decodeUnknownSync(CvReport);
export type CvReportType = typeof CvReport.Type;
export const CvReportsResponse = Schema.Struct({
  reports: Schema.Array(CvReport),
});
