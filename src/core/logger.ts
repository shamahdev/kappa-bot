import pino from 'pino';
import type { AppConfig } from './config';

export function createLogger(config: AppConfig) {
  return pino({ level: config.logLevel, base: { role: config.botRole } });
}

export type Logger = ReturnType<typeof createLogger>;
