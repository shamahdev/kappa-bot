import {
  SUBSCRIPTION_SOURCES,
  MATCH_FACTORS,
  MATCH_GRADE_LABELS,
} from "@kappa/contracts";

import type { SubscriptionDtoType } from "../lib/api";
import { ALL_SOURCES, useJobsTable } from "../lib/use-jobs-table";
import type { JobsBase } from "../lib/use-jobs-table";
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
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">Match</th>
              </tr>
            </thead>
            <tbody>
              {jobs.data.jobs.map((job) => (
                <tr key={job.id}>
                  <td data-label="Job">
                    <VStack gap={2}>
                      <a
                        className={styles.jobLink}
                        href={job.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {job.title ?? "Untitled posting"}
                      </a>
                      <div className={styles.meta}>
                        <Text as="span" color="secondary" type="supporting">
                          {job.company ?? "—"}
                        </Text>
                        <Text as="span" color="secondary" type="supporting">
                          {job.location ?? "—"}
                        </Text>
                      </div>
                      <HStack gap={2} wrap="wrap">
                        <Badge>{job.source}</Badge>
                        <Text color="secondary" type="supporting">
                          Delivered {formatDate(job.firstSeenAt)}
                        </Text>
                      </HStack>
                      {job.aiSummary ? (
                        <HStack>
                          <Button
                            onClick={() => toggleSummary(job.id)}
                            small
                            variant="subtle"
                          >
                            Summary
                          </Button>
                        </HStack>
                      ) : null}
                    </VStack>
                  </td>
                  <td data-label="Match">
                    {(() => {
                      const breakdown = job.matchBreakdown;
                      return (
                        <VStack gap={2}>
                          {job.matchGrade ? (
                            <>
                              <Text weight="semibold">
                                {job.matchGrade} —{" "}
                                {MATCH_GRADE_LABELS[job.matchGrade]}
                              </Text>
                              {breakdown ? (
                                <details className={styles.matchDetails}>
                                  <summary>Match breakdown</summary>
                                  <dl className={styles.matchFactors}>
                                    {MATCH_FACTORS.map((factor) => {
                                      const assessment = breakdown[factor.key];
                                      return (
                                        <div key={factor.key}>
                                          <dt>
                                            {factor.label}{" "}
                                            <span>{factor.weight}% weight</span>
                                          </dt>
                                          <dd>
                                            <strong>
                                              {assessment.score}/100
                                            </strong>
                                            <p>{assessment.reason}</p>
                                          </dd>
                                        </div>
                                      );
                                    })}
                                  </dl>
                                  <p className="app-muted app-small">
                                    Advisory CV match, not a hiring prediction.
                                  </p>
                                </details>
                              ) : (
                                <Text color="secondary" type="supporting">
                                  Historical assessment; factor breakdown
                                  unavailable.
                                </Text>
                              )}
                            </>
                          ) : (
                            <Text color="secondary" type="supporting">
                              Not assessed
                            </Text>
                          )}
                        </VStack>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                disabled={page <= 1 || jobs.isFetching}
                onClick={previousPage}
                small
                variant="subtle"
              >
                Previous
              </Button>
              <Button
                disabled={page >= totalPages || jobs.isFetching}
                onClick={nextPage}
                small
                variant="subtle"
              >
                Next
              </Button>
            </HStack>
          </div>
        </div>
      ) : null}
      <Modal
        onClose={closeSummary}
        open={Boolean(expandedJob?.aiSummary)}
        title={expandedJob?.title ?? "Job summary"}
      >
        <Text as="p" className={styles.summary}>
          {expandedJob?.aiSummary}
        </Text>
      </Modal>
    </VStack>
  );
};
