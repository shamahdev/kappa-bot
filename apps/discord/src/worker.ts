import { createDb, createPostgresGenerationLock } from "@kappa/db";
import { createJobListings } from "@kappa/service/job-listings";
import { REST, Routes } from "discord.js";

import { loadConfig } from "./core/config";
import type { DeliverMessage } from "./core/feature";
import { createLogger } from "./core/logger";
import { createDiscordNotifications } from "./features/job-listings/notifications";

/** One service-owned polling cycle, bound to the Discord REST delivery adapter. */
export const startWorker = async (config = loadConfig()): Promise<void> => {
  const log = createLogger(config);
  const { db, pool } = createDb(config.databaseUrl);
  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const deliverMessage: DeliverMessage = async (channelId, payload) => {
    const sent = (await rest.post(Routes.channelMessages(channelId), {
      body: payload,
    })) as { id: string };
    return { messageId: sent.id };
  };
  try {
    const jobs = createJobListings({
      db,
      lock: createPostgresGenerationLock(pool),
      log,
      notifications: createDiscordNotifications(deliverMessage, config),
    });
    await jobs.pollAll();
    log.info("worker cycle done");
  } finally {
    await pool.end();
  }
};
