import { Link, createFileRoute } from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { Button, ErrorNote } from '../../components/ui';
import { guildIconUrl, loginUrl, userAvatarUrl } from '../../lib/api';
import {
  ApiError,
  apiMessage,
  useGuilds,
  useRequireAuth,
  useSubscriptions,
} from '../../lib/queries';
import { fonts, tokens } from '../../theme.stylex';

export const Route = createFileRoute('/dashboard/')({
  ssr: false,
  component: DashboardComponent,
});

const page = stylex.create({
  title: { fontFamily: fonts.sans, fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: '34px', color: tokens.ink },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 12,
    marginTop: 20,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens.line,
    borderRadius: tokens.radiusMd,
    padding: '16px 18px',
    textDecoration: 'none',
    color: tokens.ink,
    ':hover': { borderColor: tokens.accent },
  },
  avatar: { width: 44, height: 44, borderRadius: tokens.radiusMd, flexShrink: 0 },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: tokens.radiusMd,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.accent,
    color: tokens.accentInk,
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: 800,
  },
  cardName: { fontFamily: fonts.sans, fontSize: 15, fontWeight: 700, lineHeight: '22px' },
  cardSub: { fontFamily: fonts.sans, fontSize: 13, color: tokens.muted, lineHeight: '20px', marginTop: 2 },
  stateLine: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, paddingTop: 24, paddingBottom: 24 },
  errorGap: { marginTop: 12 },
  reconnectRow: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 },
});

function countsLine(active: number, total: number): string {
  return `${active} active · ${total} total`;
}

function DashboardComponent() {
  const me = useRequireAuth();
  const guilds = useGuilds(me.data != null);
  const subs = useSubscriptions(me.data != null);

  if (me.isPending || me.data == null) {
    return <p {...stylex.props(page.stateLine)}>Loading…</p>;
  }

  const dmSubs = subs.data?.filter((s) => s.scope === 'dm') ?? [];
  const dmActive = dmSubs.filter((s) => s.isActive).length;
  const dmAvatar = userAvatarUrl(me.data.discordId, me.data.avatar);

  return (
    <div>
      <h1 {...stylex.props(page.title)}>Subscriptions</h1>
      <div {...stylex.props(page.grid)}>
        <Link to="/dashboard/dm" {...stylex.props(page.card)}>
          {dmAvatar ? (
            <img {...stylex.props(page.avatar)} src={dmAvatar} alt="" loading="lazy" />
          ) : (
            <span {...stylex.props(page.avatarFallback)} aria-hidden>
              {me.data.username.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span>
            <span {...stylex.props(page.cardName)}>Direct messages</span>
            <br />
            <span {...stylex.props(page.cardSub)}>
              {subs.isPending ? 'Loading…' : countsLine(dmActive, dmSubs.length)}
            </span>
          </span>
        </Link>

        {guilds.data?.map((g) => {
          const icon = guildIconUrl(g.id, g.icon);
          return (
            <Link
              key={g.id}
              to="/dashboard/servers/$guildId"
              params={{ guildId: g.id }}
              {...stylex.props(page.card)}
            >
              {icon ? (
                <img {...stylex.props(page.avatar)} src={icon} alt="" loading="lazy" />
              ) : (
                <span {...stylex.props(page.avatarFallback)} aria-hidden>
                  {g.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>
                <span {...stylex.props(page.cardName)}>{g.name}</span>
                <br />
                <span {...stylex.props(page.cardSub)}>
                  {countsLine(g.subscriptions.active, g.subscriptions.total)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {guilds.isPending ? <p {...stylex.props(page.stateLine)}>Loading servers…</p> : null}
      {guilds.isError ? (
        guilds.error instanceof ApiError && guilds.error.isReconnectRequired ? (
          <div>
            <p {...stylex.props(page.stateLine)}>Server cards need a fresh Discord login.</p>
            <div {...stylex.props(page.reconnectRow)}>
              <Button onClick={() => void (window.location.href = loginUrl)}>
                Reconnect Discord
              </Button>
            </div>
          </div>
        ) : (
          <div {...stylex.props(page.errorGap)}>
            <ErrorNote>{apiMessage(guilds.error)}</ErrorNote>
          </div>
        )
      ) : null}
    </div>
  );
}
