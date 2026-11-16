import { expect, test } from "bun:test";

import type { JobPosting } from "../domain/posting";
import { parsePostingFacts } from "./fact-extraction";
import {
  parsePostingDescription,
  fetchOriginalDescription,
} from "./sources/description";

const json = (quote: string, overrides = {}) =>
  JSON.stringify({
    salary: {
      currency: "IDR",
      evidence: quote,
      max: 12_000_000,
      min: 8_000_000,
      period: "month",
    },
    workEnvironment: "hybrid",
    workEnvironmentEvidence: "Two office days per week",
    ...overrides,
  });

test("accepts schema-valid extraction only with exact supporting evidence", () => {
  const evidence = "Rp 8–12 juta per bulan. Two office days per week.";
  expect(
    parsePostingFacts(json("Rp 8–12 juta per bulan"), evidence)?.salary?.max
  ).toBe(12_000_000);
  expect(
    parsePostingFacts(json("Salary invented by the model"), evidence)
  ).toBeNull();
  expect(
    parsePostingFacts(
      json("Rp 8–12 juta per bulan", {
        salary: {
          currency: "IDR",
          evidence: "Rp 8–12 juta per bulan",
          max: 8,
          min: 12,
          period: "month",
        },
      }),
      evidence
    )
  ).toBeNull();
  expect(
    parsePostingFacts(
      json("Rp 8–12 juta per bulan", { workEnvironment: "flexible" }),
      evidence
    )
  ).toBeNull();
  expect(
    parsePostingFacts(
      `\`\`\`json\n${JSON.stringify({ salary: null, workEnvironment: null, workEnvironmentEvidence: null })}\n\`\`\``,
      "No salary stated."
    )
  ).not.toBeNull();
});

test("reads original descriptions from JobPosting JSON-LD and source selectors", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "JobPosting", description: "<p>Remote.</p><p>Rp 12 juta per bulan.</p>" }] })}</script>`;
  expect(parsePostingDescription(html)).toBe(
    "Remote.\n\nRp 12 juta per bulan."
  );
  expect(
    parsePostingDescription(
      '<div id="jobDescriptionText"><p>Onsite in Jakarta</p></div>'
    )
  ).toBe("Onsite in Jakarta");
  expect(
    parsePostingDescription("<main>Company marketing, no posting</main>")
  ).toBeNull();
});

test("description fetch refuses redirects to non-source hosts and challenge pages", async () => {
  const job = {
    salary: null,
    source: "indeed",
    url: "https://id.indeed.com/viewjob?jk=abc",
  } as JobPosting;
  let calls = 0;
  const redirect = (() => {
    calls += 1;
    return Promise.resolve(
      new Response(null, {
        headers: { location: "https://example.com/private" },
        status: 302,
      })
    );
  }) as typeof fetch;
  await expect(
    fetchOriginalDescription(job, undefined, undefined, redirect)
  ).rejects.toThrow("Unsupported posting URL");
  expect(calls).toBe(1);
  await expect(
    fetchOriginalDescription(job, undefined, undefined, (() =>
      Promise.resolve(new Response("Verify you are human"))) as typeof fetch)
  ).rejects.toThrow("unavailable");
});
