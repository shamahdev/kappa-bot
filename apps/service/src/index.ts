import 'dotenv/config';
import { Elysia } from 'elysia';
import { closeDb, createDb, runMigrations } from '@kappa/db';
import { loadServiceConfig } from './core/config';
import { createLogger } from './core/logger';
import { renderMetrics } from './core/metrics';
import { err } from './core/errors';
import { authRoutes } from './routes/auth';
import { guildRoutes } from './routes/guilds';
import { jobRoutes } from './routes/jobs';
import { subscriptionRoutes } from './routes/subscriptions';
import { accountRoutes } from './routes/account';
import type { RouteDeps } from './routes/deps';

const config = loadServiceConfig();
const log = createLogger(config);

if (config.databaseUrlUnpooled) {
  await runMigrations(config.databaseUrlUnpooled);
  log.info('migrations applied');
} else {
  log.warn('DATABASE_URL_UNPOOLED blank — skipping boot migrations');
}

const { db } = createDb(config.databaseUrl);
const deps: RouteDeps = { config, db, log };

const app = new Elysia()
  .onError(({ code, set }) => {
    // Spec §5 envelopes for routing/validation failures; anything else falls
    // through to Elysia's default 500 (no 500 code exists in the contract).
    if (code === 'VALIDATION') {
      set.status = 400;
      return err('VALIDATION', 'invalid request');
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return err('NOT_FOUND', 'not found');
    }
    return undefined;
  })
  .get('/health', () => ({ ok: true, uptime: process.uptime() }))
  .get('/metrics', ({ set }) => {
    set.headers['content-type'] = 'text/plain; version=0.0.4';
    return renderMetrics();
  })
  .use(authRoutes(deps))
  .use(guildRoutes(deps))
  .use(jobRoutes(deps))
  .use(subscriptionRoutes(deps))
  .use(accountRoutes(deps))
  .listen(config.port);

log.info({ port: config.port }, 'service listening');

const close = async () => {
  app.stop();
  await closeDb();
};
process.once('SIGINT', () => void close().then(() => process.exit(0)));
process.once('SIGTERM', () => void close().then(() => process.exit(0)));
process.on('unhandledRejection', (error) => log.fatal({ error }, 'unhandled rejection (staying alive)'));
