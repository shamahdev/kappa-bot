import { expect, test } from "bun:test";

import { SESSION_COOKIE } from "@kappa/contracts";

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
