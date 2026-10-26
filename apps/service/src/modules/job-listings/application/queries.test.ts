import { expect, test } from "bun:test";

import type { JobActor } from "../domain/subscription";
import { createJobQueries } from "./queries";
import { testDatabase } from "./test-database";

const actor: JobActor = {
  canManageGuild: () => Promise.resolve(false),
  userId: "alice",
};

test("job queries deny guild scope before persistence, regardless of creator history", async () => {
  const fake = testDatabase();
  await expect(
    createJobQueries(fake.db).list(actor, {
      guildId: "departed",
      kind: "guild",
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(fake.readCount).toBe(0);
});

test("job source filters are concrete; all is a subscription selection, not a posting source", async () => {
  const fake = testDatabase();
  const queries = createJobQueries(fake.db);
  await expect(
    queries.list(actor, { kind: "personal" }, { source: "all" })
  ).rejects.toMatchObject({ code: "VALIDATION" });
  expect(fake.readCount).toBe(0);
  const valid = testDatabase([[{ total: 0 }], []]);
  expect(
    await createJobQueries(valid.db).list(
      actor,
      { kind: "personal" },
      { source: "linkedin" }
    )
  ).toMatchObject({ page: 1, pageSize: 20, rows: [], total: 0 });
});

test("job subscription filters cannot escape the authorized scope", async () => {
  const fake = testDatabase([[]]);
  await expect(
    createJobQueries(fake.db).list(
      actor,
      { kind: "personal" },
      { subscription: "1" }
    )
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(fake.readCount).toBe(1);
});

test("existing pagination contract rejects malformed IDs, pages, and oversized pages", async () => {
  const fake = testDatabase();
  const queries = createJobQueries(fake.db);
  for (const filter of [
    { page: "0" },
    { page: "1.5" },
    { pageSize: "101" },
    { subscription: "-1" },
  ]) {
    // Settle each validation case against the shared read-count spy in input order.
    // oxlint-disable-next-line no-await-in-loop
    await expect(
      queries.list(actor, { kind: "personal" }, filter)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  }
  expect(fake.readCount).toBe(0);
});

test("guild dashboard counts authorize every requested guild before reading", async () => {
  const fake = testDatabase();
  await expect(
    createJobQueries(fake.db).guildCounts(actor, ["departed"])
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(fake.readCount).toBe(0);
});
