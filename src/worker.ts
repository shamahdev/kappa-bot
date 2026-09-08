// BOT_ROLE=worker: run every feature schedule ONCE via Discord REST (no gateway
// WS) and exit. Suited to an external scheduler; shares the same schedule
// contract as the gateway cron path (ADR-0004 upgrade route).
// NOTE: reuses the pg Pool DB layer for full type-safety with feature code;
// the neon-http switch for cold-start workers is a documented future step.
import { REST, Routes } from 'discord.js';
import { loadConfig } from './core/config';
import { closeDb, createDb } from './core/db';
import type { FeatureContext, MessagePayload } from './core/feature';
import { loadFeatures } from './core/loader';
import { createLogger } from './core/logger';
import { FeatureRegistry } from './core/registry';
import { runGuarded } from './core/supervisor';

export async function startWorker(): Promise<void> {
  const config = loadConfig();
  const log = createLogger(config);
  const { db } = createDb(config.databaseUrl);
  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  const deliverMessage = async (channelId: string, payload: MessagePayload) => {
    const res = (await rest.post(Routes.channelMessages(channelId), { body: payload })) as {
      id?: unknown;
    };
    return { messageId: typeof res?.id === 'string' ? res.id : undefined };
  };
  const ctx: FeatureContext = { config, db, log, deliverMessage };

  const registry = new FeatureRegistry();
  for (const feature of await loadFeatures()) registry.add(feature);
  for (const feature of registry.all()) {
    const schedules = Array.isArray(feature.schedule) ? feature.schedule : feature.schedule ? [feature.schedule] : [];
    for (const schedule of schedules) {
      await runGuarded(feature.name, 'schedule', log, () => schedule.run(ctx));
    }
  }
  await closeDb();
  log.info('worker cycle done');
}
