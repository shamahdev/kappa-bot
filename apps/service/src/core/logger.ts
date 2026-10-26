import pino from "pino";

import type { ServiceConfig } from "./config";

export const createLogger = (config: ServiceConfig) =>
  pino({ base: { app: "service" }, level: config.logLevel });

export type Logger = ReturnType<typeof createLogger>;
