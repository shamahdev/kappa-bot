import type { Database, GenerationLock } from "@kappa/db";

import type { ServiceConfig } from "../core/config";
import type { Logger } from "../core/logger";

/** Shared per-request dependencies for all /api/v1 route modules. */
export interface RouteDeps {
  config: ServiceConfig;
  db: Database;
  lock?: GenerationLock;
  log: Logger;
}
