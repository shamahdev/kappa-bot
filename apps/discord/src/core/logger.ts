import pino from "pino";

import type { AppConfig } from "./config";

export const createLogger = (config: AppConfig) =>
  pino({ base: { role: config.botRole }, level: config.logLevel });

export type Logger = ReturnType<typeof createLogger>;
