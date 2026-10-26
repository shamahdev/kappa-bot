import type { Logger } from "../../../core/logger";

interface ScheduledJobs {
  subscriptions: { pollIntervalMinutes: () => Promise<number> };
  pollAll: () => Promise<unknown>;
}

interface Timers {
  set: (run: () => void, milliseconds: number) => unknown;
  clear: (handle: unknown) => void;
}

const systemTimers: Timers = {
  clear: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  set: (run, milliseconds) => setInterval(run, milliseconds),
};

export const pollIntervalMs = (minutes: number): number => {
  // Retain the existing operator-setting range, previously enforced by /jobs config.
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error("poll interval must be an integer 1–1440 minutes");
  }
  return minutes * 60_000;
};

/** Exact elapsed intervals; a slow tick cannot overlap another in this process. */
export const createJobPollingSchedule = async (
  jobs: ScheduledJobs,
  log: Logger,
  timers = systemTimers
) => {
  const intervalMs = pollIntervalMs(
    await jobs.subscriptions.pollIntervalMinutes()
  );
  let handle: unknown;
  let active = false;
  let running: Promise<void> | undefined;
  const poll = async (): Promise<void> => {
    try {
      await jobs.pollAll();
    } catch (error) {
      log.error({ error }, "job polling failed");
    }
  };
  const tick = (): Promise<void> => {
    running ??= poll().finally(() => {
      running = undefined;
    });
    return running;
  };
  return {
    intervalMs,
    start() {
      if (active) {
        return;
      }
      active = true;
      handle = timers.set(() => {
        tick();
      }, intervalMs);
    },
    async stop() {
      if (active) {
        timers.clear(handle);
      }
      active = false;
      await running;
    },
    tick,
  };
};
