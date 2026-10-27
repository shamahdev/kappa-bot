import { describe, expect, test } from "bun:test";

import { resolveThemeTokens } from "@astryxdesign/core/theme/tokens";

import { kappaTheme } from "./built/kappa";

const luminance = (hex: string) => {
  const values = hex
    .replace("#", "")
    .match(/../gu)
    ?.map((value) => {
      const channel = Number.parseInt(value, 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  if (!values || values.length !== 3) {
    throw new Error(`Expected resolved hex color, received ${hex}`);
  }
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};

describe("Kappa theme foundation", () => {
  test("retains the Neutral icon registry in the compiled theme", () => {
    expect(kappaTheme.__built).toBe(true);
    expect(Object.keys(kappaTheme.icons ?? {}).length).toBeGreaterThan(0);
  });

  for (const mode of ["light", "dark"] as const) {
    test(`${mode} accent foreground meets WCAG AA normal-text contrast`, () => {
      const tokens = resolveThemeTokens(kappaTheme, { mode });
      if (mode === "light") {
        expect(tokens["--color-background-body"].toLowerCase()).toBe("#f1f1f1");
      }
      const accent = luminance(tokens["--color-accent"]);
      const text = luminance(tokens["--color-on-accent"]);
      const ratio =
        (Math.max(accent, text) + 0.05) / (Math.min(accent, text) + 0.05);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(tokens["--font-family-body"]).not.toContain("Figtree");
    });
  }
});
