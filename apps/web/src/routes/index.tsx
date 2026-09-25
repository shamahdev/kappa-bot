import { Link, createFileRoute } from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { LandingDemo } from '../components/landing-demo';
import { loginUrl } from '../lib/api';
import { useMe } from '../lib/queries';
import { useMounted } from '../lib/useMounted';
import { fonts, tokens } from '../theme.stylex';

export const Route = createFileRoute('/')({
  component: LandingComponent,
  head: () => ({
    meta: [
      { title: 'Kappa — a focused job signal' },
      { name: 'description', content: 'Kappa turns your CV into a focused feed of roles worth your time.' },
    ],
  }),
});

const authStyles = stylex.create({
  loginLink: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 36,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.brand,
    color: tokens.accentInk,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: '20px',
    textDecoration: 'none',
    ':hover': { backgroundColor: tokens.brandHover },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: tokens.focus, outlineOffset: 2 },
  },
  dashboardLink: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 36,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.accent,
    color: tokens.accentInk,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: '20px',
    textDecoration: 'none',
    ':hover': { backgroundColor: tokens.accentHover },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: tokens.focus, outlineOffset: 2 },
  },
});

function AuthAction() {
  const mounted = useMounted();
  const me = useMe();
  // SSR and signed-out states show the static login link; only a positively
  // authenticated client swaps it for the dashboard link.
  if (mounted && me.data) {
    return <Link {...stylex.props(authStyles.dashboardLink)} to="/dashboard">Open dashboard</Link>;
  }
  return <a {...stylex.props(authStyles.loginLink)} href={loginUrl}>Login with Discord</a>;
}

function LandingComponent() {
  return <LandingDemo authAction={<AuthAction />} />;
}
