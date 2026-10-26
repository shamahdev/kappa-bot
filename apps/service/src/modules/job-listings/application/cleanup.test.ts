import { expect, test } from "bun:test";

import { PgDialect } from "drizzle-orm/pg-core";

import { removeJobListingAccountData } from "./cleanup";
import { testDatabase } from "./test-database";

test("former creator deleting their account cannot delete server-owned subscriptions", async () => {
  const fake = testDatabase([[{ id: "personal-channel" }]]);
  // Trusted account cleanup has no manager grant and must not need one: it
  // deletes personal data only, never server-owned rows via historical creator.
  await removeJobListingAccountData(fake.db, "former-manager");
  const dialect = new PgDialect();
  const subscriptionWrites = fake.writes.filter(
    (write) => write.table === "subscriptions"
  );
  expect(subscriptionWrites.map((write) => write.operation)).toEqual([
    "delete",
    "update",
  ]);
  const [personalDelete, serverAnonymize] = subscriptionWrites;
  if (!personalDelete.where || !serverAnonymize.where) {
    throw new Error("account cleanup writes must include scope predicates");
  }
  const deletion = dialect.sqlToQuery(personalDelete.where);
  expect(deletion.sql).toBe('"subscriptions"."guild_id" = $1');
  expect(deletion.params).toEqual(["dm:former-manager"]);
  // The only subscription DELETE is pinned to this user's DM scope. Server
  // rows receive a nullable-attribution update, not deletion or deactivation.
  expect(serverAnonymize.values).toEqual({ createdBy: null });
  const attribution = dialect.sqlToQuery(serverAnonymize.where);
  expect(attribution.sql).toBe(
    '("subscriptions"."created_by" = $1 and "subscriptions"."guild_id" not like $2)'
  );
  expect(attribution.params).toEqual(["former-manager", "dm:%"]);
  expect(
    fake.writes
      .filter((write) => write.operation === "delete")
      .map((write) => write.table)
  ).toEqual([
    "subscriptions",
    "channels",
    "guilds",
    "delivery_messages",
    "cv_profiles",
  ]);
});
