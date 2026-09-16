import * as stylex from '@stylexjs/stylex';

/**
 * Neutral theme tokens (Astryx neutral direction: warm paper, ink text,
 * hairline borders, one restrained accent). No gradients, no glow, no glass.
 */
export const tokens = stylex.defineVars({
  bg: '#faf9f7',
  surface: '#ffffff',
  surfaceSunken: '#f3f2ee',
  ink: '#1c1917',
  muted: '#57534e',
  line: '#e7e5e0',
  lineStrong: '#d6d3d1',
  accent: '#1c1917',
  accentHover: '#292524',
  accentInk: '#ffffff',
  brand: '#5865f2',
  brandHover: '#4752c4',
  danger: '#b91c1c',
  dangerHover: '#991b1b',
  dangerBg: '#fef2f2',
  success: '#15803d',
  successBg: '#f0fdf4',
  warnBg: '#fffbeb',
  focus: '#2563eb',
  radiusSm: '6px',
  radiusMd: '10px',
  radiusLg: '14px',
});

export const fonts = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
};
