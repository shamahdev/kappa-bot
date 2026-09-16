import * as stylex from '@stylexjs/stylex';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { fonts, tokens } from '../theme.stylex';

const button = stylex.create({
  base: {
    appearance: 'none',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '20px',
    padding: '8px 16px',
    textDecoration: 'none',
    transitionProperty: 'background-color, border-color, color',
    transitionDuration: '120ms',
    ':focus-visible': {
      outlineWidth: 2,
      outlineStyle: 'solid',
      outlineColor: tokens.focus,
      outlineOffset: 2,
    },
    ':disabled': {
      cursor: 'not-allowed',
      opacity: 0.55,
    },
  },
  primary: { backgroundColor: tokens.accent, color: tokens.accentInk, ':hover': { backgroundColor: tokens.accentHover } },
  brand: { backgroundColor: tokens.brand, color: '#ffffff', ':hover': { backgroundColor: tokens.brandHover } },
  subtle: {
    backgroundColor: tokens.surface,
    borderColor: tokens.lineStrong,
    color: tokens.ink,
    ':hover': { backgroundColor: tokens.surfaceSunken },
  },
  danger: { backgroundColor: tokens.danger, color: '#ffffff', ':hover': { backgroundColor: tokens.dangerHover } },
  dangerSubtle: {
    backgroundColor: tokens.surface,
    borderColor: tokens.lineStrong,
    color: tokens.danger,
    ':hover': { backgroundColor: tokens.dangerBg },
  },
  small: { fontSize: 13, padding: '5px 12px' },
});

type ButtonVariant = 'primary' | 'brand' | 'subtle' | 'danger' | 'dangerSubtle';

export function Button({
  variant = 'primary',
  small = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; small?: boolean }) {
  return (
    <button
      {...rest}
      {...stylex.props(button.base, button[variant], small && button.small)}
    />
  );
}

const fieldStyles = stylex.create({
  wrap: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  label: { fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: tokens.ink, lineHeight: '18px' },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: tokens.muted, lineHeight: '18px' },
  control: {
    appearance: 'none',
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens.lineStrong,
    borderRadius: tokens.radiusSm,
    color: tokens.ink,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: '20px',
    padding: '8px 12px',
    width: '100%',
    boxSizing: 'border-box',
    ':focus': { outline: 'none', borderColor: tokens.focus, boxShadow: `0 0 0 3px color-mix(in srgb, ${'#2563eb'} 18%, transparent)` },
    ':disabled': { backgroundColor: tokens.surfaceSunken, cursor: 'not-allowed' },
  },
  mono: { fontFamily: fonts.mono },
});

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label {...stylex.props(fieldStyles.wrap)}>
      <span {...stylex.props(fieldStyles.label)}>{label}</span>
      {children}
      {hint ? <span {...stylex.props(fieldStyles.hint)}>{hint}</span> : null}
    </label>
  );
}

type ControlProps = {
  mono?: boolean;
  invalid?: boolean;
};

export function TextInput({
  mono = false,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & ControlProps) {
  return <input {...rest} {...stylex.props(fieldStyles.control, mono && fieldStyles.mono)} />;
}

export function Select({ ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} {...stylex.props(fieldStyles.control)} />;
}

const note = stylex.create({
  base: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: tokens.radiusMd,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: '20px',
    padding: '12px 14px',
  },
  error: { backgroundColor: tokens.dangerBg, borderColor: '#fecaca', color: tokens.danger },
  info: { backgroundColor: tokens.surfaceSunken, borderColor: tokens.line, color: tokens.muted },
});

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" {...stylex.props(note.base, note.error)}>
      {children}
    </p>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p {...stylex.props(note.base, note.info)}>
      {children}
    </p>
  );
}

const badge = stylex.create({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens.line,
    borderRadius: 999,
    backgroundColor: tokens.surface,
    color: tokens.muted,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: '16px',
    padding: '2px 10px',
    whiteSpace: 'nowrap',
  },
  dot: { width: 7, height: 7, borderRadius: '50%', backgroundColor: tokens.lineStrong },
  dotOn: { backgroundColor: tokens.success },
  strong: { color: tokens.ink, borderColor: tokens.lineStrong },
});

export function Badge({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return <span {...stylex.props(badge.base, strong && badge.strong)}>{children}</span>;
}

export function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span {...stylex.props(badge.base, badge.strong)}>
      <span {...stylex.props(badge.dot, on && badge.dotOn)} aria-hidden />
      {label}
    </span>
  );
}
