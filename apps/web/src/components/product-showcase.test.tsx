import { describe, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { DiscordPreview } from "./product-showcase";

describe("Discord preview delivery format", () => {
  test("shows a complete static conversation without reply controls", () => {
    const html = renderToStaticMarkup(<DiscordPreview />);
    expect(html).toContain("discord-summary");
    expect(html).toContain("IT Specialist @ Sakuraland");
    expect(html).toContain("Kewajiban Utama");
    expect(html).toContain("Keahlian Tambahan");
    expect(html).toContain("Bekasi Kota");
    expect(html).toContain("3:36 PM");
    expect(html).toContain("<strong>You</strong>");
    expect(html).not.toContain("Shamah");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
    expect(html).not.toContain('aria-live="polite"');
  });

  test("shows the real app's numbered delivery embed and reply instruction", () => {
    const html = renderToStaticMarkup(<DiscordPreview />);
    expect(html).toContain("discord-embed");
    expect(html).toContain("4 new");
    expect(html).toContain("jobs found in Kalibrr");
    expect(html).toContain("APP");
    expect(html).toContain("3:30 PM");
    expect(html).toContain("Reply with 1–4 to get the summary of the job");
    expect(html).toContain(" @ ");
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("Select a posting or reply with its number");
  });
});
