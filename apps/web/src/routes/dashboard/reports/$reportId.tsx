import { MATCH_FACTORS } from "@kappa/contracts";
import type { CvReportType } from "@kappa/contracts";
import { createFileRoute, Link } from "@tanstack/react-router";

import {
  cvReportLabel,
  DeltaChip,
  GradeTile,
  reportWindow,
  scoreDelta,
} from "../../../components/cv-reports";
import { DashboardIcon } from "../../../components/dashboard-icon";
import type { DashboardIconName } from "../../../components/dashboard-icon";
import { InlineMarkdown, Markdown } from "../../../components/markdown";
import { FactorScore, GradeBadge } from "../../../components/score";
import { buttonVariants } from "../../../components/shadcn/button";
import { TrackControl } from "../../../components/track-control";
import {
  Button,
  InfoNote,
  LoadingNote,
  QueryError,
  Text,
  VStack,
} from "../../../components/ui";
import { fullDate } from "../../../lib/format";
import {
  useApplications,
  useCvReport,
  useCvReports,
} from "../../../lib/queries";

const SummaryList = ({
  icon,
  title,
  items,
}: {
  icon: DashboardIconName;
  title: string;
  items: readonly string[];
}) => (
  <section className="cv-summary-card">
    <h3>
      <DashboardIcon name={icon} size={18} />
      {title}
    </h3>
    {items.length > 0 ? (
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            <InlineMarkdown text={item} />
          </li>
        ))}
      </ul>
    ) : (
      <p className="app-muted">None identified.</p>
    )}
  </section>
);

const Hero = ({ report }: { report: CvReportType }) => (
  <section className="cv-report-hero" aria-label="Overall result">
    <GradeTile report={report} large />
    <div className="cv-report-hero-body">
      <h2>{cvReportLabel(report)}</h2>
      <div className="cv-report-hero-score">
        {report.score === null ? null : (
          <span>
            <strong>{report.score}</strong>/100
          </span>
        )}
        <DeltaChip
          delta={scoreDelta(report)}
          suffix={report.previous ? "vs previous" : undefined}
        />
        {report.status === "ready" && !report.previous ? (
          <span className="app-muted app-small">
            First report, no comparison yet
          </span>
        ) : null}
      </div>
    </div>
    <dl className="cv-report-meta">
      <div>
        <dt>
          <DashboardIcon name="calendar" size={16} />
          Created
        </dt>
        <dd>{fullDate(report.createdAt)}</dd>
      </div>
      <div>
        <dt>
          <DashboardIcon name="jobs" size={16} />
          Jobs
        </dt>
        <dd>
          {report.jobs.length} ·{" "}
          {report.trigger === "manual" ? "Manual" : "Scheduled"}
        </dd>
      </div>
      {report.cvFilename ? (
        <div>
          <dt>
            <DashboardIcon name="file" size={16} />
            CV
          </dt>
          <dd>
            {report.cvFilename}
            {report.cvUploadedAt ? ` · ${fullDate(report.cvUploadedAt)}` : ""}
          </dd>
        </div>
      ) : null}
    </dl>
  </section>
);

const Factors = ({ report }: { report: CvReportType }) => {
  const { factors } = report;
  if (!factors) {
    return null;
  }
  const previous = report.previous?.factors ?? null;
  const assessed = report.jobs.filter((job) => job.grade).length;
  return (
    <section className="cv-report-section" aria-labelledby="factors-title">
      <h2 id="factors-title">Score breakdown</h2>
      <div className="cv-factor-grid">
        {MATCH_FACTORS.map((factor) => {
          const { score } = factors[factor.key];
          return (
            <div className="cv-factor-card" key={factor.key}>
              <FactorScore
                large
                label={factor.label}
                score={score}
                weight={factor.weight}
                delta={
                  <DeltaChip
                    delta={previous ? score - previous[factor.key].score : null}
                  />
                }
              />
            </div>
          );
        })}
      </div>
      <p className="app-muted app-small">
        Averaged across {assessed} assessed job{assessed === 1 ? "" : "s"}, then
        weighted into the overall grade. Advisory only, not a hiring prediction.
      </p>
    </section>
  );
};

/** Older/newer neighbours in the same history the Home list shows. */
const ReportNav = ({ report }: { report: CvReportType }) => {
  const reports = useCvReports(true);
  const list = reports.data ?? [];
  const index = list.findIndex((item) => item.id === report.id);
  if (index === -1) {
    return null;
  }
  const newer = list[index - 1];
  const older = list[index + 1];
  return (
    <nav aria-label="Report history" className="cv-report-nav">
      {older ? (
        <Link
          params={{ reportId: String(older.id) }}
          to="/dashboard/reports/$reportId"
        >
          <span aria-hidden="true">←</span> {reportWindow(older)}
        </Link>
      ) : (
        <span />
      )}
      {newer ? (
        <Link
          params={{ reportId: String(newer.id) }}
          to="/dashboard/reports/$reportId"
        >
          {reportWindow(newer)} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </nav>
  );
};

const ReportJobs = ({ report }: { report: CvReportType }) => {
  const applications = useApplications(true);
  const statusFor = (url: string, source: string) =>
    applications.data?.find((row) => row.url === url && row.source === source)
      ?.status ?? null;
  return (
    <section className="cv-report-section" aria-labelledby="jobs-title">
      <h2 id="jobs-title">Jobs in this period</h2>
      <ol className="cv-report-jobs">
        {report.jobs.map((job, index) => (
          <li key={`${job.source}-${index}`}>
            <GradeBadge grade={job.grade} size="sm" />
            <div className="cv-report-job-body">
              <a href={job.url} rel="noopener noreferrer" target="_blank">
                {job.title}
                <DashboardIcon name="external" size={14} />
              </a>
              <p>
                {job.company} · {job.source}
                {report.status === "ready" && !job.grade
                  ? " · no description to assess"
                  : ""}
              </p>
            </div>
            {typeof job.seenJobId === "number" && applications.isSuccess ? (
              <TrackControl
                seenJobId={job.seenJobId}
                status={statusFor(job.url, job.source)}
                title={job.title}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
};

const ReportPage = () => {
  const { reportId } = Route.useParams();
  const query = useCvReport(Number(reportId), true);
  if (query.isPending) {
    return <LoadingNote>Loading CV report…</LoadingNote>;
  }
  if (query.isError) {
    return <QueryError error={query.error} />;
  }
  const report = query.data;
  const { summary } = report;
  return (
    <VStack gap={8}>
      <div className="cv-report-top">
        <nav aria-label="Breadcrumb" className="cv-breadcrumb">
          <Link to="/dashboard">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">CV report #{report.id}</span>
        </nav>
        <ReportNav report={report} />
      </div>
      <header className="cv-report-title">
        <DashboardIcon name="report" size={24} />
        <h1>{reportWindow(report)}</h1>
      </header>

      <Hero report={report} />

      {report.message ? <InfoNote>{report.message}</InfoNote> : null}
      {report.status === "pending" ? (
        <div className="cv-report-pending">
          <DashboardIcon name="clock" size={18} />
          <Text as="p" color="secondary">
            This report is being assessed. Check back shortly.
          </Text>
          <Button
            small
            variant="subtle"
            loading={query.isFetching}
            onClick={() => query.refetch()}
          >
            <DashboardIcon name="refresh" size={16} />
            Check status
          </Button>
        </div>
      ) : null}
      {report.status === "cv_required" ? (
        <Link className={buttonVariants()} to="/dashboard/settings">
          Upload CV
        </Link>
      ) : null}

      <Factors report={report} />

      {summary ? (
        <section className="cv-report-section" aria-labelledby="summary-title">
          <h2 id="summary-title">Review</h2>
          <div className="cv-fit-card">
            <h3>
              <DashboardIcon name="user" size={18} />
              How your CV matches
            </h3>
            <Markdown text={summary.candidateFit} />
          </div>
          <div className="cv-summary-grid">
            <SummaryList
              icon="target"
              title="What employers want"
              items={summary.employerRequirements}
            />
            <SummaryList
              icon="gap"
              title="Common gaps"
              items={summary.commonGaps}
            />
            <SummaryList
              icon="spark"
              title="Best-aligned roles"
              items={summary.suitableRoles}
            />
          </div>
        </section>
      ) : null}

      <ReportJobs report={report} />
    </VStack>
  );
};

export const Route = createFileRoute("/dashboard/reports/$reportId")({
  head: () => ({ meta: [{ title: "CV report | Kappa" }] }),
  component: ReportPage,
});
