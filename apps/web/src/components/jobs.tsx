import { Text } from "@astryxdesign/core/Text";
import { SUBSCRIPTION_SOURCES } from "@kappa/contracts";
import * as stylex from "@stylexjs/stylex";
import { Fragment } from "react";

import type { SubscriptionDtoType } from "../lib/queries";
import { ALL_SOURCES, useJobsTable } from "../lib/use-jobs-table";
import type { JobsBase } from "../lib/use-jobs-table";
import { fonts, tokens } from "../theme.stylex";
import { formatDate, subStyles } from "./subscriptions";
import { Badge, Button, EmptyList, QueryError, Select, TextInput } from "./ui";

const ALL_SUBSCRIPTIONS = "All subscriptions";
const CONCRETE_SOURCES = SUBSCRIPTION_SOURCES.filter((s) => s !== "all");

const jobStyles = stylex.create({
  filterRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-end",
    marginTop: 12,
  },
  filterGrow: { flex: "1 1 220px" },
  filterFixed: { flex: "0 1 190px" },
  jobLink: {
    color: tokens.brand,
    textDecoration: "none",
    ":hover": { textDecoration: "underline" },
  },
  pager: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    padding: "12px 14px",
    fontFamily: fonts.sans,
    fontSize: 13,
    color: tokens.muted,
  },
  pagerButtons: { display: "flex", gap: 8 },
  matchScore: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: 700,
    color: tokens.ink,
  },
  matchReason: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: tokens.muted,
    lineHeight: "18px",
    marginTop: 2,
  },
  summaryToggle: { marginTop: 6 },
  summary: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: tokens.ink,
    lineHeight: "20px",
    whiteSpace: "pre-wrap",
  },
});

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

  return (
    <div>
      <div {...stylex.props(jobStyles.filterRow)}>
        <div {...stylex.props(jobStyles.filterGrow)}>
          <TextInput
            label="Search"
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title or company"
            value={q}
          />
        </div>
        <div {...stylex.props(jobStyles.filterFixed)}>
          <Select
            label="Source"
            onChange={setSource}
            options={[ALL_SOURCES, ...CONCRETE_SOURCES]}
            value={source}
          />
        </div>
        <div {...stylex.props(jobStyles.filterFixed)}>
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

      {jobs.isPending ? <Text color="secondary">Loading…</Text> : null}
      {jobs.isError ? (
        <div {...stylex.props(subStyles.errorGap)}>
          <QueryError error={jobs.error} />
        </div>
      ) : null}
      {jobs.isSuccess && jobs.data.jobs.length === 0 ? (
        <EmptyList
          action={
            filtered ? (
              <Button onClick={clearFilters} small variant="subtle">
                Clear filters
              </Button>
            ) : undefined
          }
          body={
            filtered
              ? "Try widening the search."
              : "New deliveries appear here."
          }
          title={
            filtered ? "No jobs match these filters" : "No jobs delivered yet"
          }
        />
      ) : null}
      {jobs.isSuccess && jobs.data.jobs.length > 0 ? (
        <div {...stylex.props(subStyles.tableScroll)}>
          <table {...stylex.props(subStyles.table)}>
            <thead>
              <tr>
                <th {...stylex.props(subStyles.th)} scope="col">
                  Title
                </th>
                <th {...stylex.props(subStyles.th)} scope="col">
                  Company
                </th>
                <th {...stylex.props(subStyles.th)} scope="col">
                  Location
                </th>
                <th {...stylex.props(subStyles.th)} scope="col">
                  Source
                </th>
                <th {...stylex.props(subStyles.th)} scope="col">
                  Match
                </th>
                <th {...stylex.props(subStyles.th)} scope="col">
                  Delivered
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.data.jobs.map((job) => (
                <Fragment key={job.id}>
                  <tr>
                    <td {...stylex.props(subStyles.td)}>
                      <a
                        {...stylex.props(jobStyles.jobLink)}
                        href={job.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {job.title ?? "Untitled posting"}
                      </a>
                      {job.aiSummary ? (
                        <div {...stylex.props(jobStyles.summaryToggle)}>
                          <Button
                            onClick={() => toggleSummary(job.id)}
                            small
                            variant="subtle"
                          >
                            {expandedSummaryId === job.id
                              ? "Hide summary"
                              : "Summary"}
                          </Button>
                        </div>
                      ) : null}
                    </td>
                    <td {...stylex.props(subStyles.td)}>
                      {job.company ?? (
                        <span {...stylex.props(subStyles.muted)}>—</span>
                      )}
                    </td>
                    <td {...stylex.props(subStyles.td)}>
                      {job.location ?? (
                        <span {...stylex.props(subStyles.muted)}>—</span>
                      )}
                    </td>
                    <td {...stylex.props(subStyles.td)}>
                      <Badge>{job.source}</Badge>
                    </td>
                    <td {...stylex.props(subStyles.td)}>
                      {job.matchScore === null ? (
                        <span {...stylex.props(subStyles.muted)}>—</span>
                      ) : (
                        <div>
                          <span
                            {...stylex.props(jobStyles.matchScore)}
                          >{`${job.matchScore}%`}</span>
                          {job.matchReason ? (
                            <div {...stylex.props(jobStyles.matchReason)}>
                              {job.matchReason}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td {...stylex.props(subStyles.td)}>
                      {formatDate(job.firstSeenAt)}
                    </td>
                  </tr>
                  {expandedSummaryId === job.id && job.aiSummary ? (
                    <tr>
                      <td {...stylex.props(subStyles.td)} colSpan={6}>
                        <div {...stylex.props(jobStyles.summary)}>
                          {job.aiSummary}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div {...stylex.props(jobStyles.pager)}>
            <span>
              Page {page} of {totalPages} · {total} job{total === 1 ? "" : "s"}
            </span>
            <div {...stylex.props(jobStyles.pagerButtons)}>
              <Button
                disabled={page <= 1}
                onClick={previousPage}
                small
                variant="subtle"
              >
                Previous
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={nextPage}
                small
                variant="subtle"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
