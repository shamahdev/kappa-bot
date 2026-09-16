import { Link, createFileRoute } from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { Button } from '../components/ui';
import { loginUrl } from '../lib/api';
import { useMe } from '../lib/queries';
import { useMounted } from '../lib/useMounted';
import { fonts, tokens } from '../theme.stylex';

export const Route = createFileRoute('/')({ component: LandingComponent });

const page = stylex.create({
  wrap: { maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28, paddingTop: 28 },
  headline: {
    fontFamily: fonts.sans,
    fontSize: 40,
    lineHeight: '44px',
    letterSpacing: '-0.02em',
    fontWeight: 800,
    color: tokens.ink,
  },
  lede: { fontFamily: fonts.sans, fontSize: 17, lineHeight: '26px', color: tokens.muted },
  actions: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  loginLink: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: tokens.brand,
    color: '#ffffff',
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: 700,
    lineHeight: '22px',
    padding: '10px 20px',
    borderRadius: tokens.radiusSm,
    textDecoration: 'none',
    ':hover': { backgroundColor: tokens.brandHover },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: tokens.focus, outlineOffset: 2 },
  },
  dashboardLink: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: tokens.accent,
    color: tokens.accentInk,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: 700,
    lineHeight: '22px',
    padding: '10px 20px',
    borderRadius: tokens.radiusSm,
    textDecoration: 'none',
    ':hover': { backgroundColor: tokens.accentHover },
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens.line,
  },
  row: {
    display: 'flex',
    gap: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.line,
  },
  index: { fontFamily: fonts.mono, fontSize: 13, color: tokens.muted, minWidth: 28, paddingTop: 2 },
  rowTitle: { fontFamily: fonts.sans, fontSize: 15, fontWeight: 700, color: tokens.ink, lineHeight: '22px' },
  rowBody: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, lineHeight: '21px' },
  fine: { fontFamily: fonts.sans, fontSize: 13, lineHeight: '20px', color: tokens.muted },
  sectionTitle: { fontFamily: fonts.sans, fontSize: 13, fontWeight: 700, color: tokens.ink, lineHeight: '18px' },
});

function AuthAction() {
  const mounted = useMounted();
  const me = useMe();
  // SSR and signed-out states show the static login link; only a positively
  // authenticated client swaps it for the dashboard link.
  if (mounted && me.data) {
    return (
      <Link {...stylex.props(page.dashboardLink)} to="/dashboard">
        Open dashboard
      </Link>
    );
  }
  return (
    <a {...stylex.props(page.loginLink)} href={loginUrl}>
      Login with Discord
    </a>
  );
}

const CAPABILITIES: Array<[string, string]> = [
  ['Pause a noisy subscription', 'One toggle stops delivery; resume whenever. Nothing is lost.'],
  ['Retune keywords and location', 'Edit the filter any time. Source and channel stay fixed.'],
  ['Prune what you no longer need', 'Delete with one inline confirm. Seen-job history goes with it.'],
  ['Leave entirely', 'Delete your account from settings. Guilds and other users are untouched.'],
];

function LandingComponent() {
  return (
    <div {...stylex.props(page.wrap)}>
      <div>
        <h1 {...stylex.props(page.headline)}>Job alerts, tuned from the web.</h1>
      </div>
      <p {...stylex.props(page.lede)}>
        Kappa delivers job postings to Discord — your DMs and the servers you set up.
        Sign in to pause, retune, or prune your subscriptions without touching slash commands.
      </p>
      <div {...stylex.props(page.actions)}>
        <AuthAction />
        <Button variant="subtle" onClick={() => document.getElementById('capabilities')?.scrollIntoView()}>
          What you can do
        </Button>
      </div>
      <div>
        <h2 {...stylex.props(page.sectionTitle)} id="capabilities">
          What you can do here
        </h2>
        <ul {...stylex.props(page.list)}>
          {CAPABILITIES.map(([title, body], i) => (
            <li key={title} {...stylex.props(page.row)}>
              <span {...stylex.props(page.index)} aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                <span {...stylex.props(page.rowTitle)}>{title}</span>
                <br />
                <span {...stylex.props(page.rowBody)}>{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p {...stylex.props(page.fine)}>
        Sign-in uses Discord OAuth via the Kappa service. This dashboard stores no passwords
        and handles no tokens — your session lives in an HttpOnly cookie.
      </p>
    </div>
  );
}
