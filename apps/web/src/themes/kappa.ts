import { defineTheme } from "@astryxdesign/core/theme";
import {
  neutralIconRegistry,
  neutralTheme,
} from "@astryxdesign/theme-neutral/built";

// Preserve Neutral's surfaces and status palette; generate only the accent family.
const accentTokens = new Set([
  "--color-accent",
  "--color-accent-muted",
  "--color-on-accent",
  "--color-text-accent",
  "--color-icon-accent",
]);
const neutralTokens = Object.fromEntries(
  Object.entries(neutralTheme.tokens).filter(
    ([token]) => !accentTokens.has(token)
  )
);

/** Neutral foundations with the existing Kappa accent and explicit system type. */
export const kappaTheme = defineTheme({
  name: "kappa",
  extends: neutralTheme,
  icons: neutralIconRegistry,
  color: { accent: "#3f6b55", neutralStyle: "neutral" },
  tokens: {
    ...neutralTokens,
    "--font-family-body":
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    "--font-family-heading":
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    "--focus-outline-color": "var(--color-accent)",
  },
});
