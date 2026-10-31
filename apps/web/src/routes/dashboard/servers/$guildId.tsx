import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

import {
  Avatar,
  EmptyList,
  LoadingNote,
  PageHeader,
  QueryError,
  VStack,
} from "../../../components/ui";
import { guildIconUrl } from "../../../lib/api";
import { useGuilds, useRequireAuth } from "../../../lib/queries";

const ServerScope = () => {
  const { guildId } = Route.useParams();
  const pathname = useLocation({ select: (location) => location.pathname });
  const me = useRequireAuth();
  const guilds = useGuilds(Boolean(me.data));
  const guild = guilds.data?.find((item) => item.id === guildId);
  const isSettings = pathname.endsWith("/settings");

  if (guilds.isPending) {
    return <LoadingNote>Loading server…</LoadingNote>;
  }
  if (guilds.isError) {
    return <QueryError error={guilds.error} />;
  }
  if (!guild) {
    return (
      <EmptyList
        title="Server unavailable"
        body="Choose a server you manage from the sidebar. Your Discord permissions may have changed."
      />
    );
  }

  return (
    <VStack gap={6}>
      <PageHeader
        title={isSettings ? "Settings" : "Jobs"}
        description={
          isSettings
            ? "Manage job subscriptions for this Discord server."
            : "Job alerts delivered to this Discord server."
        }
      />
      <div className="dashboard-scope-heading">
        <Avatar
          name={guild.name}
          src={guildIconUrl(guild.id, guild.icon) ?? undefined}
        />
        <span>{guild.name}</span>
      </div>
      <Outlet />
    </VStack>
  );
};

export const Route = createFileRoute("/dashboard/servers/$guildId")({
  component: ServerScope,
});
