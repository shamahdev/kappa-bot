import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  MATCH_FACTORS,
  SUBSCRIPTION_SOURCES,
} from "@kappa/contracts";
import type { ApplicationStatusType, JobDtoType } from "@kappa/contracts";

import type { SubscriptionDtoType } from "../lib/api";
import { apiMessage, useTrackApplication } from "../lib/queries";
import { ALL_SOURCES, useJobsTable } from "../lib/use-jobs-table";
import type { JobsBase } from "../lib/use-jobs-table";
import { DashboardIcon } from "./dashboard-icon";
import { Markdown } from "./markdown";
import { FactorScore, GradeChip } from "./score";
import { formatDate } from "./subscriptions";
import {
  Badge,
  Button,
  EmptyList,
  HStack,
  LoadingNote,
  Modal,
  QueryError,
  Select,
  Text,
  TextInput,
  VStack,
} from "./ui";

import styles from "./data-views.module.css";

const ALL_SUBSCRIPTIONS = "All subscriptions";
const CONCRETE_SOURCES = SUBSCRIPTION_SOURCES.filter(
  (source) => source !== "all"
);
const subLabel = (sub: SubscriptionDtoType): string =>
  `#${sub.id}, ${sub.source}, ${sub.keywords ?? "—"}`;

const MatchCell = ({ job }: { job: JobDtoType }) => {
  const breakdown = job.matchBreakdown;
  if (!job.matchGrade) {
    return (
      <Text color="secondary" type="supporting">
        Not assessed
      </Text>
    );
  }
  return (
    <div className={styles.matchCell}>
      <GradeChip grade={job.matchGrade} />
      {breakdown ? (
        <details className={styles.matchDetails}>
          <summary>
            Breakdown
            <DashboardIcon name="chevronDown" size={14} />
          </summary>
          <div className={styles.matchFactors}>
            {MATCH_FACTORS.map((factor) => (
              <FactorScore
                key={factor.key}
                label={factor.label}
                reason={breakdown[factor.key].reason}
                score={breakdown[factor.key].score}
                weight={factor.weight}
              />
            ))}
            <p className="app-muted app-small">
              Advisory CV match, not a hiring prediction.
            </p>
          </div>
        </details>
      ) : (
        <Text color="secondary" type="supporting">
          Historical grade; no breakdown.
        </Text>
      )}
    </div>
  );
};

const TRACK_FIRST: readonly ApplicationStatusType[] = ["bookmark", "applied"];

/** One control per row: untracked rows offer Bookmark/Applied; tracked rows any status. */
export const TrackCell = ({ job }: { job: JobDtoType }) => {
  const track = useTrackApplication();
  const { application } = job;
  const current = application?.status ?? null;
  const options = current ? APPLICATION_STATUSES : TRACK_FIRST;
  return (
    <div className={styles.trackCell}>
      <div
        className={`${styles.trackControl} ${current ? "" : styles.untracked}`}
        data-status={current ?? "none"}
      >
        <span aria-hidden="true" className={styles.statusDot} />
        <select
          aria-label={`Tracking status for ${job.title ?? "this job"}`}
          disabled={track.isPending}
          onChange={(event) => {
            const status = event.target.value as ApplicationStatusType;
            if (status && status !== current) {
              track.mutate({ seenJobId: job.id, status });
            }
          }}
          value={current ?? ""}
        >
          {current ? null : <option value="">Track job</option>}
          {options.map((status) => (
            <option key={status} value={status}>
              {APPLICATION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <DashboardIcon name="chevronDown" size={14} />
      </div>
      {track.isError ? (
        <p className={styles.trackError} role="alert">
          {apiMessage(track.error)}
        </p>
      ) : null}
    </div>
  );
};

const JobCell = ({ job }: { job: JobDtoType }) => (
  <div className={styles.jobCell}>
    <a
      className={styles.jobLink}
      href={job.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      {job.title ?? "Untitled posting"}
    </a>
    <p className={styles.jobCompany}>
      {[job.company, job.location].filter(Boolean).join(" · ") || "—"}
    </p>
    <div className={styles.meta}>
      <Badge>{job.source}</Badge>
      <Text color="secondary" type="supporting">
        Delivered {formatDate(job.firstSeenAt)}
      </Text>
    </div>
  </div>
);

const JobsHead = ({ personal }: { personal: boolean }) => (
  <thead>
    <tr>
      <th className={styles.colJob} scope="col">
        Job
      </th>
      {personal ? (
        <>
          <th className={styles.colMatch} scope="col">
            Match
          </th>
          <th className={styles.colTrack} scope="col">
            Tracking
          </th>
        </>
      ) : null}
      <th className={styles.colSummary} scope="col">
        <span className="sr-only">Summary</span>
      </th>
    </tr>
  </thead>
);

const JobRow = ({
  job,
  personal,
  onSummary,
}: {
  job: JobDtoType;
  personal: boolean;
  onSummary: (id: number) => void;
}) => (
  <tr>
    <td data-label="Job">
      <JobCell job={job} />
    </td>
    {personal ? (
      <>
        <td data-label="Match">
          <MatchCell job={job} />
        </td>
        <td data-label="Tracking">
          <TrackCell job={job} />
        </td>
      </>
    ) : null}
    <td data-label="Summary">
      {job.aiSummary ? (
        <Button onClick={() => onSummary(job.id)} small variant="subtle">
          <DashboardIcon name="file" size={14} />
          Summary
        </Button>
      ) : (
        <Text color="secondary" type="supporting">
          No summary
        </Text>
      )}
    </td>
  </tr>
);

const Pager = ({
  page,
  totalPages,
  total,
  busy,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  busy: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) => (
  <div className={styles.pager}>
    <div className={styles.meta}>
      <Text as="span" color="secondary" type="supporting">
        Page {page} of {totalPages}
      </Text>
      <Text as="span" color="secondary" type="supporting">
        {total} job{total === 1 ? "" : "s"}
      </Text>
    </div>
    <HStack gap={2} wrap="wrap">
      <Button
        disabled={page <= 1 || busy}
        onClick={onPrevious}
        small
        variant="subtle"
      >
        Previous
      </Button>
      <Button
        disabled={page >= totalPages || busy}
        onClick={onNext}
        small
        variant="subtle"
      >
        Next
      </Button>
    </HStack>
  </div>
);

export const JobsTable = ({
  base,
  subscriptions,
}: {
  base: JobsBase;
  subscriptions: readonly SubscriptionDtoType[];
}) => {
  const {
    q,
    setQ,
    source,
    setSource,
    subscriptionId,
    selectSubscription,
    page,
    previousPage,
    nextPage,
    expandedSummaryId,
    toggleSummary,
    jobs,
    total,
    totalPages,
    filtered,
    clearFilters,
  } = useJobsTable(base);
  const personal = "scope" in base;
  const closeSummary = () => {
    if (expandedSummaryId !== null) {
      toggleSummary(expandedSummaryId);
    }
  };
  const expandedJob = jobs.data?.jobs.find(
    (job) => job.id === expandedSummaryId
  );
  const emptyMessage = filtered
    ? { title: "No jobs match these filters", body: "Try widening the search." }
    : { title: "No jobs delivered yet", body: "New deliveries appear here." };
  return (
    <VStack gap={4}>
      <div className={styles.filters}>
        <TextInput
          label="Search"
          onChange={(event) => setQ(event.target.value)}
          placeholder="Title or company"
          value={q}
        />
        <Select
          label="Source"
          onChange={setSource}
          options={[ALL_SOURCES, ...CONCRETE_SOURCES]}
          value={source}
        />
        <Select
          label="Subscription"
          onChange={selectSubscription}
          options={[
            { value: "", label: ALL_SUBSCRIPTIONS },
            ...subscriptions.map((sub) => ({
              value: String(sub.id),
              label: subLabel(sub),
            })),
          ]}
          value={subscriptionId === null ? "" : String(subscriptionId)}
        />
      </div>
      {jobs.isPending ? <LoadingNote /> : null}
      {jobs.isFetching && !jobs.isPending ? (
        <LoadingNote>Updating jobs…</LoadingNote>
      ) : null}
      {jobs.isError ? <QueryError error={jobs.error} /> : null}
      {jobs.isSuccess && jobs.data.jobs.length === 0 ? (
        <EmptyList
          action={
            filtered ? (
              <Button onClick={clearFilters} small variant="subtle">
                Clear filters
              </Button>
            ) : undefined
          }
          body={emptyMessage.body}
          title={emptyMessage.title}
        />
      ) : null}
      {jobs.isSuccess && jobs.data.jobs.length > 0 ? (
        <div className={styles.tableFrame}>
          <table aria-label="Delivered jobs" className="app-table">
            <JobsHead personal={personal} />
            <tbody>
              {jobs.data.jobs.map((job) => (
                <JobRow
                  job={job}
                  key={job.id}
                  onSummary={toggleSummary}
                  personal={personal}
                />
              ))}
            </tbody>
          </table>
          <Pager
            busy={jobs.isFetching}
            onNext={nextPage}
            onPrevious={previousPage}
            page={page}
            total={total}
            totalPages={totalPages}
          />
        </div>
      ) : null}
      <Modal
        onClose={closeSummary}
        open={Boolean(expandedJob?.aiSummary)}
        title={expandedJob?.title ?? "Job summary"}
      >
        <div className={styles.summary}>
          <Markdown text={expandedJob?.aiSummary ?? ""} />
        </div>
      </Modal>
    </VStack>
  );
};
