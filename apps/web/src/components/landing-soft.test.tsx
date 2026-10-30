import { describe, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { LandingSoft } from "./landing-soft";

const html = () =>
  renderToStaticMarkup(
    <LandingSoft primaryAction={<a href="/login">Log in with Discord</a>} />
  );

describe("homepage offer", () => {
  test("explains matching alerts instead of checking job sites", () => {
    const markup = html();
    expect(markup).toContain("Job matches,");
    expect(markup).toContain("delivered to you.");
    expect(markup).toContain("new jobs match your keywords or CV");
    expect(markup).toContain("Spend less time checking job sites.");
  });

  test("renders the primary sign-in action once and retains the mobile mascot", () => {
    const markup = html();
    expect(markup.split('href="/login"').length - 1).toBe(1);
    expect(markup).toContain('class="landing-mascot"');
  });

  test("keeps Free and marks Premium features as coming soon", () => {
    const markup = html();
    expect(markup).toContain('id="free-plan-title">Free');
    expect(markup).toContain('id="premium-plan-title">Premium');
    expect(markup).toContain("[Coming Soon]");
    expect(markup).toContain("Subscriptions to multiple channels via webhooks");
    expect(markup).toContain("Configurable notification times");
    expect(markup).toContain("Automatic keywords from your CV");
    const [, premiumSection] = markup.split(
      'aria-labelledby="premium-plan-title"'
    );
    const [premium] = premiumSection.split("</article>");
    expect(premium).not.toContain("<a");
    expect(premium).not.toContain("<button");
  });
});
