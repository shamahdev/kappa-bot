import { SUBSCRIPTION_SOURCES } from '@kappa/contracts';
import * as stylex from '@stylexjs/stylex';
import { Fragment, useEffect, useState } from 'react';
import { Badge, Button, QueryError, Select, TextInput } from './ui';
import { formatDate, subStyles } from './subscriptions';
import { useJobs, type SubscriptionDtoType } from '../lib/queries';
import { fonts, tokens } from '../theme.stylex';

const PAGE_SIZE = 20;
const ALL_SOURCES = 'All sources';
const ALL_SUBSCRIPTIONS = 'All subscriptions';
const CONCRETE_SOURCES = SUBSCRIPTION_SOURCES.filter((s) => s !== 'all');

const jobStyles = stylex.create({
  filterRow: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 },
  filterGrow: { flex: '1 1 220px' },
  filterFixed: { flex: '0 1 190px' },
  jobLink: { color: tokens.brand, textDecoration: 'none', ':hover': { textDecoration: 'underline' } },
  pager: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    padding: '12px 14px',
    fontFamily: fonts.sans,
    fontSize: 13,
    color: tokens.muted,
  },
  pagerButtons: { display: 'flex', gap: 8 },
  matchScore: { fontFamily: fonts.sans, fontSize: 14, fontWeight: 700, color: tokens.ink },
  matchReason: { fontFamily: fonts.sans, fontSize: 12, color: tokens.muted, lineHeight: '18px', marginTop: 2 },
  summaryToggle: { marginTop: 6 },
  summary: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: tokens.ink,
    lineHeight: '20px',
    whiteSpace: 'pre-wrap',
  },
});

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function subLabel(sub: SubscriptionDtoType): string {
  return `#${sub.id} · ${sub.source} · ${sub.keywords ?? '—'}`;
}

export function JobsTable({
  base,
  subscriptions,
}: {
  base: { scope: 'dm' } | { guild: string };
  subscriptions: readonly SubscriptionDtoType[];
}) {
  const [q, setQ] = useState('');
  const [source, setSource] = useState(ALL_SOURCES);
  const [subscription, setSubscription] = useState(ALL_SUBSCRIPTIONS);
  const [page, setPage] = useState(1);
  const [expandedSummaryId, setExpandedSummaryId] = useState<number | null>(null);
  const debouncedQ = useDebouncedValue(q, 300);

  const filtered = debouncedQ !== '' || source !== ALL_SOURCES || subscription !== ALL_SUBSCRIPTIONS;
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, source, subscription]);

  const selectedSub = subscriptions.find((s) => subLabel(s) === subscription);
  const jobs = useJobs(true, {
    ...base,
    q: debouncedQ.trim() === '' ? undefined : debouncedQ.trim(),
    source: source === ALL_SOURCES ? undefined : source,
    subscription: subscription === ALL_SUBSCRIPTIONS ? undefined : selectedSub?.id,
    page,
    pageSize: PAGE_SIZE,
  });

  const total = jobs.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div {...stylex.props(jobStyles.filterRow)}>
        <div {...stylex.props(jobStyles.filterGrow)}>
          <TextInput
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title or company"
          />
        </div>
        <div {...stylex.props(jobStyles.filterFixed)}>
          <Select label="Source" value={source} onChange={setSource} options={[ALL_SOURCES, ...CONCRETE_SOURCES]} />
        </div>
        <div {...stylex.props(jobStyles.filterFixed)}>
          <Select
            label="Subscription"
            value={subscription}
            onChange={setSubscription}
            options={[ALL_SUBSCRIPTIONS, ...subscriptions.map(subLabel)]}
          />
        </div>
      </div>

      {jobs.isPending ? (
        <p {...stylex.props(subStyles.sub)}>Loading…</p>
      ) : jobs.isError ? (
        <div {...stylex.props(subStyles.errorGap)}>
          <QueryError error={jobs.error} />
        </div>
      ) : jobs.data.jobs.length === 0 ? (
        <div {...stylex.props(subStyles.tableScroll)}>
          <div {...stylex.props(subStyles.empty)}>
            <p {...stylex.props(subStyles.emptyTitle)}>
              {filtered ? 'No jobs match these filters' : 'No jobs delivered yet'}
            </p>
            <p {...stylex.props(subStyles.emptyBody)}>
              {filtered ? 'Try widening the search.' : 'New deliveries appear here.'}
            </p>
            {filtered ? (
              <div {...stylex.props(subStyles.inlineButtons)} style={{ justifyContent: 'center' }}>
                <Button
                  small
                  variant="subtle"
                  onClick={() => {
                    setQ('');
                    setSource(ALL_SOURCES);
                    setSubscription(ALL_SUBSCRIPTIONS);
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div {...stylex.props(subStyles.tableScroll)}>
          <table {...stylex.props(subStyles.table)}>
            <thead>
              <tr>
                <th {...stylex.props(subStyles.th)} scope="col">Title</th>
                <th {...stylex.props(subStyles.th)} scope="col">Company</th>
                <th {...stylex.props(subStyles.th)} scope="col">Location</th>
                <th {...stylex.props(subStyles.th)} scope="col">Source</th>
                <th {...stylex.props(subStyles.th)} scope="col">Match</th>
                <th {...stylex.props(subStyles.th)} scope="col">Delivered</th>
              </tr>
            </thead>
            <tbody>
              {jobs.data.jobs.map((job) => (
                <Fragment key={job.id}>
                  <tr>
                    <td {...stylex.props(subStyles.td)}>
                      <a {...stylex.props(jobStyles.jobLink)} href={job.url} target="_blank" rel="noreferrer">
                        {job.title ?? 'Untitled posting'}
                      </a>
                      {job.aiSummary ? (
                        <div {...stylex.props(jobStyles.summaryToggle)}>
                          <Button
                            small
                            variant="subtle"
                            onClick={() => setExpandedSummaryId(expandedSummaryId === job.id ? null : job.id)}
                          >
                            {expandedSummaryId === job.id ? 'Hide summary' : 'Summary'}
                          </Button>
                        </div>
                      ) : null}
                    </td>
                    <td {...stylex.props(subStyles.td)}>{job.company ?? <span {...stylex.props(subStyles.muted)}>—</span>}</td>
                    <td {...stylex.props(subStyles.td)}>{job.location ?? <span {...stylex.props(subStyles.muted)}>—</span>}</td>
                    <td {...stylex.props(subStyles.td)}>
                      <Badge>{job.source}</Badge>
                    </td>
                    <td {...stylex.props(subStyles.td)}>
                      {job.matchScore === null ? (
                        <span {...stylex.props(subStyles.muted)}>—</span>
                      ) : (
                        <div>
                          <span {...stylex.props(jobStyles.matchScore)}>{`${job.matchScore}%`}</span>
                          {job.matchReason ? (
                            <div {...stylex.props(jobStyles.matchReason)}>{job.matchReason}</div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td {...stylex.props(subStyles.td)}>{formatDate(job.firstSeenAt)}</td>
                  </tr>
                  {expandedSummaryId === job.id && job.aiSummary ? (
                    <tr>
                      <td {...stylex.props(subStyles.td)} colSpan={6}>
                        <div {...stylex.props(jobStyles.summary)}>{job.aiSummary}</div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div {...stylex.props(jobStyles.pager)}>
            <span>
              Page {page} of {totalPages} · {total} job{total === 1 ? '' : 's'}
            </span>
            <div {...stylex.props(jobStyles.pagerButtons)}>
              <Button small variant="subtle" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button small variant="subtle" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
