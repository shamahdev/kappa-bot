import { CronJob } from 'cron';
import { Events, type Client } from 'discord.js';
import { attachHandlers, createClient, gatewayDeliverer, registerCommands } from './core/client';
import { loadConfig, type AppConfig } from './core/config';
import { closeDb, createDb, runMigrations } from './core/db';
import type { FeatureContext } from './core/feature';
import { loadFeatures } from './core/loader';
import { createLogger, type Logger } from './core/logger';
import { FeatureRegistry } from './core/registry';
import { createServer, type AppServer } from './core/server';
import { runGuarded } from './core/supervisor';

export type Gateway = {
  config: AppConfig;
  log: Logger;
  client: Client;
  registry: FeatureRegistry;
  server: AppServer;
  jobs: CronJob[];
  close: () => Promise<void>;
};

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
      // Schedules may resolve their cron at boot (job-subscription reads
      // /jobs config); others use the declared cron as-is.
      const cron = schedule.resolveCron ? await schedule.resolveCron(ctx) : schedule.cron;
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
