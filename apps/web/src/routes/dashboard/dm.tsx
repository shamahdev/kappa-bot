import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CvPanel } from "../../components/cv";
import { JobsTable } from "../../components/jobs";
import { CreateForm, SubscriptionsTable } from "../../components/subscriptions";
import type { OpenPanel } from "../../components/subscriptions";
import {
  BackLink,
  PageHeader,
  QueryError,
  SectionCard,
  Tabs,
} from "../../components/ui";
import { useRequireAuth, useSubscriptions } from "../../lib/queries";

export const Route = createFileRoute("/dashboard/dm")({
  ssr: false,
  component: () => <DmDetailComponent />,
});

const DmDetailComponent = () => {
  const me = useRequireAuth();
  const subs = useSubscriptions(Boolean(me.data));
  const [tab, setTab] = useState("jobs");
  const [open, setOpen] = useState<OpenPanel>(null);

  if (me.isPending || me.data === null) {
    return <Text color="secondary">Loading…</Text>;
  }

  const dmSubs = subs.data?.filter((s) => s.scope === "dm") ?? [];

  return (
    <VStack gap={4}>
      <BackLink label="← Dashboard" to="/dashboard" />
      <PageHeader
        description="Jobs delivered to your DMs."
        title="Direct messages"
      />
      <Tabs
        onChange={setTab}
        tabs={[
          { value: "jobs", label: "Jobs" },
          { value: "manage", label: "Manage" },
        ]}
        value={tab}
      />
      {tab === "jobs" ? (
        <JobsTable base={{ scope: "dm" }} subscriptions={dmSubs} />
      ) : (
        <VStack gap={4}>
          <SectionCard title="CV for match scores">
            <CvPanel />
          </SectionCard>
          <SectionCard title="New DM subscription">
            <CreateForm />
          </SectionCard>
          {subs.isPending ? <Text color="secondary">Loading…</Text> : null}
          {subs.isError ? <QueryError error={subs.error} /> : null}
          {subs.isSuccess ? (
            <SubscriptionsTable
              emptyBody="Create one above."
              emptyTitle="No subscriptions yet"
              open={open}
              setOpen={setOpen}
              subs={dmSubs}
            />
          ) : null}
        </VStack>
      )}
    </VStack>
  );
};
