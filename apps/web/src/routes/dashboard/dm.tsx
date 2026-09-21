import { Link, createFileRoute } from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { CvPanel } from '../../components/cv';
import { JobsTable } from '../../components/jobs';
import {
  CreateForm,
  detailStyles,
  subStyles,
  SubscriptionsTable,
  type OpenPanel,
} from '../../components/subscriptions';
import { QueryError, Tabs } from '../../components/ui';
import { useRequireAuth, useSubscriptions } from '../../lib/queries';

export const Route = createFileRoute('/dashboard/dm')({
  ssr: false,
  component: DmDetailComponent,
});

function DmDetailComponent() {
  const me = useRequireAuth();
  const subs = useSubscriptions(me.data != null);
  const [tab, setTab] = useState('jobs');
  const [open, setOpen] = useState<OpenPanel>(null);

  if (me.isPending || me.data === null) {
    return <p {...stylex.props(detailStyles.stateLine)}>Loading…</p>;
  }

  const dmSubs = subs.data?.filter((s) => s.scope === 'dm') ?? [];

  return (
    <div>
      <Link to="/dashboard" {...stylex.props(detailStyles.back)}>
        ← Dashboard
      </Link>
      <h1 {...stylex.props(detailStyles.title)}>Direct messages</h1>
      <div {...stylex.props(detailStyles.tabsWrap)}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'jobs', label: 'Jobs' },
            { value: 'manage', label: 'Manage' },
          ]}
        />
      </div>

      {tab === 'jobs' ? (
        <div {...stylex.props(detailStyles.section)}>
          <JobsTable base={{ scope: 'dm' }} subscriptions={dmSubs} />
        </div>
      ) : (
        <div>
          <section {...stylex.props(detailStyles.section)} aria-label="CV for match scores">
            <h2 {...stylex.props(detailStyles.sectionTitle)}>CV for match scores</h2>
            <div {...stylex.props(subStyles.panel)}>
              <CvPanel />
            </div>
          </section>
          <section {...stylex.props(detailStyles.section)} aria-label="New DM subscription">
            <h2 {...stylex.props(detailStyles.sectionTitle)}>New</h2>
            <div {...stylex.props(subStyles.panel)}>
              <CreateForm />
            </div>
          </section>
          <section {...stylex.props(detailStyles.section)} aria-label="DM subscriptions">
            {subs.isPending ? (
              <p {...stylex.props(detailStyles.stateLine)}>Loading…</p>
            ) : subs.isError ? (
              <div {...stylex.props(subStyles.errorGap)}>
                <QueryError error={subs.error} />
              </div>
            ) : (
              <SubscriptionsTable
                subs={dmSubs}
                open={open}
                setOpen={setOpen}
                emptyTitle="No subscriptions yet"
                emptyBody="Create one above."
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
