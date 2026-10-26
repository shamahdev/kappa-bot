import "dotenv/config";
import { closeDb, createDb, runMigrations } from "@kappa/db";
import { Elysia } from "elysia";

import { loadServiceConfig } from "./core/config";
import { err } from "./core/errors";
import { createLogger } from "./core/logger";
import { renderMetrics } from "./core/metrics";
import { accountRoutes } from "./routes/account";
import { authRoutes } from "./routes/auth";
import { cvRoutes } from "./routes/cv";
import type { RouteDeps } from "./routes/deps";
import { guildRoutes } from "./routes/guilds";
import { jobRoutes } from "./routes/jobs";
import { subscriptionRoutes } from "./routes/subscriptions";

const config = loadServiceConfig();
const log = createLogger(config);

if (config.databaseUrlUnpooled) {
  await runMigrations(config.databaseUrlUnpooled);
  log.info("migrations applied");
} else {
  log.warn("DATABASE_URL_UNPOOLED blank — skipping boot migrations");
}

const { db } = createDb(config.databaseUrl);
const deps: RouteDeps = { config, db, log };

const app = new Elysia()
  .onError(({ code, set }) => {
    // Routing and validation use contract envelopes; unexpected failures
    // use Elysia's default 500 response.
    if (code === "VALIDATION") {
      set.status = 400;
      return err("VALIDATION", "invalid request");
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return err("NOT_FOUND", "not found");
    }
  })
  .get("/health", () => ({ ok: true, uptime: process.uptime() }))
  .get("/metrics", ({ set }) => {
    set.headers["content-type"] = "text/plain; version=0.0.4";
    return renderMetrics();
  })
  .use(authRoutes(deps))
  .use(cvRoutes(deps))
  .use(guildRoutes(deps))
  .use(jobRoutes(deps))
  .use(subscriptionRoutes(deps))
  .use(accountRoutes(deps))
  .listen(config.port);

log.info({ port: config.port }, "service listening");

const close = async () => {
  app.stop();
  await closeDb();
};
process.once("SIGINT", () => close().then(() => process.exit(0)));
process.once("SIGTERM", () => close().then(() => process.exit(0)));
process.on("unhandledRejection", (error) =>
  log.fatal({ error }, "unhandled rejection (staying alive)")
);
