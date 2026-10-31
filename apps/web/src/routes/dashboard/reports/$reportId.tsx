import { CV_REPORT_JOB_COUNT, MATCH_FACTORS } from "@kappa/contracts";
import { createFileRoute, Link } from "@tanstack/react-router";

import { cvReportLabel } from "../../../components/cv-reports";
import {
  InfoNote,
  LoadingNote,
  PageHeader,
  QueryError,
  Text,
  VStack,
} from "../../../components/ui";
import { useCvReport } from "../../../lib/queries";

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
  const { summary, factors } = report;
  return (
    <VStack gap={6}>
      <Link className="app-back" to="/dashboard">
        Back to Home
      </Link>
      <PageHeader
        title="CV report"
        description={`${report.keywords ?? "Personal subscription"} · ${report.jobs.length} delivered jobs · Report #${report.id}`}
      />
      <div className="cv-report-overview">
        <h2>{cvReportLabel(report)}</h2>
        <Text as="p" color="secondary" type="supporting">
          Created{" "}
          {new Date(report.createdAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </Text>
        {report.cvFilename ? (
          <Text as="p" color="secondary" type="supporting">
            CV: {report.cvFilename}
            {report.cvUploadedAt
              ? ` · uploaded ${new Date(report.cvUploadedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`
              : ""}
          </Text>
        ) : null}
        <Text as="p" color="secondary" type="supporting">
          {report.status === "ready"
            ? "Assessed against the CV current when this report was generated. This report does not change when you replace your CV."
            : "This batch has no completed CV assessment."}
        </Text>
      </div>
      {report.message ? <InfoNote>{report.message}</InfoNote> : null}
      {report.status === "cv_required" ? (
        <Link className="app-button" to="/dashboard/settings">
          Upload CV
        </Link>
      ) : null}
      {factors ? (
        <section
          className="cv-report-section"
          aria-labelledby="report-factors-title"
        >
          <h2 id="report-factors-title">
            Average match across {CV_REPORT_JOB_COUNT} jobs
          </h2>
          <dl className="cv-report-factors">
            {MATCH_FACTORS.map((factor) => (
              <div key={factor.key}>
                <dt>
                  {factor.label}
                  <span>{factor.weight}% weight</span>
                </dt>
                <dd>
                  <strong>
                    {Number(factors[factor.key].score.toFixed(1))}/100
                  </strong>
                  <p>{factors[factor.key].reason}</p>
                </dd>
              </div>
            ))}
          </dl>
          <p className="app-muted app-small">
            Each factor is averaged across all 20 jobs, then weighted to produce
            the overall grade. An advisory comparison, not a hiring prediction.
          </p>
        </section>
      ) : null}
      {summary ? (
        <div className="cv-report-summary">
          <section className="cv-report-section">
            <h2>What employers are looking for</h2>
            <ul>
              {summary.employerRequirements.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="cv-report-section">
            <h2>How your CV matches</h2>
            <p>{summary.candidateFit}</p>
          </section>
          <section className="cv-report-section">
            <h2>Common gaps</h2>
            <ul>
              {summary.commonGaps.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="cv-report-section">
            <h2>Best-aligned roles</h2>
            <ul>
              {summary.suitableRoles.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
      <section
        className="cv-report-section"
        aria-labelledby="report-jobs-title"
      >
        <h2 id="report-jobs-title">Jobs included in this batch</h2>
        <ol className="cv-report-jobs">
          {report.jobs.map((job, index) => (
            <li key={`${job.source}-${index}`}>
              <div>
                <a href={job.url} rel="noopener noreferrer" target="_blank">
                  {job.title}
                </a>
                <p>
                  {job.company} · {job.source}
                </p>
              </div>
              <span>{job.grade ?? "Not assessed"}</span>
            </li>
          ))}
        </ol>
      </section>
    </VStack>
  );
};

export const Route = createFileRoute("/dashboard/reports/$reportId")({
  head: () => ({ meta: [{ title: "CV report | Kappa" }] }),
  component: ReportPage,
});
