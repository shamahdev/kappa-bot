import * as stylex from '@stylexjs/stylex';

/**
 * Kappa theme tokens — Astryx-neutral light + Kappa green.
 * Surfaces/text/borders mirror @astryxdesign/theme-neutral light values
 * (--color-background-body/surface, --color-text-primary/secondary,
 * --color-border/emphasized); accent/brand/focus stay Kappa green (#3f6b55).
 * See docs/DESIGN_STANDARD.md §1. Only hex source in apps/web.
 */
export const tokens = stylex.defineVars({
  bg: '#F1F4F7',
  surface: '#FFFFFF',
  surfaceSunken: 'rgba(5, 54, 89, 0.05)',
  ink: '#0A1317',
  muted: '#4E606F',
  line: 'rgba(5, 54, 89, 0.10)',
  lineStrong: '#CCD3DB',
  accent: '#3f6b55',
  accentHover: '#365b48',
  accentInk: '#FFFFFF',
  accentSoft: '#EAF0EC',
  brand: '#3f6b55',
  brandHover: '#365b48',
  danger: '#E3193B',
  dangerHover: '#AA071E',
  dangerBg: 'rgba(227, 25, 59, 0.08)',
  success: '#0D8626',
  successBg: 'rgba(13, 134, 38, 0.08)',
  warnBg: 'rgba(233, 175, 8, 0.12)',
  focus: '#3f6b55',
  radiusSm: '6px',
  radiusMd: '10px',
  radiusLg: '14px',
});

export const fonts = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
};
