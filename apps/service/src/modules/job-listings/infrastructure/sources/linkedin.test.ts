import { describe, expect, test } from "bun:test";

import { isRecent, searchLinkedIn } from "./linkedin";

const card = (id: string, datetime: string, age: string) => `
      <li><div data-entity-urn="urn:li:jobPosting:${id}">
        <h3 class="base-search-card__title">Engineer</h3>
        <h4 class="base-search-card__subtitle">Example</h4>
        <time datetime="${datetime}">${age}</time>
      </div></li>`;

describe("LinkedIn recency", () => {
  test("uses a posting timestamp before relative text and drops unknown or old ages", () => {
    const now = Date.UTC(2026, 0, 31);
    expect(
      isRecent({ agoTime: "2 months ago", datetime: "2026-01-30" }, now)
    ).toBe(true);
    expect(isRecent({ agoTime: "today", datetime: "2025-01-01" }, now)).toBe(
      false
    );
    expect(isRecent({ agoTime: "2 weeks ago", datetime: null }, now)).toBe(
      true
    );
    expect(isRecent({ agoTime: "1 month ago", datetime: null }, now)).toBe(
      false
    );
    expect(isRecent({ agoTime: "recently", datetime: null }, now)).toBe(false);
  });

  test("search filtering does not pass the array index as the recency clock", async () => {
    const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const pages = [
      card("old", "2000-01-01", "26 years ago") +
        card("recent", recentDate, "1 day ago"),
      "",
    ];
    const jobs = await searchLinkedIn(
      { filters: {}, keywords: "engineer" },
      "offline-recency",
      {
        fetchPage: () => Promise.resolve(pages.shift() ?? ""),
        sleep: () => Promise.resolve(),
      }
    );
    expect(jobs.map((job) => job.id)).toEqual(["recent"]);
  });
});
