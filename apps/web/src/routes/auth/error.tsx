import { Link, createFileRoute } from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { loginUrl } from '../../lib/api';
import { fonts, tokens } from '../../theme.stylex';

export const Route = createFileRoute('/auth/error')({ component: AuthErrorComponent });

const page = stylex.create({
  wrap: { maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 28 },
  title: { fontFamily: fonts.sans, fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: '34px', color: tokens.ink },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: '23px', color: tokens.muted },
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 },
  primary: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: tokens.brand,
    color: '#ffffff',
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: '20px',
    padding: '8px 16px',
    borderRadius: tokens.radiusSm,
    textDecoration: 'none',
    ':hover': { backgroundColor: tokens.brandHover },
  },
  secondary: {
    display: 'inline-flex',
    alignItems: 'center',
    color: tokens.ink,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '20px',
    padding: '8px 16px',
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens.lineStrong,
    backgroundColor: tokens.surface,
    textDecoration: 'none',
    ':hover': { backgroundColor: tokens.surfaceSunken },
  },
});

function AuthErrorComponent() {
  return (
    <div {...stylex.props(page.wrap)}>
      <h1 {...stylex.props(page.title)}>Sign-in didn&apos;t go through</h1>
      <p {...stylex.props(page.body)}>
        Discord didn&apos;t approve the sign-in, or the request expired. No account was created
        and nothing changed — try again, or head back home.
      </p>
      <div {...stylex.props(page.actions)}>
        <a {...stylex.props(page.primary)} href={loginUrl}>
          Try again
        </a>
        <Link {...stylex.props(page.secondary)} to="/">
          Back home
        </Link>
      </div>
    </div>
  );
}
