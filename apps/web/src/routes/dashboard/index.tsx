import { createFileRoute, Link as RouterLink } from "@tanstack/react-router";
import { useState } from "react";

import {
  Avatar,
  Button,
  EmptyList,
  HStack,
  LoadingNote,
  PageHeader,
  QueryError,
  Text,
  TextInput,
  VStack,
} from "../../components/ui";
import { guildIconUrl, userAvatarUrl } from "../../lib/api";
import { useGuilds, useRequireAuth, useSubscriptions } from "../../lib/queries";

export const Route = createFileRoute("/dashboard/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Subscriptions | Kappa" }] }),
  component: () => <DashboardComponent />,
});

const countsLine = (active: number, total: number): string =>
  `${active} active, ${total} total`;

const DashboardComponent = () => {
  const me = useRequireAuth();
  const guilds = useGuilds(Boolean(me.data));
  const subs = useSubscriptions(Boolean(me.data));
  const [q, setQ] = useState("");

  if (me.isError) {
    return <QueryError error={me.error} />;
  }
  if (!me.data) {
    return <LoadingNote />;
  }

  const dmSubs = subs.data?.filter((s) => s.scope === "dm") ?? [];
  const dmActive = dmSubs.filter((s) => s.isActive).length;
  const dmAvatar = userAvatarUrl(me.data.discordId, me.data.avatar);
  const term = q.trim().toLowerCase();
  const visibleGuilds = (guilds.data ?? []).filter((g) =>
    term === "" ? true : g.name.toLowerCase().includes(term)
  );
  const showDm = term === "" || "direct messages".includes(term);
  let dmCount = countsLine(dmActive, dmSubs.length);
  if (subs.isPending) {
    dmCount = "Loading subscriptions…";
  }
  if (subs.isError) {
    dmCount = "Subscriptions unavailable";
  }

  return (
    <VStack gap={6}>
      <PageHeader
        description="DMs and servers you can manage."
        title="Subscriptions"
      />
      <VStack gap={4}>
        <TextInput
          label="Search servers"
          onChange={(e) => setQ(e.target.value)}
          placeholder="Server name"
          value={q}
        />
        <div className="app-scope-grid">
          {showDm ? (
            <RouterLink
              aria-label="Direct messages"
              className="app-scope-card"
              to="/dashboard/dm"
            >
              <HStack gap={3} vAlign="center">
                <Avatar
                  name={me.data.username}
                  size="lg"
                  src={dmAvatar ?? undefined}
                />
                <VStack gap={1}>
                  <Text as="h2" weight="semibold">
                    Direct messages
                  </Text>
                  <Text color="secondary" type="supporting">
                    {dmCount}
                  </Text>
                </VStack>
              </HStack>
            </RouterLink>
          ) : null}
          {visibleGuilds.map((g) => (
            <RouterLink
              aria-label={g.name}
              className="app-scope-card"
              key={g.id}
              params={{ guildId: g.id }}
              to="/dashboard/servers/$guildId"
            >
              <HStack gap={3} vAlign="center">
                <Avatar
                  name={g.name}
                  size="lg"
                  src={guildIconUrl(g.id, g.icon) ?? undefined}
                />
                <VStack gap={1}>
                  <Text as="h2" weight="semibold">
                    {g.name}
                  </Text>
                  <Text color="secondary" type="supporting">
                    {countsLine(g.subscriptions.active, g.subscriptions.total)}
                  </Text>
                </VStack>
              </HStack>
            </RouterLink>
          ))}
        </div>
        {guilds.isPending ? <LoadingNote>Loading servers…</LoadingNote> : null}
        {subs.isError ? <QueryError error={subs.error} /> : null}
        {guilds.isError ? <QueryError error={guilds.error} /> : null}
        {guilds.isSuccess && !showDm && visibleGuilds.length === 0 ? (
          <EmptyList
            action={
              <Button onClick={() => setQ("")} small variant="subtle">
                Clear search
              </Button>
            }
            body="Try another server name or return to all subscriptions."
            title="No servers match this search"
          />
        ) : null}
        {guilds.isSuccess && !term && guilds.data.length === 0 ? (
          <Text color="secondary" type="supporting">
            No manageable servers yet. Your personal subscriptions are available
            in Direct messages.
          </Text>
        ) : null}
      </VStack>
    </VStack>
  );
};
