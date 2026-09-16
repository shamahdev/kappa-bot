import type { GatewayDb } from '@kappa/db';
import type { ServiceConfig } from '../core/config';
import type { Logger } from '../core/logger';

/** Shared per-request dependencies for all /api/v1 route modules. */
export type RouteDeps = {
  config: ServiceConfig;
  db: GatewayDb;
  log: Logger;
};
