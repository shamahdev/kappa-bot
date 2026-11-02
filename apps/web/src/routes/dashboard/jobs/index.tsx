import { createFileRoute } from "@tanstack/react-router";

import { ApplicationBoard } from "../../../components/application-board";
import { PageHeader, VStack } from "../../../components/ui";

const JobsDashboardPage = () => (
  <VStack gap={6}>
    <PageHeader
      title="Jobs dashboard"
      description="Track the jobs you bookmarked or applied to. Drag a card to change its status."
    />
    <ApplicationBoard />
  </VStack>
);

export const Route = createFileRoute("/dashboard/jobs/")({
  head: () => ({ meta: [{ title: "Jobs dashboard | Kappa" }] }),
  component: JobsDashboardPage,
});
