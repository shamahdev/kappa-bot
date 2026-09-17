import * as stylex from '@stylexjs/stylex';

/**
 * Kappa theme tokens: warm paper, ink text, hairline borders, kappa-green
 * accent (#3f6b55). No gradients, no glow, no glass. Forced light (see root
 * Theme mode + color-scheme) so Astryx and custom surfaces always agree.
 */
export const tokens = stylex.defineVars({
  bg: '#faf9f7',
  surface: '#ffffff',
  surfaceSunken: '#f3f2ee',
  ink: '#1c1917',
  muted: '#57534e',
  line: '#e7e5e0',
  lineStrong: '#d6d3d1',
  accent: '#3f6b55',
  accentHover: '#365b48',
  accentInk: '#ffffff',
  accentSoft: '#ecf0ee',
  brand: '#3f6b55',
  brandHover: '#365b48',
  danger: '#b91c1c',
  dangerHover: '#991b1b',
  dangerBg: '#fef2f2',
  success: '#15803d',
  successBg: '#f0fdf4',
  warnBg: '#fffbeb',
  focus: '#3f6b55',
  radiusSm: '6px',
  radiusMd: '10px',
  radiusLg: '14px',
});

export const fonts = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
};
