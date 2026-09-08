import { CronJob } from 'cron';
import { Events, type Client } from 'discord.js';
import { eq } from 'drizzle-orm';
import { attachHandlers, createClient, gatewayDeliverer, registerCommands } from './core/client';
import { loadConfig, type AppConfig } from './core/config';
import { closeDb, createDb, runMigrations } from './core/db';
import type { FeatureContext } from './core/feature';
import { loadFeatures } from './core/loader';
import { createLogger, type Logger } from './core/logger';
import { FeatureRegistry } from './core/registry';
import { createServer, type AppServer } from './core/server';
import { runGuarded } from './core/supervisor';
import { botConfig } from './db/schema';

export type Gateway = {
  config: AppConfig;
  log: Logger;
  client: Client;
  registry: FeatureRegistry;
  server: AppServer;
  jobs: CronJob[];
  close: () => Promise<void>;
};

/** /jobs config poll interval → cron (single feature knob, applied at boot). */
async function pollCron(db: FeatureContext['db']): Promise<string> {
  const [row] = await db.select().from(botConfig).where(eq(botConfig.id, 1));
  const minutes = row?.pollIntervalMinutes ?? 30;
  if (minutes >= 60) {
    const hours = Math.min(23, Math.round(minutes / 60));
    return `0 */${hours} * * *`;
  }
  return `*/${Math.min(59, Math.max(1, minutes))} * * * *`;
}

/** Boots everything except the network listeners (login + listen). */
export async function createApp(): Promise<Gateway> {
  const config = loadConfig();
  const log = createLogger(config);

  if (config.databaseUrlUnpooled) {
    await runMigrations(config.databaseUrlUnpooled);
    log.info('migrations applied');
  } else {
    log.warn('DATABASE_URL_UNPOOLED blank — skipping boot migrations');
  }

  const { db } = createDb(config.databaseUrl);
  const registry = new FeatureRegistry();
  for (const feature of await loadFeatures()) registry.add(feature);
  log.info({ features: registry.names() }, 'features loaded');

  const client = createClient();
  const ctx: FeatureContext = { config, db, log, deliverMessage: gatewayDeliverer(client) };
  attachHandlers(client, registry, ctx);

  const server = createServer(registry);

  const jobs: CronJob[] = [];
  for (const feature of registry.all()) {
    const schedules = Array.isArray(feature.schedule) ? feature.schedule : feature.schedule ? [feature.schedule] : [];
    for (const schedule of schedules) {
      // The job-subscription poll follows /jobs config; other schedules use
      // their declared cron as-is.
      const cron =
        feature.name === 'job-subscription' ? await pollCron(db) : schedule.cron;
      const job = new CronJob(cron, () =>
        runGuarded(feature.name, 'schedule', log, () => schedule.run(ctx)),
      );
      jobs.push(job);
    }
  }

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    for (const job of jobs) job.stop();
    server.stop();
    client.destroy();
    await closeDb();
  };
  process.once('SIGINT', () => void close().then(() => process.exit(0)));
  process.once('SIGTERM', () => void close().then(() => process.exit(0)));
  process.on('unhandledRejection', (err) => log.fatal({ err }, 'unhandled rejection (staying alive)'));

  return { config, log, client, registry, server, jobs, close };
}

/** Full gateway start: migrate → REST → login → Elysia → cron (ADR-0002/0004). */
export async function startGateway(): Promise<Gateway> {
  const app = await createApp();
  const { config, log, client, server, jobs } = app;

  if (config.clientId) {
    await registerCommands(app.registry, config.clientId, config.discordToken, config.guildId, log);
  } else {
    log.warn('CLIENT_ID blank — skipping REST command registration');
  }

  await new Promise<void>((resolve) => {
    client.once(Events.ClientReady, (c) => {
      log.info({ user: c.user.tag }, 'bot ready');
      resolve();
    });
    void client.login(config.discordToken);
  });

  server.listen(config.port);
  log.info({ port: config.port }, 'elysia listening');
  for (const job of jobs) job.start();
  log.info({ schedules: jobs.length }, 'schedules started');
  return app;
}
