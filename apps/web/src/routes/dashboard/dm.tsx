import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Layout';
import { CvPanel } from '../../components/cv';
import { JobsTable } from '../../components/jobs';
import {
  CreateForm,
  SubscriptionsTable,
  type OpenPanel,
} from '../../components/subscriptions';
import { BackLink, PageHeader, QueryError, SectionCard, Tabs } from '../../components/ui';
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
    return <Text color="secondary">Loading…</Text>;
  }

  const dmSubs = subs.data?.filter((s) => s.scope === 'dm') ?? [];

  return (
    <VStack gap={4}>
      <BackLink to="/dashboard" label="← Dashboard" />
      <PageHeader title="Direct messages" description="Jobs delivered to your DMs." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'jobs', label: 'Jobs' },
          { value: 'manage', label: 'Manage' },
        ]}
      />
      {tab === 'jobs' ? (
        <JobsTable base={{ scope: 'dm' }} subscriptions={dmSubs} />
      ) : (
        <VStack gap={4}>
          <SectionCard title="CV for match scores">
            <CvPanel />
          </SectionCard>
          <SectionCard title="New DM subscription">
            <CreateForm />
          </SectionCard>
          {subs.isPending ? (
            <Text color="secondary">Loading…</Text>
          ) : subs.isError ? (
            <QueryError error={subs.error} />
          ) : (
            <SubscriptionsTable
              subs={dmSubs}
              open={open}
              setOpen={setOpen}
              emptyTitle="No subscriptions yet"
              emptyBody="Create one above."
            />
          )}
        </VStack>
      )}
    </VStack>
  );
}

