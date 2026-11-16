import { expect, test } from "bun:test";

import { SESSION_COOKIE } from "@kappa/contracts";

import { createHttpJobAccess } from "../core/job-access";
import { testDatabase } from "../modules/job-listings/application/test-database";
import { cvRoutes } from "./cv";
import { cvReportRoutes } from "./cv-reports";
import type { RouteDeps } from "./deps";
import { subscriptionRoutes } from "./subscriptions";

const user = {
  avatar: null,
  discordId: "http-former-creator",
  username: "Example",
};
const session = { session: { expiresAt: new Date(Date.now() + 60_000) }, user };
const deps = (db: RouteDeps["db"]): RouteDeps =>
  ({
    config: { discordToken: "offline-bot-token" },
    db,
    log: { warn() {} },
  }) as unknown as RouteDeps;
const request = (path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE}=offline-session`,
    },
    method: body ? "PATCH" : "GET",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

test("HTTP role lookup accepts a normal role with mention disabled", async () => {
  const roleId = "123456789012345678";
  const store = testDatabase();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (() =>
      Promise.resolve(
        Response.json([
          // Discord creates roles with mentionable=false by default.
          { id: roleId, managed: false, mentionable: false },
          { id: "123456789012345679", managed: true, mentionable: false },
        ])
      )) as typeof fetch;
    const { actor } = createHttpJobAccess(deps(store.db), user.discordId);
    expect(await actor.canMentionRole?.("some-guild", roleId)).toBe(true);
    expect(
      await actor.canMentionRole?.("some-guild", "123456789012345679")
    ).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("HTTP PATCH cannot use creator attribution to bypass current server permissions", async () => {
  const row = { createdBy: user.discordId, guildId: "http-server", id: 7 };
  const store = testDatabase([
    [session],
    [row],
    [
      {
        accessToken: "offline-user-token",
        id: 1,
        refreshToken: "offline-refresh",
        scopes: "identify guilds",
        tokenExpiresAt: new Date(Date.now() + 600_000),
      },
    ],
  ]);
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  try {
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push(url);
      expect(url).toBe("https://discord.com/api/v10/users/@me/guilds");
      const authorization = new Headers(init?.headers).get("authorization");
      return Promise.resolve(
        Response.json(
          authorization?.startsWith("Bot ")
            ? [{ id: row.guildId }]
            : [
                {
                  id: row.guildId,
                  name: "Server",
                  owner: false,
                  permissions: "0",
                },
              ]
        )
      );
    }) as typeof fetch;
    const response = await subscriptionRoutes(deps(store.db)).handle(
      request("/api/v1/subscriptions/7", { isActive: false })
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "subscription not found" },
    });
    expect(requests.length).toBe(2);
    expect(store.writes).toEqual([]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("foreign DM access is masked without consulting Discord", async () => {
  const store = testDatabase([
    [session],
    [{ createdBy: user.discordId, guildId: "dm:another-user", id: 7 }],
  ]);
  const response = await subscriptionRoutes(deps(store.db)).handle(
    request("/api/v1/subscriptions/7", { isActive: false })
  );
  expect(response.status).toBe(404);
  expect(store.readCount).toBe(2);
  expect(store.writes).toEqual([]);
});

test("HTTP extraction retry cannot access another owner's candidates", async () => {
  const store = testDatabase([
    [session],
    [{ guildId: "dm:another-user", id: 7 }],
  ]);
  const response = await subscriptionRoutes(deps(store.db)).handle(
    new Request("http://localhost/api/v1/subscriptions/7/retry", {
      headers: { cookie: `${SESSION_COOKIE}=offline-session` },
      method: "POST",
    })
  );
  expect(response.status).toBe(404);
  expect(store.writes).toEqual([]);
});

test("invalid posting filters are rejected before any Discord destination request", async () => {
  const store = testDatabase([[session]]);
  const response = await subscriptionRoutes(deps(store.db)).handle(
    new Request("http://localhost/api/v1/subscriptions", {
      body: JSON.stringify({
        keywords: "frontend, nextjs",
        minimumSalary: -1,
        source: "all",
      }),
      headers: {
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=offline-session`,
      },
      method: "POST",
    })
  );
  expect(response.status).toBe(400);
  expect(store.readCount).toBe(1);
  expect(store.writes).toEqual([]);
});

test("personal subscription creation rejects a role tag before ensuring a DM destination", async () => {
  const store = testDatabase([[session]]);
  const response = await subscriptionRoutes(deps(store.db)).handle(
    new Request("http://localhost/api/v1/subscriptions", {
      body: JSON.stringify({
        keywords: "frontend",
        roleId: "123456789012345678",
        source: "all",
      }),
      headers: {
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=offline-session`,
      },
      method: "POST",
    })
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: {
      message: "Role tags are only available for server subscriptions.",
    },
  });
  expect(store.readCount).toBe(1);
  expect(store.writes).toEqual([]);
});

test("server subscription creation validates channel ownership and never creates a DM destination", async () => {
  // The bot-membership cache is shared with the preceding permission test.
  const serverId = "http-server";
  const store = testDatabase([
    [{ ...session, user: { ...user, discordId: "http-server-creator" } }],
    [
      {
        accessToken: "offline-user-token",
        id: 1,
        refreshToken: "offline-refresh",
        scopes: "identify guilds",
        tokenExpiresAt: new Date(Date.now() + 600_000),
      },
    ],
  ]);
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  try {
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/users/@me/guilds")) {
        const bot = new Headers(init?.headers)
          .get("authorization")
          ?.startsWith("Bot ");
        return Promise.resolve(
          Response.json(
            bot
              ? [{ id: serverId }]
              : [
                  {
                    id: serverId,
                    name: "Server",
                    owner: true,
                    permissions: "32",
                  },
                ]
          )
        );
      }
      return Promise.resolve(
        Response.json({ guild_id: "another-server", type: 0 })
      );
    }) as typeof fetch;
    const response = await subscriptionRoutes(deps(store.db)).handle(
      new Request("http://localhost/api/v1/subscriptions", {
        body: JSON.stringify({
          channelId: "channel",
          guildId: serverId,
          keywords: "frontend, nextjs",
          source: "all",
        }),
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE}=offline-session`,
        },
        method: "POST",
      })
    );
    expect(response.status).toBe(400);
    expect(urls).toContain("https://discord.com/api/v10/channels/channel");
    expect(urls.some((url) => url.includes("/users/@me/channels"))).toBe(false);
    expect(store.writes).toEqual([]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("HTTP CV controller serializes the shared personal profile result", async () => {
  const updatedAt = new Date("2026-01-01T00:00:00Z");
  const store = testDatabase([
    [session],
    [{ discordId: user.discordId, filename: null, text: "example", updatedAt }],
  ]);
  const response = await cvRoutes(deps(store.db)).handle(request("/api/v1/cv"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    filename: null,
    hasCv: true,
    updatedAt: updatedAt.toISOString(),
  });
});

test("HTTP CV report list paginates and omits job snapshots", async () => {
  const createdAt = new Date("2026-01-04T00:00:00Z");
  const report = {
    createdAt,
    cvFilename: null,
    cvUploadedAt: null,
    factors: null,
    grade: "C",
    id: 7,
    jobs: [],
    keywords: null,
    message: null,
    notificationClaimedAt: null,
    notifiedAt: null,
    score: 60,
    source: null,
    status: "ready",
    subscriptionId: null,
    summary: null,
    summaryAttempts: 0,
    trigger: "scheduled",
    userId: user.discordId,
    windowEnd: new Date("2026-01-04T00:00:00Z"),
    windowStart: new Date("2026-01-01T00:00:00Z"),
  };
  const store = testDatabase([[session], [{ total: 1 }], [report], []]);
  const response = await cvReportRoutes(deps(store.db)).handle(
    request("/api/v1/cv/reports?page=2&pageSize=10")
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    page: number;
    pageSize: number;
    reports: Record<string, unknown>[];
    total: number;
  };
  expect(body).toMatchObject({
    page: 2,
    pageSize: 10,
    reports: [{ id: 7, jobCount: 0, score: 60 }],
    total: 1,
  });
  expect(body.reports[0]).not.toHaveProperty("jobs");
  expect(body.reports[0]).not.toHaveProperty("summary");
});
