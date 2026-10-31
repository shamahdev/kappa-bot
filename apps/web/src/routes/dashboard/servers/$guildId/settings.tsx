import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { SubscriptionsTable } from "../../../../components/subscriptions";
import type { OpenPanel } from "../../../../components/subscriptions";
import {
  InfoNote,
  LoadingNote,
  QueryError,
  VStack,
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
        Create a server subscription with <code>/jobs subscribe</code> in
        Discord. You can edit, pause or remove it here. Personal CVs are never
        used for server matches.
      </InfoNote>
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
            emptyBody="Run /jobs subscribe in this Discord server to add one."
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
