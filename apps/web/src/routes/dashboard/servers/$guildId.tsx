import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { JobsTable } from "../../../components/jobs";
import { SubscriptionsTable } from "../../../components/subscriptions";
import type { OpenPanel } from "../../../components/subscriptions";
import {
  BackLink,
  LoadingNote,
  PageHeader,
  QueryError,
  Tabs,
  VStack,
} from "../../../components/ui";
import {
  useGuilds,
  useRequireAuth,
  useSubscriptions,
} from "../../../lib/queries";

export const Route = createFileRoute("/dashboard/servers/$guildId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Server subscriptions | Kappa" }] }),
  component: () => <ServerDetailComponent />,
});

const ServerDetailComponent = () => {
  const { guildId } = Route.useParams();
  const me = useRequireAuth();
  const guilds = useGuilds(Boolean(me.data));
  const subs = useSubscriptions(Boolean(me.data), guildId);
  const [tab, setTab] = useState("jobs");
  const [open, setOpen] = useState<OpenPanel>(null);
  if (me.isError) {
    return <QueryError error={me.error} />;
  }
  if (!me.data) {
    return <LoadingNote />;
  }
  const guild = guilds.data?.find((item) => item.id === guildId);

  return (
    <VStack gap={6}>
      <BackLink label="Dashboard" to="/dashboard" />
      <PageHeader
        description="Jobs and subscriptions for this server."
        title={guild?.name ?? "Server"}
      />
      {guilds.isError ? <QueryError error={guilds.error} /> : null}
      <Tabs
        onChange={setTab}
        tabs={[
          {
            value: "jobs",
            label: "Jobs",
            content: (
              <VStack gap={4}>
                {subs.isError ? <QueryError error={subs.error} /> : null}
                <JobsTable
                  base={{ guild: guildId }}
                  subscriptions={subs.data ?? []}
                />
              </VStack>
            ),
          },
          {
            value: "manage",
            label: "Manage",
            content: (
              <VStack gap={4}>
                {subs.isPending ? <LoadingNote /> : null}
                {subs.isError ? <QueryError error={subs.error} /> : null}
                {subs.isSuccess ? (
                  <SubscriptionsTable
                    emptyBody="Run /jobs subscribe in the server."
                    emptyTitle="No subscriptions here yet"
                    open={open}
                    setOpen={setOpen}
                    subs={subs.data}
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
