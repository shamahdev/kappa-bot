import { MATCH_FACTORS, SUBSCRIPTION_SOURCES } from "@kappa/contracts";
import type { JobDtoType, MatchBreakdownType } from "@kappa/contracts";
import { useId, useState } from "react";

import type { SubscriptionDtoType } from "../lib/api";
import { fullDate, relativeDay } from "../lib/format";
import { ALL_SOURCES, useJobsTable } from "../lib/use-jobs-table";
import type { JobsBase } from "../lib/use-jobs-table";
import { DashboardIcon } from "./dashboard-icon";
import { Markdown } from "./markdown";
import { FactorScore, GradeChip } from "./score";
import { TrackControl } from "./track-control";
import {
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
const titleOf = (job: JobDtoType) => job.title ?? "Untitled posting";

export const MatchBreakdownPanel = ({
  breakdown,
}: {
  breakdown: MatchBreakdownType;
}) => (
  <div className={styles.breakdown}>
    <div className={styles.breakdownGrid}>
      {MATCH_FACTORS.map((factor) => (
        <FactorScore
          key={factor.key}
          label={factor.label}
          reason={breakdown[factor.key].reason}
          score={breakdown[factor.key].score}
          weight={factor.weight}
        />
      ))}
    </div>
    <p className="app-muted app-small">
      Advisory CV match, not a hiring prediction.
    </p>
  </div>
);

/** The grade itself is the disclosure for its breakdown. */
const MatchToggle = ({
  job,
  open,
  controls,
  onToggle,
}: {
  job: JobDtoType;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) => {
  if (!job.matchGrade) {
    return <span className={styles.notAssessed}>Not assessed</span>;
  }
  if (!job.matchBreakdown) {
    return <GradeChip grade={job.matchGrade} />;
  }
  return (
    <button
      aria-controls={controls}
      aria-expanded={open}
      aria-label={`${open ? "Hide" : "Show"} match breakdown for ${titleOf(job)}`}
      className={styles.matchButton}
      onClick={onToggle}
      type="button"
    >
      <GradeChip grade={job.matchGrade} />
      <DashboardIcon name="chevronDown" size={14} />
    </button>
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
      {titleOf(job)}
    </a>
    <p className={styles.jobMeta}>
      {[job.company, job.location].filter(Boolean).join(" · ") || "—"}
      <span aria-hidden="true"> · </span>
      {job.source}
      <span aria-hidden="true"> · </span>
      <time dateTime={job.firstSeenAt} title={fullDate(job.firstSeenAt)}>
        {relativeDay(job.firstSeenAt)}
      </time>
    </p>
  </div>
);

const JobsHead = ({ personal }: { personal: boolean }) => (
  <thead>
    <tr>
      {personal ? (
        <th className={styles.colMatch} scope="col">
          Match
        </th>
      ) : null}
      <th scope="col">Job</th>
      {personal ? (
        <th className={styles.colTrack} scope="col">
          Tracking
        </th>
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
}) => {
  const [open, setOpen] = useState(false);
  const breakdownId = useId();
  return (
    <>
      <tr className={open ? styles.rowOpen : undefined}>
        {personal ? (
          <td className={styles.matchTd}>
            <MatchToggle
              controls={breakdownId}
              job={job}
              onToggle={() => setOpen((value) => !value)}
              open={open}
            />
          </td>
        ) : null}
        <td className={styles.jobTd}>
          <JobCell job={job} />
        </td>
        {personal ? (
          <td className={styles.trackTd}>
            <TrackControl
              seenJobId={job.id}
              status={job.application?.status ?? null}
              title={titleOf(job)}
            />
          </td>
        ) : null}
        <td className={styles.summaryTd}>
          {job.aiSummary ? (
            <button
              aria-label={`Read summary of ${titleOf(job)}`}
              className={styles.iconButton}
              onClick={() => onSummary(job.id)}
              title="Read summary"
              type="button"
            >
              <DashboardIcon name="file" size={18} />
            </button>
          ) : null}
        </td>
      </tr>
      {open && job.matchBreakdown ? (
        <tr className={styles.breakdownRow} id={breakdownId}>
          <td colSpan={personal ? 4 : 2}>
            <MatchBreakdownPanel breakdown={job.matchBreakdown} />
          </td>
        </tr>
      ) : null}
    </>
  );
};

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
    <Text as="span" color="secondary" type="supporting">
      {total} job{total === 1 ? "" : "s"} · page {page} of {totalPages}
    </Text>
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
  const [showFilters, setShowFilters] = useState(false);
  const personal = "scope" in base;
  const activeFilters =
    (source === ALL_SOURCES ? 0 : 1) + (subscriptionId === null ? 0 : 1);
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
        {/* Phones collapse the secondary filters behind one toggle. */}
        <button
          aria-expanded={showFilters}
          className={`app-button subtle ${styles.filterToggle}`}
          onClick={() => setShowFilters((value) => !value)}
          type="button"
        >
          <DashboardIcon name="settings" size={16} />
          Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </button>
        <div className={styles.moreFilters} data-open={showFilters}>
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
          <table
            aria-label="Delivered jobs"
            className={`app-table ${styles.jobsTable}`}
          >
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
        title={expandedJob ? titleOf(expandedJob) : "Job summary"}
      >
        <div className={styles.summary}>
          <Markdown text={expandedJob?.aiSummary ?? ""} />
        </div>
      </Modal>
    </VStack>
  );
};
