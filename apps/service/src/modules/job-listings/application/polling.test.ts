import { expect, test } from "bun:test";

import type { JobPosting } from "../domain/posting";
import type { JobSubscription } from "../domain/subscription";
import { flushSub, pollSubscriptions } from "./polling";
import type { JobPollingContext } from "./ports";
import { testDatabase } from "./test-database";

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

test("role tags are forwarded for server notifications and suppressed for personal scope", async () => {
  const mentions: (string | null | undefined)[] = [];
  const { ctx } = context(
    async function* deliver(_channel, postings, _keyword, roleId) {
      mentions.push(roleId);
      yield { jobs: postings };
    }
  );
  const roleId = "123456789012345678";
  const items = jobs.slice(0, 2).map((job, seenId) => ({ job, seenId }));
  await flushSub(ctx, { ...sub, roleId }, items);
  await flushSub(ctx, { ...sub, guildId: "dm:user", roleId }, items);
  expect(mentions).toEqual([roleId, null]);
});

test("alternative searches are OR, deduped and delivered as one subscription batch", async () => {
  const subscription = {
    ...sub,
    filters: {},
    keywordAlternatives: ["frontend", "nextjs", "fullstack"],
    keywords: "frontend, nextjs, fullstack",
    location: "Indonesia",
    source: "linkedin",
    title: "Web engineering",
  };
  const postings = jobs
    .slice(0, 3)
    .map((job) => ({ ...job, position: "frontend nextjs fullstack engineer" }));
  const store = testDatabase([[]], [{ id: 1 }]);
  const searched: string[] = [];
  const messages: string[][] = [];
  const ctx = {
    db: store.db,
    log: { info() {}, warn() {} },
    notifications: {
      async *batch(
        _channel: string,
        listing: JobPosting[],
        title?: string | null
      ) {
        expect(title).toBe("Web engineering");
        messages.push(listing.map((job) => job.id));
        yield { jobs: listing };
      },
    },
  } as unknown as JobPollingContext;
  const result = await pollSubscriptions(ctx, [subscription], {
    search: (_source, query) => {
      searched.push(query.keywords);
      return Promise.resolve(
        query.keywords === "frontend" ? postings.slice(0, 2) : postings.slice(1)
      );
    },
  });
  expect(searched).toEqual(["frontend", "nextjs", "fullstack"]);
  expect(messages).toEqual([["0", "1", "2"]]);
  expect(result.newJobsDelivered).toBe(3);
  expect(
    store.writes.filter(
      (write) => write.table === "seen_jobs" && write.operation === "insert"
    )
  ).toHaveLength(3);
});

test("rejected filtered candidates never create a SeenJob delivery claim", async () => {
  const subscription = {
    ...sub,
    filters: {},
    location: "Indonesia",
    minimumSalary: 10_000_000,
    source: "linkedin",
  };
  const store = testDatabase();
  const queued: string[] = [];
  const ctx = {
    db: store.db,
    evaluation: {
      enqueue: (_sub: JobSubscription, postings: JobPosting[]) => {
        queued.push(...postings.map((job) => job.id));
        return Promise.resolve();
      },
      process: () => Promise.resolve(new Map()),
      statuses: () =>
        Promise.resolve(
          new Map([[sub.id, { failed: 0, pending: 1, unavailable: null }]])
        ),
    },
    log: { info() {}, warn() {} },
  } as unknown as JobPollingContext;
  const result = await pollSubscriptions(ctx, [subscription], {
    search: () => Promise.resolve(jobs.slice(0, 1)),
  });
  expect(queued).toEqual(["0"]);
  expect(result.newJobsDelivered).toBe(0);
  expect(result.pendingEvaluations).toBe(1);
  expect(
    store.writes.some(
      (write) => write.table === "seen_jobs" && write.operation === "insert"
    )
  ).toBe(false);
});
