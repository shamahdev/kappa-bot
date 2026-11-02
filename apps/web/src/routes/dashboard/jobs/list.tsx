import { createFileRoute } from "@tanstack/react-router";

import { JobsTable } from "../../../components/jobs";
import { PageHeader, QueryError, VStack } from "../../../components/ui";
import { useRequireAuth, useSubscriptions } from "../../../lib/queries";

const PersonalJobListPage = () => {
  const me = useRequireAuth();
  const subs = useSubscriptions(Boolean(me.data));
  const personalSubs = subs.data?.filter((sub) => sub.scope === "dm") ?? [];
  return (
    <VStack gap={6}>
      <PageHeader
        title="Job list"
        description="Every job delivered to your Discord DMs. Click a grade for its breakdown; set a status to track a job on your board."
      />
      {subs.isError ? <QueryError error={subs.error} /> : null}
      <JobsTable base={{ scope: "dm" }} subscriptions={personalSubs} />
    </VStack>
  );
};

export const Route = createFileRoute("/dashboard/jobs/list")({
  head: () => ({ meta: [{ title: "Job list | Kappa" }] }),
  component: PersonalJobListPage,
});
