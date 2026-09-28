import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Layout';
import { JobsTable } from '../../../components/jobs';
import {
  SubscriptionsTable,
  type OpenPanel,
} from '../../../components/subscriptions';
import { BackLink, PageHeader, QueryError, Tabs } from '../../../components/ui';
import { useGuilds, useRequireAuth, useSubscriptions } from '../../../lib/queries';

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
    return <Text color="secondary">Loading…</Text>;
  }

  const guild = guilds.data?.find((g) => g.id === guildId);

  return (
    <VStack gap={4}>
      <BackLink to="/dashboard" label="← Dashboard" />
      <PageHeader title={guild?.name ?? 'Server'} description="Jobs and subscriptions for this server." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'jobs', label: 'Jobs' },
          { value: 'manage', label: 'Manage' },
        ]}
      />
      {tab === 'jobs' ? (
        <JobsTable base={{ guild: guildId }} subscriptions={subs.data ?? []} />
      ) : subs.isPending ? (
        <Text color="secondary">Loading…</Text>
      ) : subs.isError ? (
        <QueryError error={subs.error} />
      ) : (
        <SubscriptionsTable
          subs={subs.data}
          open={open}
          setOpen={setOpen}
          emptyTitle="No subscriptions here yet"
          emptyBody="Run /jobs subscribe in the server."
        />
      )}
    </VStack>
  );
}
