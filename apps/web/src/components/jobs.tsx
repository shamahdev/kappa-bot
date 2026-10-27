import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { pixel, proportional, Table } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { SUBSCRIPTION_SOURCES } from "@kappa/contracts";

import type { JobDtoType, SubscriptionDtoType } from "../lib/api";
import { ALL_SOURCES, useJobsTable } from "../lib/use-jobs-table";
import type { JobsBase } from "../lib/use-jobs-table";
import { formatDate } from "./subscriptions";
import {
  Badge,
  Button,
  EmptyList,
  LoadingNote,
  QueryError,
  Select,
  TextInput,
} from "./ui";

import styles from "./data-views.module.css";

const ALL_SUBSCRIPTIONS = "All subscriptions";
const CONCRETE_SOURCES = SUBSCRIPTION_SOURCES.filter(
  (source) => source !== "all"
);
const subLabel = (sub: SubscriptionDtoType): string =>
  `#${sub.id} · ${sub.source} · ${sub.keywords ?? "—"}`;

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
  const columns: TableColumn<JobDtoType>[] = [
    {
      key: "title",
      header: "Job",
      width: proportional(1),
      renderCell: (job) => (
        <VStack gap={2}>
          <Link href={job.url} isExternalLink weight="semibold">
            {job.title ?? "Untitled posting"}
          </Link>
          <Text color="secondary" type="supporting">
            {job.company ?? "—"} · {job.location ?? "—"}
          </Text>
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
      ),
    },
    {
      key: "matchScore",
      header: "Match",
      width: pixel(88),
      renderCell: (job) => (
        <VStack gap={2}>
          <Text weight="semibold">
            {job.matchScore === null ? "—" : `${job.matchScore}%`}
          </Text>
          {job.matchReason ? (
            <Text color="secondary" type="supporting">
              {job.matchReason}
            </Text>
          ) : null}
        </VStack>
      ),
    },
  ];
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
          <Table
            aria-label="Delivered jobs"
            columns={columns}
            data={[...jobs.data.jobs]}
            density="balanced"
            dividers="rows"
            idKey="id"
            verticalAlign="top"
          />
          <div className={styles.pager}>
            <Text color="secondary" type="supporting">
              Page {page} of {totalPages} · {total} job{total === 1 ? "" : "s"}
            </Text>
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
      <Dialog
        isOpen={Boolean(expandedJob?.aiSummary)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closeSummary();
          }
        }}
        padding={4}
        purpose="info"
      >
        <VStack gap={4}>
          <DialogHeader
            onOpenChange={closeSummary}
            title={expandedJob?.title ?? "Job summary"}
          />
          <Text className={styles.summary}>{expandedJob?.aiSummary}</Text>
        </VStack>
      </Dialog>
    </VStack>
  );
};
