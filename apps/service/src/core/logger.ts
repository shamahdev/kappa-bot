import pino from 'pino';
import type { ServiceConfig } from './config';

export function createLogger(config: ServiceConfig) {
  return pino({ level: config.logLevel, base: { app: 'service' } });
}

export type Logger = ReturnType<typeof createLogger>;
