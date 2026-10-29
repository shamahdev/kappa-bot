import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CvPanel } from "../../components/cv";
import { JobsTable } from "../../components/jobs";
import { CreateForm, SubscriptionsTable } from "../../components/subscriptions";
import type { OpenPanel } from "../../components/subscriptions";
import {
  BackLink,
  LoadingNote,
  PageHeader,
  QueryError,
  SectionCard,
  Tabs,
  VStack,
} from "../../components/ui";
import { useRequireAuth, useSubscriptions } from "../../lib/queries";

export const Route = createFileRoute("/dashboard/dm")({
  ssr: false,
  head: () => ({ meta: [{ title: "Direct messages | Kappa" }] }),
  component: () => <DmDetailComponent />,
});

const DmDetailComponent = () => {
  const me = useRequireAuth();
  const subs = useSubscriptions(Boolean(me.data));
  const [tab, setTab] = useState("jobs");
  const [open, setOpen] = useState<OpenPanel>(null);
  if (me.isError) {
    return <QueryError error={me.error} />;
  }
  if (!me.data) {
    return <LoadingNote />;
  }
  const dmSubs = subs.data?.filter((sub) => sub.scope === "dm") ?? [];

  return (
    <VStack gap={6}>
      <BackLink label="Dashboard" to="/dashboard" />
      <PageHeader
        description="Jobs delivered to your DMs."
        title="Direct messages"
      />
      <Tabs
        onChange={setTab}
        tabs={[
          {
            value: "jobs",
            label: "Jobs",
            content: (
              <VStack gap={4}>
                {subs.isError ? <QueryError error={subs.error} /> : null}
                <JobsTable base={{ scope: "dm" }} subscriptions={dmSubs} />
              </VStack>
            ),
          },
          {
            value: "manage",
            label: "Manage",
            content: (
              <VStack gap={4}>
                <SectionCard title="CV for match scores">
                  <CvPanel />
                </SectionCard>
                <SectionCard title="New DM subscription">
                  <CreateForm />
                </SectionCard>
                {subs.isPending ? <LoadingNote /> : null}
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
            ),
          },
        ]}
        value={tab}
      />
    </VStack>
  );
};
