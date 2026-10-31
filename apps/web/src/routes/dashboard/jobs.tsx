import { createFileRoute } from "@tanstack/react-router";

import { CvReportList } from "../../components/cv-reports";
import { JobsTable } from "../../components/jobs";
import { PageHeader, QueryError, VStack } from "../../components/ui";
import { useRequireAuth, useSubscriptions } from "../../lib/queries";

const PersonalJobsPage = () => {
  const me = useRequireAuth();
  const subs = useSubscriptions(Boolean(me.data));
  const personalSubs = subs.data?.filter((sub) => sub.scope === "dm") ?? [];
  return (
    <VStack gap={6}>
      <PageHeader
        title="Jobs"
        description="Your job matches, delivered to your Discord DMs."
      />
      <details className="cv-reports-disclosure">
        <summary>CV reports</summary>
        <CvReportList />
      </details>
      {subs.isError ? <QueryError error={subs.error} /> : null}
      <JobsTable base={{ scope: "dm" }} subscriptions={personalSubs} />
    </VStack>
  );
};

export const Route = createFileRoute("/dashboard/jobs")({
  head: () => ({ meta: [{ title: "Jobs | Kappa" }] }),
  component: PersonalJobsPage,
});
