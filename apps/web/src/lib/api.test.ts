import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

import { Effect } from "effect";

import { ApiError, fetchGuilds, fetchMe, runApi } from "./api";

// Supply only the origin the browser HTTP client needs to resolve relative URLs.
const originalLocation = Object.getOwnPropertyDescriptor(
  globalThis,
  "location"
);
beforeAll(() => {
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: new URL("https://web.test/"),
  });
});
afterAll(() => {
  if (originalLocation) {
    Object.defineProperty(globalThis, "location", originalLocation);
  } else {
    Reflect.deleteProperty(globalThis, "location");
  }
});

// All HTTP responses are in-memory; no service, credentials, or network is used.
const respond = (status: number, body: unknown) =>
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body, { status }));

afterEach(() => mock.restore());

describe("Effect → Promise API seam", () => {
  test("returns successful values", async () => {
    expect(await runApi(Effect.succeed("ok"))).toBe("ok");
  });

  test("rejects with the original structured ApiError, not FiberFailure", async () => {
    const error = new ApiError({
      status: 409,
      code: "RECONNECT_REQUIRED",
      message: "Reconnect.",
    });
    const rejected = await runApi(Effect.fail(error)).catch(
      (error_: unknown) => error_
    );
    expect(rejected).toBe(error);
    expect(rejected).toBeInstanceOf(ApiError);
  });

  test("fetchMe treats an unauthorized envelope as signed out", async () => {
    respond(401, { error: { code: "UNAUTHORIZED", message: "Sign in." } });
    expect(await fetchMe()).toBeNull();
  });

  test("a reconnect envelope retains the QueryError predicate and service message", async () => {
    respond(409, {
      error: { code: "RECONNECT_REQUIRED", message: "Reconnect Discord." },
    });
    const error = await fetchGuilds().catch((error_: unknown) => error_);
    expect(error).toBeInstanceOf(ApiError);
    expect(error instanceof ApiError && error.isReconnectRequired).toBe(true);
    expect(error instanceof ApiError && error.message).toBe(
      "Reconnect Discord."
    );
  });

  test("other fetchMe failures still reject with their structured status", async () => {
    respond(500, { error: { code: "OAUTH_FAILED", message: "Try later." } });
    await expect(fetchMe()).rejects.toMatchObject({
      status: 500,
      code: "OAUTH_FAILED",
    });
  });

  test("decode failures remain structured errors", async () => {
    respond(200, { not: "a guilds response" });
    await expect(fetchGuilds()).rejects.toMatchObject({
      status: 200,
      code: "DECODE",
    });
  });

  test("transport failures remain structured errors", async () => {
    spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    await expect(fetchGuilds()).rejects.toMatchObject({
      status: 0,
      code: "NETWORK",
    });
  });
});
