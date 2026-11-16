import { expect, test, mock } from "bun:test";

import type { JobPosting } from "../domain/posting";
import type { JobSubscription } from "../domain/subscription";
import {
  createPostingEvaluation,
  evaluationCriteriaKey,
} from "./posting-evaluation";
import { testDatabase } from "./test-database";

const sub = {
  channelId: "channel",
  createdAt: new Date(),
  createdBy: "user",
  distance: null,
  filters: {},
  geoId: null,
  guildId: "dm:user",
  id: 1,
  isActive: true,
  keywordAlternatives: ["frontend"],
  keywords: "frontend",
  location: "Indonesia",
  minimumSalary: 10_000_000,
  retentionDays: 14,
  source: "linkedin",
  workEnvironments: [],
} as JobSubscription;
const posting = {
  agoTime: "today",
  company: "Company",
  datetime: null,
  description: null,
  id: "posting",
  location: "Indonesia",
  logo: null,
  position: "Frontend",
  salary: null,
  source: "linkedin",
  url: "https://www.linkedin.com/jobs/view/123",
} as JobPosting;
const evaluation = {
  criteriaKey: evaluationCriteriaKey(sub),
  id: 1,
  posting,
  status: "pending",
  subscriptionId: sub.id,
};
const log = { warn: mock() } as never;
const authorize = () => Promise.resolve(sub);

test("provider failures defer evaluation, do not consume attempts or SeenJob claims", async () => {
  const claim = { attempts: 0, claimedAt: new Date(1000), id: 1 };
  const store = testDatabase([[{ evaluation }], []], [claim]);
  const service = createPostingEvaluation(store.db, log, authorize, {
    extract: () =>
      Promise.resolve({
        kind: "failed",
        reason: "AI provider 429",
        unavailable: true,
      }),
    now: () => 1000,
    unavailable: () => null,
  });
  const processed = await service.process([sub]);
  expect(processed.size).toBe(0);
  expect(
    store.writes.find(
      (write) => write.operation === "update" && write.table === "posting_facts"
    )?.values
  ).toMatchObject({
    attempts: 0,
    claimedAt: null,
    facts: null,
    status: "pending",
  });
  expect(store.writes.some((write) => write.table === "seen_jobs")).toBe(false);
});

test("third ordinary extraction failure remains failed, never unspecified", async () => {
  const store = testDatabase(
    [[{ evaluation }], [{ attempts: 2, status: "pending" }]],
    [{ attempts: 2, claimedAt: new Date(1000), id: 1 }]
  );
  const service = createPostingEvaluation(store.db, log, authorize, {
    extract: () =>
      Promise.resolve({
        kind: "failed",
        reason: "Invalid extraction reply",
        unavailable: false,
      }),
    now: () => 1000,
    unavailable: () => null,
  });
  const stale = await service.process([
    { ...sub, includeUnspecifiedSalary: true },
  ]);
  expect(stale.size).toBe(0);
  // Process the exact criteria used when this candidate was enqueued.
  const exact = { ...sub, includeUnspecifiedSalary: true };
  const second = testDatabase(
    [
      [
        {
          evaluation: {
            ...evaluation,
            criteriaKey: evaluationCriteriaKey(exact),
          },
        },
      ],
      [{ attempts: 2, status: "pending" }],
    ],
    [{ attempts: 2, claimedAt: new Date(1000), id: 1 }]
  );
  const retry = createPostingEvaluation(second.db, log, authorize, {
    extract: () =>
      Promise.resolve({
        kind: "failed",
        reason: "Invalid extraction reply",
        unavailable: false,
      }),
    now: () => 1000,
    unavailable: () => null,
  });
  const retried = await retry.process([exact]);
  expect(retried.size).toBe(0);
  expect(
    second.writes.find(
      (write) => write.operation === "update" && write.table === "posting_facts"
    )?.values
  ).toMatchObject({ attempts: 3, status: "failed" });
});

test("explicit source metadata needs no AI and evaluates before any delivery claim", async () => {
  const sourcePosting = {
    ...posting,
    salaryData: {
      currency: "IDR",
      max: 12_000_000,
      min: 8_000_000,
      period: "month" as const,
    },
  };
  const store = testDatabase([
    [{ evaluation: { ...evaluation, posting: sourcePosting } }],
  ]);
  const extract = mock(() => Promise.reject(new Error("must not call AI")));
  const service = createPostingEvaluation(store.db, log, authorize, {
    extract,
    unavailable: () => "AI not configured",
  });
  const processed = await service.process([sub]);
  expect(processed.get(1)).toEqual([sourcePosting]);
  expect(extract).not.toHaveBeenCalled();
  expect(store.writes.map((write) => write.table)).toEqual([
    "posting_evaluations",
  ]);
});

test("retry authorization occurs before candidate/cache mutations", async () => {
  const store = testDatabase();
  const service = createPostingEvaluation(store.db, log, () =>
    Promise.reject(new Error("forbidden"))
  );
  await expect(
    service.retry(
      { canManageGuild: () => Promise.resolve(false), userId: "other" },
      1
    )
  ).rejects.toThrow("forbidden");
  expect(store.readCount).toBe(0);
  expect(store.writes).toEqual([]);
});

test("labels do not change evaluation criteria but filter edits do", () => {
  expect(evaluationCriteriaKey({ ...sub, title: "Web engineering" })).toBe(
    evaluationCriteriaKey(sub)
  );
  expect(evaluationCriteriaKey({ ...sub, minimumSalary: 12_000_000 })).not.toBe(
    evaluationCriteriaKey(sub)
  );
});

test("twenty distinct postings are processed before newer candidates are deferred", async () => {
  const candidates = Array.from({ length: 21 }, (_, index) => ({
    evaluation: {
      ...evaluation,
      id: index + 1,
      posting: { ...posting, id: String(index) },
    },
  }));
  const store = testDatabase(
    [candidates, ...Array.from({ length: 21 }, () => [])],
    [{ attempts: 0, claimedAt: new Date(1000), id: 1 }]
  );
  const extract = mock(() =>
    Promise.resolve({
      closed: false,
      evidence: "No salary stated",
      facts: {
        salary: null,
        workEnvironment: null,
        workEnvironmentEvidence: null,
      },
      kind: "complete" as const,
    })
  );
  const service = createPostingEvaluation(store.db, log, authorize, {
    extract,
    now: () => 1000,
    unavailable: () => null,
  });
  await service.process([sub]);
  expect(extract).toHaveBeenCalledTimes(20);
  const updates = store.writes.filter(
    (write) =>
      write.operation === "update" && write.table === "posting_evaluations"
  );
  expect(updates[20]?.values).toMatchObject({ status: "pending" });
  expect(store.writes.some((write) => write.table === "seen_jobs")).toBe(false);
});

test("elapsed extraction budget stops starting new work", async () => {
  let time = 1000;
  const store = testDatabase(
    [
      [
        { evaluation },
        {
          evaluation: {
            ...evaluation,
            id: 2,
            posting: { ...posting, id: "newer" },
          },
        },
      ],
      [],
      [],
    ],
    [{ attempts: 0, claimedAt: new Date(1000), id: 1 }]
  );
  const extract = mock(() => {
    time += 120_000;
    return Promise.resolve({
      closed: false,
      evidence: "No salary stated",
      facts: {
        salary: null,
        workEnvironment: null,
        workEnvironmentEvidence: null,
      },
      kind: "complete" as const,
    });
  });
  const service = createPostingEvaluation(store.db, log, authorize, {
    extract,
    now: () => time,
    unavailable: () => null,
  });
  await service.process([sub]);
  expect(extract).toHaveBeenCalledTimes(1);
});
