import type { Logger } from "./logger";

/** Log and isolate feature failures from the gateway. */
export const runGuarded = async (
  feature: string,
  kind: string,
  log: Logger,
  fn: () => Promise<void> | void
): Promise<void> => {
  try {
    await fn();
  } catch (error) {
    log.error({ error, feature, kind }, "feature error (isolated)");
  }
};
