import { describe, expect, test } from "bun:test";

import type { Logger } from "../../../core/logger";
import { createJobPollingSchedule, pollIntervalMs } from "./scheduler";

const log = { error() {} } as unknown as Logger;

describe("service-owned polling schedule", () => {
  test("uses elapsed minutes, not the cron minute field or rounded hours", () => {
    expect(pollIntervalMs(120)).toBe(7_200_000);
    expect(pollIntervalMs(90)).toBe(5_400_000);
    expect(pollIntervalMs(1440)).toBe(86_400_000);
    expect(() => pollIntervalMs(0)).toThrow();
    expect(() => pollIntervalMs(1.5)).toThrow();
  });

  test("owns timer lifecycle and drains an in-flight tick without overlap", async () => {
    let complete!: () => void;
    // The test must explicitly release an in-flight tick to verify draining and singleflight.
    // oxlint-disable-next-line promise/avoid-new
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    });
    let calls = 0;
    let scheduledMs = 0;
    let cleared = false;
    const jobs = {
      pollAll: async () => {
        calls += 1;
        await pending;
      },
      subscriptions: { pollIntervalMinutes: () => Promise.resolve(120) },
    };
    const schedule = await createJobPollingSchedule(jobs, log, {
      clear: (handle) => {
        cleared = handle === "timer";
      },
      set: (_run, milliseconds) => {
        scheduledMs = milliseconds;
        return "timer";
      },
    });
    schedule.start();
    schedule.start();
    expect(scheduledMs).toBe(7_200_000);
    const first = schedule.tick();
    const second = schedule.tick();
    expect(first).toBe(second);
    expect(calls).toBe(1);
    let stopped = false;
    const stop = async () => {
      await schedule.stop();
      stopped = true;
    };
    const stopping = stop();
    expect(cleared).toBe(true);
    expect(stopped).toBe(false);
    complete();
    await stopping;
    expect(stopped).toBe(true);
  });
});
