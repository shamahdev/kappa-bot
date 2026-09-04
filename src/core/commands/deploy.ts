// bun src/core/commands/deploy.ts — manual slash-command sync.
// Skips gracefully when CLIENT_ID is blank (prototype stage).
import { loadConfig } from '../config';
import { createLogger } from '../logger';
import { FeatureRegistry } from '../registry';
import { loadFeatures } from '../loader';
import { registerCommands } from '../client';

async function main() {
  const config = loadConfig();
  const log = createLogger(config);
  if (!config.clientId) {
    const registry = new FeatureRegistry();
    for (const feature of await loadFeatures()) registry.add(feature);
    console.log(
      `CLIENT_ID is blank — REST PUT skipped. Discovered commands: ${registry
        .commandsFlat()
        .map((c) => `/${c.def.data.name}`)
        .join(', ')}`,
    );
    return;
  }
  const registry = new FeatureRegistry();
  for (const feature of await loadFeatures()) registry.add(feature);
  await registerCommands(registry, config.clientId, config.discordToken, config.guildId, log);
}

main().catch((e) => {
  console.error(`deploy failed: ${(e as Error).message}`);
  process.exit(1);
});
