import {
  createDb,
  createPostgresGenerationLock,
  runMigrations,
} from "@kappa/db";
import {
  createJobListings,
  createJobPollingSchedule,
} from "@kappa/service/job-listings";
import { Events } from "discord.js";
import type { Client } from "discord.js";

import {
  attachHandlers,
  createClient,
  gatewayDeliverer,
  registerCommands,
} from "./core/client";
import { loadConfig } from "./core/config";
import type { AppConfig } from "./core/config";
import type { FeatureContext } from "./core/feature";
import { loadRegistry } from "./core/loader";
import { createLogger } from "./core/logger";
import type { Logger } from "./core/logger";
import type { FeatureRegistry } from "./core/registry";
import { createDiscordNotifications } from "./features/job-listings/notifications";

export interface Gateway {
  config: AppConfig;
  log: Logger;
  client: Client;
  registry: FeatureRegistry;
  polling: Awaited<ReturnType<typeof createJobPollingSchedule>>;
  close: () => Promise<void>;
}

/** Boots everything except the network listeners (login + listen). */
export const createApp = async (config = loadConfig()): Promise<Gateway> => {
  const log = createLogger(config);

  if (config.databaseUrlUnpooled) {
    await runMigrations(config.databaseUrlUnpooled);
    log.info("migrations applied");
  } else {
    log.warn("DATABASE_URL_UNPOOLED blank — skipping boot migrations");
  }

  const { db, pool } = createDb(config.databaseUrl);
  const registry = await loadRegistry();
  log.info({ features: registry.names() }, "features loaded");

  const client = createClient();
  const jobListings = createJobListings({
    db,
    lock: createPostgresGenerationLock(pool),
    log,
    notifications: createDiscordNotifications(gatewayDeliverer(client), config),
  });
  const ctx: FeatureContext = { config, jobListings, log };
  attachHandlers(client, registry, ctx);

  const polling = await createJobPollingSchedule(jobListings, log);

  let closing = false;
  const close = async () => {
    if (closing) {
      return;
    }
    closing = true;
    await polling.stop();
    client.destroy();
    await pool.end();
  };
  process.once("SIGINT", () => {
    void close().then(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void close().then(() => process.exit(0));
  });
  process.on("unhandledRejection", (err) =>
    log.fatal({ err }, "unhandled rejection (staying alive)")
  );

  return { client, close, config, log, polling, registry };
};

/** Gateway hosts the service module's poller; HTTP listeners remain in the service app. */
export const startGateway = async (config = loadConfig()): Promise<Gateway> => {
  const app = await createApp(config);
  const { log, client, polling } = app;

  if (config.clientId) {
    await registerCommands(
      app.registry,
      config.clientId,
      config.discordToken,
      config.guildId,
      log
    );
  } else {
    log.warn("CLIENT_ID blank — skipping REST command registration");
  }

  // Register readiness before login; resolve only on ClientReady, not on login completion.
  // oxlint-disable-next-line promise/avoid-new
  await new Promise<void>((resolve) => {
    client.once(Events.ClientReady, (c) => {
      log.info({ user: c.user.tag }, "bot ready");
      resolve();
    });
    void client.login(config.discordToken);
  });

  polling.start();
  log.info({ intervalMs: polling.intervalMs }, "job polling started");
  return app;
};
