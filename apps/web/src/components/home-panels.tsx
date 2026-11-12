import {
  APPLICATION_STATUS_LABELS,
  BOARD_STATUSES,
  CV_REPORT_PERIOD_DAYS,
  MATCH_GRADE_LABELS,
  safeHttpUrl,
} from "@kappa/contracts";
import type { CvReportListItemType } from "@kappa/contracts";
import { Link } from "@tanstack/react-router";

import { fullDate, relativeDay } from "../lib/format";
import { useApplications, useCvReports, useJobs } from "../lib/queries";
import { DeltaChip, deltaLabel, reportWindow, scoreDelta } from "./cv-reports";
import { DashboardIcon } from "./dashboard-icon";
import { GradeBadge } from "./score";
import { TrackControl } from "./track-control";
import { LoadingNote, QueryError } from "./ui";

import "./home-panels.css";

// The existing Jobs page size: Home looks at the same first page of deliveries.
const LATEST_DELIVERIES = { page: 1, pageSize: 20, scope: "dm" } as const;

const latestStatusNote = (
  report: CvReportListItemType | undefined
): string | null => {
  if (!report) {
    return null;
  }
  if (report.status === "pending") {
    return `${reportWindow(report)} is being assessed.`;
  }
  if (report.status === "cv_required") {
    return "Upload a CV to assess your latest report.";
  }
  if (
    report.status === "unavailable" ||
    (report.status === "ready" && !report.grade)
  ) {
    return "Your latest report could not be assessed.";
  }
  return null;
};

export const LatestReportPanel = () => {
  const reports = useCvReports(true, 1, 5);
  if (reports.isPending) {
    return <LoadingNote>Loading your latest report…</LoadingNote>;
  }
  if (reports.isError) {
    return <QueryError error={reports.error} />;
  }
  const list = reports.data?.reports ?? [];
  const [latest] = list;
  const latestReady = list.find(
    (report) => report.status === "ready" && report.grade
  );
  const shown =
    latest?.status === "ready" && latest.grade ? latest : latestReady;
  const statusNote = latestStatusNote(latest);
  return (
    <section className="home-panel" aria-labelledby="home-report-title">
      <header className="home-panel-head">
        <h2 id="home-report-title">Latest CV report</h2>
        {latest ? (
          <Link
            className="home-panel-link"
            params={{ reportId: String(latest.id) }}
            to="/dashboard/reports/$reportId"
          >
            Open report
          </Link>
        ) : null}
      </header>
      {shown?.grade ? (
        <div className="home-report">
          <GradeBadge grade={shown.grade} size="md" />
          <div>
            <p className="home-report-label">
              {MATCH_GRADE_LABELS[shown.grade]}
              {shown.score === null ? null : (
                <span className="home-report-score"> · {shown.score}/100</span>
              )}
            </p>
            <p className="home-report-period">
              {reportWindow(shown)} · {shown.jobCount} jobs
            </p>
          </div>
          <DeltaChip delta={scoreDelta(shown)} suffix={deltaLabel(shown)} />
        </div>
      ) : (
        <p className="app-muted">
          No completed report yet. One is created every {CV_REPORT_PERIOD_DAYS}{" "}
          days from the jobs delivered to your DMs.
        </p>
      )}
      {statusNote ? (
        <p className="home-note">
          <DashboardIcon name="clock" size={16} />
          {statusNote}
        </p>
      ) : null}
    </section>
  );
};

export const PipelinePanel = () => {
  const applications = useApplications(true);
  if (applications.isPending) {
    return <LoadingNote>Loading your applications…</LoadingNote>;
  }
  if (applications.isError) {
    return <QueryError error={applications.error} />;
  }
  const count = (status: string) =>
    applications.data.filter((row) => row.status === status).length;
  return (
    <section className="home-panel" aria-labelledby="home-pipeline-title">
      <header className="home-panel-head">
        <h2 id="home-pipeline-title">Applications</h2>
        <Link className="home-panel-link" to="/dashboard/jobs">
          Open board
        </Link>
      </header>
      <ul className="home-pipeline">
        {BOARD_STATUSES.map((status) => (
          <li key={status}>
            <Link data-status={status} to="/dashboard/jobs">
              <strong>{count(status)}</strong>
              <span>
                <span aria-hidden="true" className="home-dot" />
                {APPLICATION_STATUS_LABELS[status]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export const StrongMatchesPanel = () => {
  const jobs = useJobs(true, LATEST_DELIVERIES);
  const strong =
    jobs.data?.jobs.filter(
      (job) => job.matchGrade === "A" || job.matchGrade === "B"
    ) ?? [];
  return (
    <section className="home-panel" aria-labelledby="home-matches-title">
      <header className="home-panel-head">
        <h2 id="home-matches-title">Strong matches</h2>
        <Link className="home-panel-link" to="/dashboard/jobs/list">
          All jobs
        </Link>
      </header>
      <p className="app-muted app-small">
        A and B grades among your latest deliveries.
      </p>
      {jobs.isPending ? <LoadingNote>Loading matches…</LoadingNote> : null}
      {jobs.isError ? <QueryError error={jobs.error} /> : null}
      {jobs.isSuccess && strong.length === 0 ? (
        <p className="home-empty">
          No A or B matches in your latest deliveries yet.
        </p>
      ) : null}
      {strong.length > 0 ? (
        <ul className="home-matches">
          {strong.map((job) => {
            const href = safeHttpUrl(job.url);
            return (
              <li key={job.id}>
                <GradeBadge grade={job.matchGrade} size="sm" />
                <div className="home-match-body">
                  {href ? (
                    <a href={href} rel="noopener noreferrer" target="_blank">
                      {job.title ?? "Untitled posting"}
                    </a>
                  ) : (
                    <span>{job.title ?? "Untitled posting"}</span>
                  )}
                  <p>
                    {[job.company, job.location].filter(Boolean).join(" · ")}
                    {" · "}
                    <time
                      dateTime={job.firstSeenAt}
                      title={fullDate(job.firstSeenAt)}
                    >
                      {relativeDay(job.firstSeenAt)}
                    </time>
                  </p>
                </div>
                <TrackControl
                  seenJobId={job.id}
                  status={job.application?.status ?? null}
                  title={job.title ?? "this job"}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
};
