import { CV_REPORT_JOB_COUNT, MATCH_GRADE_LABELS } from "@kappa/contracts";
import type { CvReportType } from "@kappa/contracts";
import { Link } from "@tanstack/react-router";

import { useCvReports } from "../lib/queries";
import { LoadingNote, QueryError, Text, VStack } from "./ui";

export const cvReportLabel = (report: CvReportType) => {
  if (report.grade) {
    return `${report.grade} — ${MATCH_GRADE_LABELS[report.grade]}`;
  }
  if (report.status === "cv_required") {
    return "CV required";
  }
  if (report.status === "pending") {
    return "Processing";
  }
  return "Assessment unavailable";
};

const CvReportLink = ({ report }: { report: CvReportType }) => (
  <Link
    className="cv-report-link"
    to="/dashboard/reports/$reportId"
    params={{ reportId: String(report.id) }}
  >
    <span>
      <strong>{report.keywords ?? "Personal subscription"}</strong>
      <small>
        {CV_REPORT_JOB_COUNT} jobs · Report #{report.id} ·{" "}
        {new Date(report.createdAt).toLocaleDateString(undefined, {
          dateStyle: "medium",
        })}
      </small>
    </span>
    <span className="cv-report-result">{cvReportLabel(report)}</span>
  </Link>
);

export const CvReportList = () => {
  const reports = useCvReports(true);
  return (
    <VStack gap={4}>
      {reports.isPending ? (
        <LoadingNote>Loading CV reports…</LoadingNote>
      ) : null}
      {reports.isError ? <QueryError error={reports.error} /> : null}
      {reports.isSuccess && reports.data.length === 0 ? (
        <Text as="p" color="secondary">
          A report appears after every {CV_REPORT_JOB_COUNT} delivered jobs in a
          personal subscription.
        </Text>
      ) : null}
      <ul className="cv-report-list">
        {(reports.data ?? []).map((report) => (
          <li key={report.id}>
            <CvReportLink report={report} />
          </li>
        ))}
      </ul>
    </VStack>
  );
};
