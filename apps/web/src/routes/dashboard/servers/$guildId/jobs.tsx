import { createFileRoute } from "@tanstack/react-router";

import { JobsTable } from "../../../../components/jobs";
import { QueryError, VStack } from "../../../../components/ui";
import { useSubscriptions } from "../../../../lib/queries";

const ServerJobsPage = () => {
  const { guildId } = Route.useParams();
  const subs = useSubscriptions(true, guildId);
  const serverSubs =
    subs.data?.filter(
      (sub) => sub.scope === "guild" && sub.guildId === guildId
    ) ?? [];

  return (
    <VStack gap={4}>
      {subs.isError ? <QueryError error={subs.error} /> : null}
      <JobsTable
        key={guildId}
        base={{ guild: guildId }}
        subscriptions={serverSubs}
      />
    </VStack>
  );
};

export const Route = createFileRoute("/dashboard/servers/$guildId/jobs")({
  head: () => ({ meta: [{ title: "Server jobs | Kappa" }] }),
  component: ServerJobsPage,
});
