import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import { Button, ErrorNote, Field, TextInput } from '../../components/ui';
import { apiMessage, useAccountSummary, useDeleteAccount, useMe } from '../../lib/queries';
import { fonts, tokens } from '../../theme.stylex';

export const Route = createFileRoute('/dashboard/settings')({
  ssr: false,
  component: SettingsComponent,
});

const CONFIRM_PHRASE = 'delete my account';

const page = stylex.create({
  title: { fontFamily: fonts.sans, fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: '34px', color: tokens.ink },
  sub: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, lineHeight: '21px', marginTop: 6 },
  back: { fontFamily: fonts.sans, fontSize: 14, fontWeight: 600, color: tokens.muted, textDecoration: 'none', ':hover': { color: tokens.ink } },
  backWrap: { marginBottom: 16 },
  section: { marginTop: 28, maxWidth: 640 },
  sectionTitle: { fontFamily: fonts.sans, fontSize: 15, fontWeight: 700, color: tokens.ink, lineHeight: '22px' },
  panel: {
    marginTop: 12,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens.line,
    borderRadius: tokens.radiusMd,
    padding: 18,
  },
  dangerPanel: { borderColor: '#fecaca' },
  dl: { display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 10, columnGap: 16, margin: 0 },
  dt: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, lineHeight: '21px' },
  dd: { fontFamily: fonts.sans, fontSize: 14, fontWeight: 600, color: tokens.ink, lineHeight: '21px', margin: 0 },
  mono: { fontFamily: fonts.mono, fontSize: 13, fontWeight: 400 },
  brief: { fontFamily: fonts.sans, fontSize: 14, color: tokens.ink, lineHeight: '22px', marginTop: 12 },
  fieldGap: { marginTop: 14 },
  buttons: { display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' },
  errorGap: { marginTop: 12 },
  stateLine: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, paddingTop: 24, paddingBottom: 24 },
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
    return <p {...stylex.props(page.stateLine)}>Loading settings…</p>;
  }

  const phraseOk = phrase.trim() === CONFIRM_PHRASE;

  return (
    <div>
      <div {...stylex.props(page.backWrap)}>
        <Link {...stylex.props(page.back)} to="/dashboard">
          ← Back to dashboard
        </Link>
      </div>
      <h1 {...stylex.props(page.title)}>Settings</h1>
      <p {...stylex.props(page.sub)}>Your account, and the way out.</p>

      <section {...stylex.props(page.section)} aria-label="Account summary">
        <h2 {...stylex.props(page.sectionTitle)}>Account</h2>
        <div {...stylex.props(page.panel)}>
          {summary.isPending ? (
            <p {...stylex.props(page.sub)}>Loading account summary…</p>
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
        </div>
      </section>

      <section {...stylex.props(page.section)} aria-label="Delete account">
        <h2 {...stylex.props(page.sectionTitle)}>Delete account</h2>
        <div {...stylex.props(page.panel, page.dangerPanel)}>
          {summary.data ? (
            <p {...stylex.props(page.brief)}>
              Deletes your account (discord @{summary.data.username}),{' '}
              {summary.data.connections.length} connection
              {summary.data.connections.length === 1 ? '' : 's'} (
              {summary.data.connections.join(', ') || 'none'}), {summary.data.dmSubscriptions}{' '}
              DM subscription{summary.data.dmSubscriptions === 1 ? '' : 's'},{' '}
              {summary.data.guildSubscriptionsCreated} guild subscription
              {summary.data.guildSubscriptionsCreated === 1 ? '' : 's'} you created, and their
              seen-job history. Guilds, channels, and other users&apos; subscriptions are untouched.
              Irreversible.
            </p>
          ) : (
            <p {...stylex.props(page.brief)}>
              Deletes your account, connections, DM subscriptions, guild subscriptions you created,
              and their seen-job history. Guilds, channels, and other users&apos; subscriptions are
              untouched. Irreversible.
            </p>
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
              <Field label={`Type "${CONFIRM_PHRASE}" to confirm`}>
                <TextInput
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  disabled={destroy.isPending}
                  autoComplete="off"
                />
              </Field>
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
              <Link {...stylex.props(page.back)} to="/dashboard">
                Keep my account
              </Link>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
