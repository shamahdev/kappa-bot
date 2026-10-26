import { describe, expect, test } from "bun:test";

import type { JobPosting } from "@kappa/service/job-listings";

import { cardPayload, deliveryPages } from "./embed";
import { createDiscordNotifications } from "./notifications";

const required = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) {
    throw new Error("Expected a test value to be present");
  }
  return value;
};

const job = (id: number, overrides: Partial<JobPosting> = {}): JobPosting => ({
  agoTime: "recently",
  company: "Example",
  datetime: new Date(id * 1000).toISOString(),
  id: String(id),
  location: "Indonesia",
  logo: null,
  position: `Engineer ${id}`,
  salary: null,
  source: "linkedin",
  url: `https://example.com/jobs/${id}`,
  ...overrides,
});

describe("deliveryPages", () => {
  test("more than 20 jobs are lossless, newest first, with exact per-message numbering and recall order", () => {
    const jobs = Array.from({ length: 45 }, (_, index) => job(index));
    const pages = deliveryPages(jobs, "engineer");
    expect(pages.map((page) => page.jobs.length)).toEqual([20, 20, 5]);
    expect(pages.flatMap((page) => page.jobs)).toEqual(jobs.toReversed());
    // Preparation never mutates the caller's list.
    expect(required(jobs[0]).id).toBe("0");
    for (const page of pages) {
      expect(page.payload.embeds).toHaveLength(1);
      const embed = required(page.payload.embeds[0]);
      const lines = required(embed.description).split("\n");
      expect(lines).toHaveLength(page.jobs.length);
      for (const [index, posting] of page.jobs.entries()) {
        expect(lines[index]).toBe(
          `${index + 1}. [${posting.position} @ ${posting.company}](${posting.url})`
        );
      }
      expect(embed.footer?.text).toBe(
        `Reply with 1-${page.jobs.length} to get the summary of the job`
      );
    }
  });

  test("groups sources in newest-first first-appearance order and keeps undated input order", () => {
    const input = [
      job(1),
      job(2, { source: "kalibrr" }),
      job(3),
      job(4, { datetime: null }),
      job(5, { datetime: "invalid", source: "kalibrr" }),
      job(6, { datetime: null }),
    ];
    const pages = deliveryPages(input);
    expect(pages.map((page) => page.jobs.map((posting) => posting.id))).toEqual(
      [
        ["3", "1", "4", "6"],
        ["2", "5"],
      ]
    );
    expect(required(required(pages[0]).payload.embeds[0]).title).toContain(
      "LinkedIn"
    );
    const kalibrr = required(required(pages[1]).payload.embeds[0]);
    expect(kalibrr.title).toContain("Kalibrr");
    expect(kalibrr.description).toStartWith("1. ");
  });

  test("description capacity starts a new page instead of slicing off entries or links", () => {
    const input = Array.from({ length: 6 }, (_, index) =>
      job(index, { position: "Long role ".repeat(170) })
    );
    const pages = deliveryPages(input);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap((page) => page.jobs)).toEqual(input.toReversed());
    for (const page of pages) {
      const description = required(
        required(page.payload.embeds[0]).description
      );
      // Discord description limit.
      expect(description.length).toBeLessThanOrEqual(4096);
      expect(description.split("\n")).toHaveLength(page.jobs.length);
      for (const posting of page.jobs) {
        expect(description).toContain(`](${posting.url})`);
      }
    }
  });

  test("a single oversized title is truncated, not its link, and every job remains represented", () => {
    const long = job(2, {
      position: "[Long title] ".repeat(2000),
      url: "https://example.com/jobs/role(2)",
    });
    const short = job(1);
    const pages = deliveryPages([short, long], "x".repeat(1000));
    expect(pages.flatMap((page) => page.jobs)).toEqual([long, short]);
    const embed = required(required(pages[0]).payload.embeds[0]);
    expect(required(embed.description).length).toBeLessThanOrEqual(4096);
    expect(embed.description).toStartWith("1. [Long title");
    expect(embed.description).toEndWith(
      "…](https://example.com/jobs/role%282%29)"
    );
    expect(embed.footer?.text).toBe(
      "Reply with 1 to get the summary of the job"
    );
    // Discord title limit.
    expect(required(embed.title).length).toBeLessThanOrEqual(256);
    expect(
      required(required(pages[1]).payload.embeds[0]).description
    ).toStartWith("1. ");
  });

  test("an empty batch creates no transport pages", () => {
    expect(deliveryPages([])).toEqual([]);
  });

  test("card rendering consumes enrichment without doing application work", () => {
    const payload = cardPayload(
      {
        detail: { closed: false, description: "Summary", salary: "$100" },
        job: job(1),
        match: { reason: "Good fit", score: 90 },
      },
      "engineer"
    );
    expect(payload.embeds?.[0]?.description).toBe("Summary");
    expect(payload.embeds?.[0]?.fields).toContainEqual({
      inline: false,
      name: "Match",
      value: "90% — Good fit",
    });
  });
});

describe("createDiscordNotifications", () => {
  test("sends and yields each page lazily with the exact displayed order for persistence", async () => {
    const jobs = Array.from({ length: 42 }, (_, index) => job(index));
    const pages = deliveryPages(jobs, "engineer");
    const sent: unknown[] = [];
    const notifications = createDiscordNotifications((channelId, payload) => {
      expect(channelId).toBe("channel");
      sent.push(payload);
      return Promise.resolve({ messageId: `message-${sent.length}` });
    });
    const batch = notifications.batch("channel", jobs, "engineer");
    const iterator = batch[Symbol.asyncIterator]();
    expect(sent).toHaveLength(0);
    for (const [index, page] of pages.entries()) {
      // Pull one receipt at a time to prove the sender does not prefetch later pages.
      // oxlint-disable-next-line no-await-in-loop
      const next = await iterator.next();
      expect(sent).toHaveLength(index + 1);
      expect(sent[index]).toEqual(page.payload);
      expect(next.value).toEqual({
        jobs: page.jobs,
        messageId: `message-${index + 1}`,
      });
    }
    const end = await iterator.next();
    expect(end.done).toBe(true);
  });

  test("a failed send yields no receipt for that page and sends no later pages", async () => {
    const jobs = Array.from({ length: 45 }, (_, index) => job(index));
    let sends = 0;
    const notifications = createDiscordNotifications(() => {
      sends += 1;
      if (sends === 2) {
        return Promise.reject(new Error("transport failed"));
      }
      return Promise.resolve({ messageId: "delivered" });
    });
    const batch = notifications.batch("channel", jobs);
    const iterator = batch[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.value).toEqual({
      jobs: required(deliveryPages(jobs)[0]).jobs,
      messageId: "delivered",
    });
    await expect(iterator.next()).rejects.toThrow("transport failed");
    expect(sends).toBe(2);
  });

  test("cards use the pure enriched card payload", async () => {
    const posting = { detail: null, job: job(1), match: null };
    const sent: unknown[] = [];
    const notifications = createDiscordNotifications((_channel, payload) => {
      sent.push(payload);
      return Promise.resolve({});
    });
    await notifications.card("channel", posting, "engineer");
    expect(sent).toEqual([cardPayload(posting, "engineer")]);
  });
});
