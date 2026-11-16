import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { QueryError } from "../../../../components/api-feedback";
import {
  SubscriptionsTable,
  CreateForm,
} from "../../../../components/subscriptions";
import type { OpenPanel } from "../../../../components/subscriptions";
import {
  InfoNote,
  LoadingNote,
  VStack,
  SectionCard,
} from "../../../../components/ui";
import { useSubscriptions } from "../../../../lib/queries";

const ServerSettingsPage = () => {
  const { guildId } = Route.useParams();
  const subs = useSubscriptions(true, guildId);
  const [open, setOpen] = useState<OpenPanel>(null);
  const serverSubs =
    subs.data?.filter(
      (sub) => sub.scope === "guild" && sub.guildId === guildId
    ) ?? [];

  return (
    <VStack gap={4}>
      <InfoNote>
        Create a server subscription here or with <code>/jobs subscribe</code>{" "}
        in Discord. Personal CVs are never used for server matches.
      </InfoNote>
      <SectionCard title="New server subscription">
        <CreateForm key={guildId} guildId={guildId} />
      </SectionCard>
      <section
        className="dashboard-settings-section"
        aria-labelledby="server-subscriptions-title"
      >
        <h2 id="server-subscriptions-title">Server subscriptions</h2>
        {subs.isPending ? (
          <LoadingNote>Loading subscriptions…</LoadingNote>
        ) : null}
        {subs.isError ? <QueryError error={subs.error} /> : null}
        {subs.isSuccess ? (
          <SubscriptionsTable
            key={guildId}
            subs={serverSubs}
            open={open}
            setOpen={setOpen}
            emptyTitle="No subscriptions here yet"
            emptyBody="Create a subscription above or run /jobs subscribe in this server."
          />
        ) : null}
      </section>
    </VStack>
  );
};

export const Route = createFileRoute("/dashboard/servers/$guildId/settings")({
  head: () => ({ meta: [{ title: "Server settings | Kappa" }] }),
  component: ServerSettingsPage,
});
