import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { DeliverMessage, FeatureContext, MessagePayload } from "./feature";
import type { Logger } from "./logger";
import type { FeatureRegistry } from "./registry";
import { runGuarded } from "./supervisor";

export const createClient = (): Client =>
  // GuildMessages + privileged MessageContent power reply-by-number on delivery
  // messages. Requires the Message Content Intent toggle in the portal (Bot tab).
  // DirectMessages + Partial Channel extend the same reply-by-number path to
  // bot DMs (DM subscriptions deliver there).
  new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

export const commandBodies = (registry: FeatureRegistry): unknown[] =>
  registry.commandsFlat().map((c) => c.def.data.toJSON());

/** Guild-scoped registration when GUILD_ID is set (dev), otherwise global. */
export const registerCommands = async (
  registry: FeatureRegistry,
  clientId: string,
  token: string,
  guildId: string,
  log: Logger
): Promise<void> => {
  const body = commandBodies(registry) as never[];
  const rest = new REST({ version: "10" }).setToken(token);
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body,
    });
    log.info({ commands: body.length, guildId }, "registered guild commands");
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    log.info({ commands: body.length }, "registered global commands");
  }
};

const isChatInput = (
  interaction: unknown
): interaction is ChatInputCommandInteraction =>
  (interaction as ChatInputCommandInteraction).isChatInputCommand?.() === true;

/** Routes interactionCreate by commandName + binds feature event handlers. */
export const attachHandlers = (
  client: Client,
  registry: FeatureRegistry,
  ctx: FeatureContext
): void => {
  client.on(Events.InteractionCreate, (interaction) => {
    if (!isChatInput(interaction)) {
      return;
    }
    const found = registry.findCommand(interaction.commandName);
    if (!found) {
      return;
    }
    void runGuarded(
      found.feature,
      `command:${found.def.data.name}`,
      ctx.log,
      () => found.def.execute(interaction, ctx)
    );
  });

  for (const feature of registry.all()) {
    for (const def of feature.events ?? []) {
      const run = (...args: unknown[]) =>
        runGuarded(feature.name, `event:${def.event}`, ctx.log, () =>
          def.handler(ctx, ...args)
        );
      if (def.once) {
        client.once(def.event, run);
      } else {
        client.on(def.event, run);
      }
    }
  }
};

/** Gateway sender: resolves the channel from the logged-in client. */
export const gatewayDeliverer =
  (client: Client): DeliverMessage =>
  async (channelId: string, payload: MessagePayload) => {
    const channel = await client.channels.fetch(channelId);
    if (!(channel && channel.isSendable())) {
      throw new Error(`channel ${channelId} is not sendable`);
    }
    const sent = await channel.send(payload);
    return { messageId: sent.id };
  };
