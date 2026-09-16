import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useNavigate,
} from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import '../styles.css';
import { Button } from '../components/ui';
import { useLogout, useMe } from '../lib/queries';
import { useMounted } from '../lib/useMounted';
import { loginUrl } from '../lib/api';
import { fonts, tokens } from '../theme.stylex';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Kappa — job subscriptions' },
    ],
  }),
  component: RootComponent,
});

const layout = stylex.create({
  shell: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.bg,
    color: tokens.ink,
  },
  topbar: {
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.line,
    backgroundColor: tokens.surface,
  },
  topbarInner: {
    maxWidth: 980,
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: 20,
    paddingRight: 20,
    height: 58,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  wordmark: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    textDecoration: 'none',
    color: tokens.ink,
  },
  nav: { display: 'flex', alignItems: 'center', gap: 8 },
  navLink: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: 600,
    color: tokens.muted,
    textDecoration: 'none',
    padding: '6px 10px',
    borderRadius: tokens.radiusSm,
    ':hover': { color: tokens.ink, backgroundColor: tokens.surfaceSunken },
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: 980,
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 36,
    paddingBottom: 64,
  },
  footer: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens.line,
  },
  footerInner: {
    maxWidth: 980,
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 18,
    paddingBottom: 18,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: tokens.muted,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
});

function TopNav() {
  const mounted = useMounted();
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  if (!mounted || me.isPending) return <div {...stylex.props(layout.nav)} />;
  if (!me.data) {
    return (
      <nav {...stylex.props(layout.nav)} aria-label="Account">
        <a {...stylex.props(layout.navLink)} href={loginUrl}>
          Log in with Discord
        </a>
      </nav>
    );
  }
  return (
    <nav {...stylex.props(layout.nav)} aria-label="Account">
      <Link
        {...stylex.props(layout.navLink)}
        to="/dashboard"
        activeProps={{ style: { color: tokens.ink } }}
      >
        Dashboard
      </Link>
      <Link
        {...stylex.props(layout.navLink)}
        to="/dashboard/settings"
        activeProps={{ style: { color: tokens.ink } }}
      >
        Settings
      </Link>
      <Button
        variant="subtle"
        small
        disabled={logout.isPending}
        onClick={() => {
          logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) });
        }}
      >
        {logout.isPending ? 'Signing out…' : 'Sign out'}
      </Button>
    </nav>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <div {...stylex.props(layout.shell)}>
            <header {...stylex.props(layout.topbar)}>
              <div {...stylex.props(layout.topbarInner)}>
                <Link {...stylex.props(layout.wordmark)} to="/">
                  Kappa
                </Link>
                <TopNav />
              </div>
            </header>
            <main {...stylex.props(layout.main)}>
              <Outlet />
            </main>
            <footer {...stylex.props(layout.footer)}>
              <div {...stylex.props(layout.footerInner)}>
                <span>Kappa job subscriptions</span>
                <span>Delivery happens in Discord; this dashboard manages it.</span>
              </div>
            </footer>
          </div>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
