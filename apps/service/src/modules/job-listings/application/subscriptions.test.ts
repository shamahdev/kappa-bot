import { describe, expect, test } from "bun:test";

import { SUBSCRIPTION_SOURCES } from "@kappa/contracts";

import type { JobActor, JobSubscription } from "../domain/subscription";
import { createJobSubscriptions } from "./subscriptions";
import { testDatabase } from "./test-database";

const actor: JobActor = {
  canManageGuild: (guild) => Promise.resolve(guild === "managed"),
  userId: "alice",
};
const row: JobSubscription = {
  channelId: "channel",
  createdAt: new Date(),
  createdBy: "alice",
  distance: null,
  filters: {},
  geoId: "old-geo",
  guildId: "departed",
  id: 1,
  isActive: true,
  keywords: "engineer",
  location: "Indonesia",
  retentionDays: 14,
  source: "all",
};

describe("subscription application access", () => {
  test("get, update, and remove deny a creator after permission is lost, without writes", async () => {
    const fake = testDatabase([[row], [row], [row]]);
    const service = createJobSubscriptions(fake.db);
    await expect(service.get(actor, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      service.update(actor, 1, { isActive: false })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.remove(actor, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(fake.writes).toEqual([]);
  });
  test("unscoped list filters departed guilds and other DM owners, with live grants once per guild", async () => {
    let calls = 0;
    const live: JobActor = {
      canManageGuild: (guild) => {
        calls += 1;
        return Promise.resolve(guild === "managed");
      },
      userId: "alice",
    };
    const rows = [
      row,
      { ...row, createdBy: "bob", guildId: "dm:alice", id: 2 },
      { ...row, guildId: "dm:bob", id: 3 },
      { ...row, guildId: "managed", id: 4 },
      { ...row, guildId: "managed", id: 5 },
    ];
    const fake = testDatabase([rows]);
    const listed = await createJobSubscriptions(fake.db).list(live);
    expect(listed.map((item) => item.id)).toEqual([2, 4, 5]);
    expect(calls).toBe(2);
  });
  test("scoped guild list and retention require current management before querying/writing", async () => {
    const fake = testDatabase();
    const service = createJobSubscriptions(fake.db);
    await expect(
      service.list(actor, { guildId: "departed", kind: "guild" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.setRetention(actor, { guildId: "departed", kind: "guild" }, 14)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.readCount).toBe(0);
    expect(fake.writes).toEqual([]);
  });
  test("foreign DM row stays private even if caller created it or can manage every guild", async () => {
    const fake = testDatabase([[{ ...row, guildId: "dm:bob" }]]);
    await expect(
      createJobSubscriptions(fake.db).get(
        { ...actor, canManageGuild: () => Promise.resolve(true) },
        1
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("subscription writes", () => {
  test("create trims keywords, preserves every shared source, and groups related writes in a transaction", async () => {
    for (const source of SUBSCRIPTION_SOURCES) {
      const saved = {
        ...row,
        guildId: "dm:alice",
        keywords: "engineer",
        source,
      };
      const fake = testDatabase(
        [[], [{ guildId: "dm:alice", id: "channel" }]],
        [saved]
      );
      // Keep transaction assertions serial across the canonical source cases.
      // oxlint-disable-next-line no-await-in-loop
      const created = await createJobSubscriptions(fake.db).create(actor, {
        channelId: "channel",
        keywords: "  engineer\n",
        scope: { kind: "personal" },
        source,
      });
      expect(created).toEqual(saved);
      expect(fake.transactionCount).toBe(1);
      expect(fake.writes.map((write) => write.table)).toEqual([
        "guilds",
        "channels",
        "subscriptions",
      ]);
      expect(fake.writes[2].values).toMatchObject({
        channelId: "channel",
        createdBy: "alice",
        distance: null,
        filters: {},
        guildId: "dm:alice",
        keywords: "engineer",
        location: "Indonesia",
        source,
      });
    }
  });
  test("create rejects blanks and unknown sources before writes or a transaction", async () => {
    const fake = testDatabase();
    const service = createJobSubscriptions(fake.db);
    const input = {
      channelId: "channel",
      keywords: " ",
      scope: { kind: "personal" } as const,
      source: "all",
    };
    await expect(service.create(actor, input)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(
      service.create(actor, {
        ...input,
        keywords: "engineer",
        source: "unknown",
      })
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(fake.writes).toEqual([]);
    expect(fake.transactionCount).toBe(0);
  });
  test("existing channels cannot be rebound across personal/guild scopes", async () => {
    const fake = testDatabase([[{ guildId: "dm:bob", id: "channel" }]]);
    await expect(
      createJobSubscriptions(fake.db).create(actor, {
        channelId: "channel",
        keywords: "engineer",
        scope: { kind: "personal" },
        source: "all",
      })
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(fake.writes).toEqual([]);
  });
  test("location change clears stale geoId and validates the whole patch before writing", async () => {
    const personal = { ...row, guildId: "dm:alice" };
    const fake = testDatabase(
      [[personal], [personal]],
      [{ ...personal, geoId: null, location: "Jakarta" }]
    );
    const service = createJobSubscriptions(fake.db);
    await expect(
      service.update(actor, 1, { keywords: "engineer", retentionDays: 366 })
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(fake.writes).toEqual([]);
    await service.update(actor, 1, { location: " Jakarta " });
    expect(fake.writes[0].values).toEqual({ geoId: null, location: "Jakarta" });
  });
  test("retention validates 1–365 and poll configuration is read-only with the schema default", async () => {
    const fake = testDatabase();
    const service = createJobSubscriptions(fake.db);
    for (const days of [0, 366, 1.5]) {
      // These cases share a statement spy; settle validation before inspecting its writes.
      // oxlint-disable-next-line no-await-in-loop
      await expect(
        service.setRetention(actor, { kind: "personal" }, days)
      ).rejects.toMatchObject({ code: "VALIDATION" });
    }
    expect(fake.writes).toEqual([]);
    for (const days of [1, 365]) {
      // The assertion below verifies write order on this shared statement spy.
      // oxlint-disable-next-line no-await-in-loop
      await service.setRetention(actor, { kind: "personal" }, days);
    }
    expect(fake.writes.map((write) => write.values)).toEqual([
      { retentionDays: 1 },
      { retentionDays: 365 },
    ]);
    expect(await service.pollIntervalMinutes()).toBe(30);
    expect(Object.keys(service)).not.toContain("setPollInterval");
  });
});
