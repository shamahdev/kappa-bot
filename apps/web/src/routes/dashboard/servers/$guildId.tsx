import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { JobsTable } from "../../../components/jobs";
import { SubscriptionsTable } from "../../../components/subscriptions";
import type { OpenPanel } from "../../../components/subscriptions";
import { BackLink, PageHeader, QueryError, Tabs } from "../../../components/ui";
import {
  useGuilds,
  useRequireAuth,
  useSubscriptions,
} from "../../../lib/queries";

export const Route = createFileRoute("/dashboard/servers/$guildId")({
  ssr: false,
  component: () => <ServerDetailComponent />,
});

const ServerDetailComponent = () => {
  const { guildId } = Route.useParams();
  const me = useRequireAuth();
  const guilds = useGuilds(Boolean(me.data));
  const subs = useSubscriptions(Boolean(me.data), guildId);
  const [tab, setTab] = useState("jobs");
  const [open, setOpen] = useState<OpenPanel>(null);

  if (me.isPending || me.data === null) {
    return <Text color="secondary">Loading…</Text>;
  }

  const guild = guilds.data?.find((g) => g.id === guildId);

  return (
    <VStack gap={4}>
      <BackLink label="← Dashboard" to="/dashboard" />
      <PageHeader
        description="Jobs and subscriptions for this server."
        title={guild?.name ?? "Server"}
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
        <JobsTable base={{ guild: guildId }} subscriptions={subs.data ?? []} />
      ) : null}
      {tab !== "jobs" && subs.isPending ? (
        <Text color="secondary">Loading…</Text>
      ) : null}
      {tab !== "jobs" && subs.isError ? (
        <QueryError error={subs.error} />
      ) : null}
      {tab !== "jobs" && subs.isSuccess ? (
        <SubscriptionsTable
          emptyBody="Run /jobs subscribe in the server."
          emptyTitle="No subscriptions here yet"
          open={open}
          setOpen={setOpen}
          subs={subs.data}
        />
      ) : null}
    </VStack>
  );
};
