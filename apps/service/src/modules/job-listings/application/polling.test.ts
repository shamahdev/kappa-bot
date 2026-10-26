import { expect, test } from "bun:test";

import type { JobPosting } from "../domain/posting";
import type { JobSubscription } from "../domain/subscription";
import { flushSub } from "./polling";
import type { JobPollingContext } from "./ports";

const sub = {
  channelId: "channel",
  guildId: "server",
  id: 1,
  keywords: "engineer",
} as JobSubscription;
const jobs: JobPosting[] = Array.from({ length: 21 }, (_, index) => ({
  agoTime: "",
  company: "Example",
  datetime: null,
  id: String(index),
  location: "Indonesia",
  logo: null,
  position: "Engineer",
  salary: null,
  source: "linkedin",
  url: `https://example.com/${index}`,
}));

const context = (batch: JobPollingContext["notifications"]["batch"]) => {
  const recorded: { messageId: string; ids: string[] }[] = [];
  const ctx = {
    log: { info() {}, warn() {} },
    notifications: { batch },
    recall: {
      record: (_channel: string, messageId: string, page: JobPosting[]) => {
        recorded.push({ ids: page.map((job) => job.id), messageId });
        return Promise.resolve();
      },
    },
  } as unknown as JobPollingContext;
  return { ctx, recorded };
};

test("records each delivered page in exact reply order and counts every posting", async () => {
  const { ctx, recorded } = context(
    async function* deliveredPages(_channel, postings) {
      yield { jobs: postings.slice(0, 20), messageId: "first" };
      yield { jobs: postings.slice(20), messageId: "second" };
    }
  );
  const result = await flushSub(
    ctx,
    sub,
    jobs.map((job, seenId) => ({ job, seenId }))
  );
  expect(result).toBe(21);
  expect(recorded).toEqual([
    { ids: jobs.slice(0, 20).map((job) => job.id), messageId: "first" },
    { ids: ["20"], messageId: "second" },
  ]);
});

test("a later transport failure preserves recall and count for already-sent pages", async () => {
  const { ctx, recorded } = context(
    async function* failingPages(_channel, postings) {
      yield { jobs: postings.slice(0, 20), messageId: "sent" };
      throw new Error("transport failure");
    }
  );
  expect(
    await flushSub(
      ctx,
      sub,
      jobs.map((job, seenId) => ({ job, seenId }))
    )
  ).toBe(20);
  expect(recorded[0]?.messageId).toBe("sent");
});
