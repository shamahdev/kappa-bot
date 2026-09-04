import { incCounter } from './metrics';
import type { Logger } from './logger';

/** Failure isolation (ADR-0002): one feature's error never crashes core. */
export async function runGuarded(
  feature: string,
  kind: string,
  log: Logger,
  fn: () => Promise<void> | void,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    log.error({ feature, kind, err }, 'feature error (isolated)');
    incCounter('feature_error_total', { feature });
  }
}
