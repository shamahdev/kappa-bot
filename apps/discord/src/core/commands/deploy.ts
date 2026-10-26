// bun apps/discord/src/core/commands/deploy.ts — manual slash-command sync.
// (or: bun --filter @kappa/discord deploy:commands, from the repo root)
// Skips gracefully when CLIENT_ID is blank (prototype stage).

import { registerCommands } from "../client";
import { loadConfig } from "../config";
import { loadFeatures } from "../loader";
import { createLogger } from "../logger";
import { FeatureRegistry } from "../registry";

const main = async () => {
  const config = loadConfig();
  const log = createLogger(config);
  if (!config.clientId) {
    const registry = new FeatureRegistry();
    for (const feature of await loadFeatures()) {
      registry.add(feature);
    }
    console.log(
      `CLIENT_ID is blank — REST PUT skipped. Discovered commands: ${registry
        .commandsFlat()
        .map((c) => `/${c.def.data.name}`)
        .join(", ")}`
    );
    return;
  }
  const registry = new FeatureRegistry();
  for (const feature of await loadFeatures()) {
    registry.add(feature);
  }
  await registerCommands(
    registry,
    config.clientId,
    config.discordToken,
    config.guildId,
    log
  );
};

try {
  await main();
} catch (error) {
  console.error(`deploy failed: ${(error as Error).message}`);
  process.exit(1);
}
