import { CV_REPORT_PERIOD_DAYS, MATCH_GRADE_LABELS } from "@kappa/contracts";
import type { CvReportType } from "@kappa/contracts";
import { Link, useNavigate } from "@tanstack/react-router";

import { apiMessage, useCreateCvReport, useCvReports } from "../lib/queries";
import { DashboardIcon } from "./dashboard-icon";
import { Button, ErrorNote, LoadingNote, QueryError, Text, VStack } from "./ui";

export const cvReportLabel = (report: CvReportType) => {
  if (report.grade) {
    return MATCH_GRADE_LABELS[report.grade];
  }
  if (report.status === "cv_required") {
    return "CV required";
  }
  if (report.status === "pending") {
    return "Processing";
  }
  return "Assessment unavailable";
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

export const reportWindow = (report: CvReportType) =>
  `${shortDate(report.windowStart)} – ${shortDate(report.windowEnd)}`;

/** Change versus the previous ready report, or null when there is none. */
export const scoreDelta = (report: CvReportType): number | null =>
  report.score !== null && report.previous
    ? report.score - report.previous.score
    : null;

export const formatDelta = (delta: number) => {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded > 0) {
    return `+${rounded}`;
  }
  return rounded < 0 ? `−${Math.abs(rounded)}` : "±0";
};

export const DeltaChip = ({
  delta,
  suffix,
}: {
  delta: number | null;
  suffix?: string;
}) => {
  if (delta === null) {
    return null;
  }
  const rounded = Math.round(delta * 10) / 10;
  let tone = "flat";
  if (rounded > 0) {
    tone = "up";
  } else if (rounded < 0) {
    tone = "down";
  }
  return (
    <span className={`cv-delta ${tone}`}>
      {tone === "flat" ? null : (
        <DashboardIcon
          name={tone === "up" ? "trendUp" : "trendDown"}
          size={14}
        />
      )}
      {formatDelta(rounded)}
      {suffix ? <span className="cv-delta-suffix">{suffix}</span> : null}
    </span>
  );
};

export const GradeTile = ({
  report,
  large = false,
}: {
  report: CvReportType;
  large?: boolean;
}) => {
  let content = report.grade ?? "–";
  if (report.status === "pending") {
    content = "…";
  }
  return (
    <span
      aria-hidden="true"
      className={`cv-grade-tile grade-${report.grade ?? "none"} ${large ? "large" : ""}`}
    >
      {content}
    </span>
  );
};

const CvReportLink = ({ report }: { report: CvReportType }) => (
  <Link
    className="cv-report-link"
    to="/dashboard/reports/$reportId"
    params={{ reportId: String(report.id) }}
  >
    <GradeTile report={report} />
    <span className="cv-report-link-body">
      <strong>{reportWindow(report)}</strong>
      <small>
        {report.jobs.length} job{report.jobs.length === 1 ? "" : "s"} ·{" "}
        {report.trigger === "manual" ? "Manual" : "Scheduled"} · #{report.id}
      </small>
    </span>
    <span className="cv-report-link-result">
      <span className="cv-report-result">{cvReportLabel(report)}</span>
      <DeltaChip delta={scoreDelta(report)} />
    </span>
  </Link>
);

export const CvReportList = () => {
  const reports = useCvReports(true);
  const create = useCreateCvReport();
  const navigate = useNavigate();
  return (
    <VStack gap={4}>
      <div className="cv-report-toolbar">
        <Text as="p" color="secondary">
          A report is created every {CV_REPORT_PERIOD_DAYS} days from all jobs
          delivered to your DMs. Create one now to review jobs since your last
          report.
        </Text>
        <Button
          small
          loading={create.isPending}
          onClick={() =>
            create.mutate(undefined, {
              onSuccess: (report) =>
                navigate({
                  params: { reportId: String(report.id) },
                  to: "/dashboard/reports/$reportId",
                }),
            })
          }
        >
          <DashboardIcon name="plus" size={16} />
          Create report now
        </Button>
      </div>
      {create.isError ? (
        <ErrorNote>{apiMessage(create.error)}</ErrorNote>
      ) : null}
      {reports.isPending ? (
        <LoadingNote>Loading CV reports…</LoadingNote>
      ) : null}
      {reports.isError ? <QueryError error={reports.error} /> : null}
      {reports.isSuccess && reports.data.length === 0 ? (
        <div className="cv-report-empty">
          <DashboardIcon name="report" size={24} />
          <Text as="p" color="secondary">
            No reports yet. Your first one appears {CV_REPORT_PERIOD_DAYS} days
            after your first personal job delivery.
          </Text>
        </div>
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
