import { describe, expect, test } from "bun:test";

import { SUBSCRIPTION_SOURCES } from "@kappa/contracts";

import {
  assertScopeAccess,
  assertSubscriptionAccess,
  dmScopeKey,
  dmUserIdForScope,
  JobSubscriptionError,
  positiveSubscriptionId,
  scopeKey,
  subscriptionKeywords,
  subscriptionLocation,
  subscriptionPatch,
  subscriptionRetentionDays,
  subscriptionSource,
} from "./subscription";
import type { JobActor, JobSubscription } from "./subscription";

const actor: JobActor = {
  canManageGuild: (id) => Promise.resolve(id === "managed"),
  userId: "alice",
};
const row: JobSubscription = {
  channelId: "channel",
  createdAt: new Date(),
  createdBy: "alice",
  distance: null,
  filters: {},
  geoId: null,
  guildId: "departed",
  id: 1,
  isActive: true,
  keywords: "engineer",
  location: "Indonesia",
  retentionDays: 14,
  source: "all",
};

describe("scope encoding and current-manager access", () => {
  test("personal destinations round-trip and real guilds do not decode as owners", () => {
    expect(dmScopeKey("alice")).toBe("dm:alice");
    expect(dmUserIdForScope(scopeKey(actor, { kind: "personal" }))).toBe(
      "alice"
    );
    expect(dmUserIdForScope("managed")).toBeNull();
    expect(dmUserIdForScope("dm:")).toBeNull();
    expect(dmUserIdForScope("dm:  ")).toBeNull();
    expect(scopeKey(actor, { guildId: "managed", kind: "guild" })).toBe(
      "managed"
    );
    expect(() => scopeKey(actor, { guildId: "dm:bob", kind: "guild" })).toThrow(
      JobSubscriptionError
    );
  });
  test("creator who lost permission is forbidden; a current manager need not be creator", async () => {
    await expect(assertSubscriptionAccess(actor, row)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      assertSubscriptionAccess(actor, {
        ...row,
        createdBy: "bob",
        guildId: "managed",
      })
    ).resolves.toBeUndefined();
  });
  test("DM ownership ignores createdBy and never consults guild authority", async () => {
    const personalActor: JobActor = {
      canManageGuild: () =>
        Promise.reject(new Error("must not check guild access for a DM")),
      userId: "alice",
    };
    await expect(
      assertSubscriptionAccess(personalActor, {
        ...row,
        createdBy: "bob",
        guildId: "dm:alice",
      })
    ).resolves.toBeUndefined();
    await expect(
      assertSubscriptionAccess(personalActor, { ...row, guildId: "dm:bob" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      assertScopeAccess(personalActor, { kind: "personal" })
    ).resolves.toBe("dm:alice");
  });
});

describe("shared validation", () => {
  test("source selections are exactly the shared contract including all", () => {
    for (const source of SUBSCRIPTION_SOURCES) {
      expect(subscriptionSource(source)).toBe(source);
    }
    expect(() => subscriptionSource("unknown")).toThrow(JobSubscriptionError);
  });
  test("keywords and location trim and reject blanks", () => {
    expect(subscriptionKeywords("  engineer\n")).toBe("engineer");
    expect(subscriptionLocation(" Jakarta ")).toBe("Jakarta");
    expect(() => subscriptionKeywords(" \t\n ")).toThrow(
      "keywords must not be blank"
    );
    expect(() => subscriptionLocation("  ")).toThrow(
      "location must not be blank"
    );
    expect(
      subscriptionPatch({ keywords: "  engineer ", retentionDays: 365 })
    ).toEqual({
      keywords: "engineer",
      retentionDays: 365,
    });
  });
  test("existing retention contract is integer 1–365", () => {
    expect(subscriptionRetentionDays(1)).toBe(1);
    expect(subscriptionRetentionDays(365)).toBe(365);
    for (const value of [0, 366, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => subscriptionRetentionDays(value)).toThrow(
        JobSubscriptionError
      );
    }
  });
  test("row IDs must be safe positive integers", () => {
    expect(positiveSubscriptionId(1)).toBe(1);
    for (const value of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => positiveSubscriptionId(value)).toThrow(JobSubscriptionError);
    }
  });
});
