import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CvPanel } from "../../components/cv";
import { CreateForm, SubscriptionsTable } from "../../components/subscriptions";
import type { OpenPanel } from "../../components/subscriptions";
import {
  LoadingNote,
  PageHeader,
  QueryError,
  SectionCard,
  VStack,
} from "../../components/ui";
import { useRequireAuth, useSubscriptions } from "../../lib/queries";

const PersonalSettingsPage = () => {
  const me = useRequireAuth();
  const subs = useSubscriptions(Boolean(me.data));
  const [open, setOpen] = useState<OpenPanel>(null);
  const personalSubs = subs.data?.filter((sub) => sub.scope === "dm") ?? [];

  return (
    <VStack gap={6}>
      <PageHeader
        title="Settings"
        description="Choose your job alerts and keep your CV up to date."
      />
      <div className="app-manage-forms">
        <SectionCard title="CV for job matching">
          <CvPanel />
        </SectionCard>
        <SectionCard title="New subscription">
          <CreateForm />
        </SectionCard>
      </div>
      <section
        className="dashboard-settings-section"
        aria-labelledby="personal-subscriptions-title"
      >
        <h2 id="personal-subscriptions-title">Your subscriptions</h2>
        {subs.isPending ? (
          <LoadingNote>Loading subscriptions…</LoadingNote>
        ) : null}
        {subs.isError ? <QueryError error={subs.error} /> : null}
        {subs.isSuccess ? (
          <SubscriptionsTable
            subs={personalSubs}
            open={open}
            setOpen={setOpen}
            emptyTitle="No subscriptions yet"
            emptyBody="Create a subscription above to receive job alerts in your DMs."
          />
        ) : null}
      </section>
    </VStack>
  );
};

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings | Kappa" }] }),
  component: PersonalSettingsPage,
});
