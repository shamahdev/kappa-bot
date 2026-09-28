import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Avatar } from '@astryxdesign/core/Avatar';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { PageHeader, QueryError, TextInput } from '../../components/ui';
import { guildIconUrl, userAvatarUrl } from '../../lib/api';
import { useGuilds, useRequireAuth, useSubscriptions } from '../../lib/queries';

export const Route = createFileRoute('/dashboard/')({
  ssr: false,
  component: DashboardComponent,
});

function countsLine(active: number, total: number): string {
  return `${active} active · ${total} total`;
}

function DashboardComponent() {
  const me = useRequireAuth();
  const guilds = useGuilds(me.data != null);
  const subs = useSubscriptions(me.data != null);
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  if (me.isPending || me.data == null) {
    return <Text color="secondary">Loading…</Text>;
  }

  const dmSubs = subs.data?.filter((s) => s.scope === 'dm') ?? [];
  const dmActive = dmSubs.filter((s) => s.isActive).length;
  const dmAvatar = userAvatarUrl(me.data.discordId, me.data.avatar);
  const term = q.trim().toLowerCase();
  const visibleGuilds = (guilds.data ?? []).filter((g) =>
    term === '' ? true : g.name.toLowerCase().includes(term),
  );
  const showDm = term === '' || 'direct messages'.includes(term);

  return (
    <VStack gap={6}>
      <PageHeader title="Subscriptions" description="DMs and servers you can manage." />
      <VStack gap={4}>
        <TextInput label="Search servers" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Server name" />
        <Grid columns={{ minWidth: 260 }} gap={4}>
          {showDm ? (
            <ClickableCard label="Direct messages" onClick={() => void navigate({ to: '/dashboard/dm' })}>
              <HStack gap={3} vAlign="center">
                <Avatar name={me.data.username} src={dmAvatar ?? undefined} size="lg" />
                <VStack gap={0}>
                  <Heading level={3}>Direct messages</Heading>
                  <Text type="supporting" color="secondary">
                    {subs.isPending ? 'Loading…' : countsLine(dmActive, dmSubs.length)}
                  </Text>
                </VStack>
              </HStack>
            </ClickableCard>
          ) : null}
          {visibleGuilds.map((g) => (
            <ClickableCard
              key={g.id}
              label={g.name}
              onClick={() => void navigate({ to: '/dashboard/servers/$guildId', params: { guildId: g.id } })}
            >
              <HStack gap={3} vAlign="center">
                <Avatar name={g.name} src={guildIconUrl(g.id, g.icon) ?? undefined} size="lg" />
                <VStack gap={0}>
                  <Heading level={3}>{g.name}</Heading>
                  <Text type="supporting" color="secondary">
                    {countsLine(g.subscriptions.active, g.subscriptions.total)}
                  </Text>
                </VStack>
              </HStack>
            </ClickableCard>
          ))}
        </Grid>
        {guilds.isPending ? <Text color="secondary">Loading servers…</Text> : null}
        {guilds.isError ? <QueryError error={guilds.error} /> : null}
      </VStack>
    </VStack>
  );
}

