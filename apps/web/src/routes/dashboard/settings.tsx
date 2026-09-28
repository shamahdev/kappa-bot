import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Layout';
import { BackLink, Button, ErrorNote, PageHeader, SectionCard, TextInput } from '../../components/ui';
import { apiMessage, useAccountSummary, useDeleteAccount, useMe } from '../../lib/queries';
import { fonts, tokens } from '../../theme.stylex';

export const Route = createFileRoute('/dashboard/settings')({
  ssr: false,
  component: SettingsComponent,
});

const CONFIRM_PHRASE = 'delete my account';

const page = stylex.create({
  dl: { display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 10, columnGap: 16, margin: 0 },
  dt: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, lineHeight: '21px' },
  dd: { fontFamily: fonts.sans, fontSize: 14, fontWeight: 600, color: tokens.ink, lineHeight: '21px', margin: 0 },
  mono: { fontFamily: fonts.mono, fontSize: 13, fontWeight: 400 },
  fieldGap: { marginTop: 4 },
  buttons: { display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' },
  errorGap: { marginTop: 12 },
  constrain: { maxWidth: 640, width: '100%' },
});

function SettingsComponent() {
  const navigate = useNavigate();
  const me = useMe();
  const summary = useAccountSummary(me.data != null);
  const destroy = useDeleteAccount();
  const [phrase, setPhrase] = useState('');

  useEffect(() => {
    if (me.data === null) void navigate({ to: '/' });
  }, [me.data, navigate]);

  if (me.isPending || me.data === null) {
    return <Text color="secondary">Loading settings…</Text>;
  }

  const phraseOk = phrase.trim() === CONFIRM_PHRASE;

  return (
    <VStack gap={4}>
      <BackLink to="/dashboard" label="← Back to dashboard" />
      <PageHeader title="Settings" description="Your account, and the way out." />
      <div {...stylex.props(page.constrain)}>
        <VStack gap={4}>
          <SectionCard title="Account">
            {summary.isPending ? (
              <Text color="secondary">Loading account summary…</Text>
            ) : summary.isError ? (
              <ErrorNote>{apiMessage(summary.error)}</ErrorNote>
            ) : (
              <dl {...stylex.props(page.dl)}>
                <dt {...stylex.props(page.dt)}>Discord</dt>
                <dd {...stylex.props(page.dd)}>
                  @{summary.data.username}{' '}
                  <span {...stylex.props(page.mono)} title={summary.data.discordId}>
                    ({summary.data.discordId})
                  </span>
                </dd>
                <dt {...stylex.props(page.dt)}>Connections</dt>
                <dd {...stylex.props(page.dd)}>
                  {summary.data.connections.length > 0 ? summary.data.connections.join(', ') : 'none'}
                </dd>
                <dt {...stylex.props(page.dt)}>DM subscriptions</dt>
                <dd {...stylex.props(page.dd)}>{summary.data.dmSubscriptions}</dd>
                <dt {...stylex.props(page.dt)}>Server subscriptions created</dt>
                <dd {...stylex.props(page.dd)}>{summary.data.guildSubscriptionsCreated}</dd>
                <dt {...stylex.props(page.dt)}>Active sessions</dt>
                <dd {...stylex.props(page.dd)}>{summary.data.sessionsActive}</dd>
              </dl>
            )}
          </SectionCard>

          <SectionCard title="Delete account" variant="muted">
            {summary.data ? (
              <Text>
                Deletes your account (discord @{summary.data.username}), {summary.data.connections.length} connection
                {summary.data.connections.length === 1 ? '' : 's'} ({summary.data.connections.join(', ') || 'none'}),{' '}
                {summary.data.dmSubscriptions} DM subscription{summary.data.dmSubscriptions === 1 ? '' : 's'},{' '}
                {summary.data.guildSubscriptionsCreated} guild subscription
                {summary.data.guildSubscriptionsCreated === 1 ? '' : 's'} you created, and their seen-job history.
                Guilds, channels, and other users&apos; subscriptions are untouched. Irreversible.
              </Text>
            ) : (
              <Text>
                Deletes your account, connections, DM subscriptions, guild subscriptions you created, and their
                seen-job history. Guilds, channels, and other users&apos; subscriptions are untouched. Irreversible.
              </Text>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!phraseOk || destroy.isPending) return;
                destroy.reset();
                destroy.mutate(undefined, { onSuccess: () => void navigate({ to: '/' }) });
              }}
            >
              <div {...stylex.props(page.fieldGap)}>
                <TextInput
                  label={`Type "${CONFIRM_PHRASE}" to confirm`}
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  disabled={destroy.isPending}
                  autoComplete="off"
                />
              </div>
              {destroy.isError ? (
                <div {...stylex.props(page.errorGap)}>
                  <ErrorNote>{apiMessage(destroy.error)}</ErrorNote>
                </div>
              ) : null}
              <div {...stylex.props(page.buttons)}>
                <Button type="submit" variant="danger" disabled={!phraseOk || destroy.isPending}>
                  {destroy.isPending ? 'Deleting…' : 'Delete my account'}
                </Button>
                <Link to="/dashboard" style={{ fontSize: 14, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                  Keep my account
                </Link>
              </div>
            </form>
          </SectionCard>
        </VStack>
      </div>
    </VStack>
  );
}
