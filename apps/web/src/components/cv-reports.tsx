import {
  CV_REPORT_PERIOD_DAYS,
  MATCH_GRADE_LABELS,
  cvSnapshotChanged,
} from "@kappa/contracts";
import type { CvReportListItemType } from "@kappa/contracts";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { apiMessage } from "../lib/api";
import { useCreateCvReport, useCvReports } from "../lib/queries";
import { QueryError } from "./api-feedback";
import { DashboardIcon } from "./dashboard-icon";
import { GradeBadge } from "./score";
import { Button, ErrorNote, HStack, LoadingNote, Text, VStack } from "./ui";

type ReportLabel = Pick<CvReportListItemType, "grade" | "status">;
type ReportWindow = Pick<CvReportListItemType, "windowStart" | "windowEnd">;
type ReportScore = Pick<CvReportListItemType, "score" | "previous">;
type ReportDelta = ReportScore & Pick<CvReportListItemType, "cvUploadedAt">;

export const cvReportLabel = (report: ReportLabel) => {
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
    year: "numeric",
  });

export const reportWindow = (report: ReportWindow) =>
  `${shortDate(report.windowStart)} – ${shortDate(report.windowEnd)}`;

/** Change versus the previous ready report, or null when there is none. */
export const scoreDelta = (report: ReportScore): number | null =>
  report.score !== null && report.previous
    ? report.score - report.previous.score
    : null;

export const deltaLabel = (report: ReportDelta): string | undefined => {
  if (!report.previous) {
    return undefined;
  }
  return cvSnapshotChanged(report) ? "vs previous CV" : "vs previous";
};

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
  report: Pick<CvReportListItemType, "grade" | "status">;
  large?: boolean;
}) => (
  <GradeBadge
    grade={report.grade}
    pending={report.status === "pending"}
    placeholder={report.status === "pending" ? "…" : "–"}
    size={large ? "lg" : "md"}
  />
);

const CvReportLink = ({ report }: { report: CvReportListItemType }) => (
  <Link
    className="cv-report-link"
    to="/dashboard/reports/$reportId"
    params={{ reportId: String(report.id) }}
  >
    <GradeTile report={report} />
    <span className="cv-report-link-body">
      <strong>{reportWindow(report)}</strong>
      <small>
        {report.jobCount} job{report.jobCount === 1 ? "" : "s"} ·{" "}
        {report.trigger === "manual" ? "Manual" : "Scheduled"} · #{report.id}
        {report.status === "ready" && cvSnapshotChanged(report)
          ? " · CV changed"
          : ""}
      </small>
    </span>
    <span className="cv-report-link-result">
      <span className="cv-report-result">{cvReportLabel(report)}</span>
      <DeltaChip delta={scoreDelta(report)} />
    </span>
  </Link>
);

export const CvReportList = () => {
  const [page, setPage] = useState(1);
  const reports = useCvReports(page);
  const create = useCreateCvReport();
  const navigate = useNavigate();
  const { data } = reports;
  const items = data?.reports ?? [];
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
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
      {reports.isSuccess && data?.total === 0 ? (
        <div className="cv-report-empty">
          <DashboardIcon name="report" size={24} />
          <Text as="p" color="secondary">
            No reports yet. Your first one appears {CV_REPORT_PERIOD_DAYS} days
            after your first personal job delivery.
          </Text>
        </div>
      ) : null}
      <ul className="cv-report-list">
        {items.map((report) => (
          <li key={report.id}>
            <CvReportLink report={report} />
          </li>
        ))}
      </ul>
      {data && data.total > data.pageSize ? (
        <HStack gap={2}>
          <Button
            small
            disabled={page <= 1}
            variant="subtle"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Text as="p" color="secondary" type="supporting">
            Page {data.page} of {totalPages}
          </Text>
          <Button
            small
            disabled={page >= totalPages}
            variant="subtle"
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </HStack>
      ) : null}
    </VStack>
  );
};
