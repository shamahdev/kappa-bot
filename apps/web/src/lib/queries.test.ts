import { afterEach, describe, expect, test } from "bun:test";

import { MutationObserver, QueryClient } from "@tanstack/react-query";

import {
  createSubscriptionOptions,
  deleteSubscriptionOptions,
  queryKeys,
  updateSubscriptionOptions,
} from "./queries";
import type { SubscriptionDtoType } from "./queries";

const sub: SubscriptionDtoType = {
  id: 7,
  scope: "guild",
  guildId: "server",
  channelId: "channel",
  source: "linkedin",
  keywords: "engineer",
  location: "Indonesia",
  isActive: true,
  retentionDays: 30,
  createdAt: "2026-01-01T00:00:00Z",
};

const cachedKeys = [
  queryKeys.subscriptionList(),
  queryKeys.subscriptionList("server"),
  queryKeys.guilds,
  queryKeys.accountSummary,
  [...queryKeys.jobs, { scope: "dm" }],
  [...queryKeys.jobs, { guild: "server", subscription: sub.id }],
  queryKeys.cv,
  queryKeys.me,
] as const;
const clients: QueryClient[] = [];

const seedCache = () => {
  const client = new QueryClient();
  clients.push(client);
  for (const key of cachedKeys) {
    client.setQueryData(key, "cached");
  }
  return client;
};

const expectInvalidated = (
  client: QueryClient,
  prefixes: readonly string[]
) => {
  for (const key of cachedKeys) {
    expect(client.getQueryState(key)?.isInvalidated).toBe(
      prefixes.includes(key[0])
    );
  }
};

afterEach(() => {
  for (const client of clients) {
    client.clear();
  }
  clients.length = 0;
});

describe("subscription mutation read models", () => {
  // Only the transport is replaced: run the same mutation options as the hooks
  // through React Query's in-memory mutation observer, without rendering or I/O.
  test("DM creation refreshes lists and the account count", async () => {
    const client = seedCache();
    const mutation = new MutationObserver(client, {
      ...createSubscriptionOptions(client),
      mutationFn: () => Promise.resolve({ ...sub, scope: "dm" as const }),
    });
    await mutation.mutate({ source: "linkedin", keywords: "engineer" });
    expectInvalidated(client, ["subscriptions", "account-summary"]);
  });

  test.each([false, true])(
    "guild active-state update (%s) refreshes guild counts",
    async (isActive) => {
      const client = seedCache();
      const mutation = new MutationObserver(client, {
        ...updateSubscriptionOptions(client),
        mutationFn: () => Promise.resolve({ ...sub, isActive }),
      });
      await mutation.mutate({ id: sub.id, patch: { isActive } });
      expectInvalidated(client, ["subscriptions", "guilds"]);
    }
  );

  test("editor changes refresh labels without invalidating unchanged counts or jobs", async () => {
    const client = seedCache();
    const mutation = new MutationObserver(client, {
      ...updateSubscriptionOptions(client),
      mutationFn: () =>
        Promise.resolve({
          ...sub,
          keywords: "designer",
          retentionDays: 1,
        }),
    });
    await mutation.mutate({
      id: sub.id,
      patch: { keywords: "designer", retentionDays: 1 },
    });
    expectInvalidated(client, ["subscriptions"]);
  });

  test("DM active-state updates do not refresh unrelated guild counts", async () => {
    const client = seedCache();
    const mutation = new MutationObserver(client, {
      ...updateSubscriptionOptions(client),
      mutationFn: () =>
        Promise.resolve({
          ...sub,
          scope: "dm" as const,
          isActive: false,
        }),
    });
    await mutation.mutate({ id: sub.id, patch: { isActive: false } });
    expectInvalidated(client, ["subscriptions"]);
  });

  test("deletion refreshes subscription/guild/account counts and delivered jobs", async () => {
    const client = seedCache();
    const mutation = new MutationObserver(client, {
      ...deleteSubscriptionOptions(client),
      mutationFn: () => Promise.resolve("Deleted."),
    });
    await mutation.mutate(sub.id);
    expectInvalidated(client, [
      "subscriptions",
      "guilds",
      "account-summary",
      "jobs",
    ]);
  });

  test("a rejected mutation leaves cached read models unchanged", async () => {
    const client = seedCache();
    const error = new Error("not deleted");
    const mutation = new MutationObserver(client, {
      ...deleteSubscriptionOptions(client),
      mutationFn: () => Promise.reject(error),
    });
    await expect(mutation.mutate(sub.id)).rejects.toBe(error);
    expectInvalidated(client, []);
  });
});
