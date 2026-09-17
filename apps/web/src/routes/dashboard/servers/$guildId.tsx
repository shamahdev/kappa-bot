import { Link, createFileRoute } from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { JobsTable } from '../../../components/jobs';
import {
  detailStyles,
  subStyles,
  SubscriptionsTable,
  type OpenPanel,
} from '../../../components/subscriptions';
import { ErrorNote, Tabs } from '../../../components/ui';
import { apiMessage, useGuilds, useRequireAuth, useSubscriptions } from '../../../lib/queries';

export const Route = createFileRoute('/dashboard/servers/$guildId')({
  ssr: false,
  component: ServerDetailComponent,
});

function ServerDetailComponent() {
  const { guildId } = Route.useParams();
  const me = useRequireAuth();
  const guilds = useGuilds(me.data != null);
  const subs = useSubscriptions(me.data != null, guildId);
  const [tab, setTab] = useState('jobs');
  const [open, setOpen] = useState<OpenPanel>(null);

  if (me.isPending || me.data === null) {
    return <p {...stylex.props(detailStyles.stateLine)}>Loading…</p>;
  }

  const guild = guilds.data?.find((g) => g.id === guildId);

  return (
    <div>
      <Link to="/dashboard" {...stylex.props(detailStyles.back)}>
        ← Dashboard
      </Link>
      <h1 {...stylex.props(detailStyles.title)}>{guild?.name ?? 'Server'}</h1>
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
          <JobsTable base={{ guild: guildId }} subscriptions={subs.data ?? []} />
        </div>
      ) : (
        <section {...stylex.props(detailStyles.section)} aria-label="Server subscriptions">
          {subs.isPending ? (
            <p {...stylex.props(detailStyles.stateLine)}>Loading…</p>
          ) : subs.isError ? (
            <div {...stylex.props(subStyles.errorGap)}>
              <ErrorNote>{apiMessage(subs.error)}</ErrorNote>
            </div>
          ) : (
            <SubscriptionsTable
              subs={subs.data}
              open={open}
              setOpen={setOpen}
              emptyTitle="No subscriptions here yet"
              emptyBody="Run /jobs subscribe in the server."
            />
          )}
        </section>
      )}
    </div>
  );
}
