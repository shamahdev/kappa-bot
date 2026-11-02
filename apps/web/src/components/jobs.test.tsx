import { describe, expect, test } from "bun:test";

import type { JobDtoType } from "@kappa/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";

import { TrackCell } from "./jobs";
import { GradeChip } from "./score";

const job = (application: JobDtoType["application"]): JobDtoType => ({
  aiSummary: null,
  application,
  company: "Co",
  externalId: "x",
  firstSeenAt: "2026-11-01T00:00:00.000Z",
  id: 1,
  location: null,
  matchBreakdown: null,
  matchGrade: "B",
  matchReason: null,
  matchScore: 70,
  source: "linkedin",
  subscriptionId: 1,
  title: "Engineer",
  url: "https://example.com",
});
const render = (value: JobDtoType) =>
  renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <TrackCell job={value} />
    </QueryClientProvider>
  );
const options = (html: string) =>
  [...html.matchAll(/<option[^>]*>(?<label>[^<]+)<\/option>/gu)].map(
    (match) => match.groups?.label
  );

describe("job list tracking control", () => {
  test("untracked rows offer only the first steps, in one control", () => {
    const html = render(job(null));
    expect(html.match(/<select/gu)).toHaveLength(1);
    expect(options(html)).toEqual(["Track job", "Bookmark", "Applied"]);
  });

  test("tracked rows keep their status and offer no one-click regression button", () => {
    const html = render(job({ id: 3, status: "offer" }));
    expect(html).toContain('data-status="offer"');
    expect(html).not.toContain("Move to applied");
    expect(options(html)).toContain("Offer");
    expect(html).not.toContain("<button");
  });
});

describe("GradeChip", () => {
  test("announces the grade once", () => {
    const html = renderToString(<GradeChip grade="B" />);
    expect(html.match(/Good match/gu)).toHaveLength(1);
  });
});
