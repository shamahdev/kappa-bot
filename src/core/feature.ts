import type {
  APIEmbed,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AppConfig } from './config';
import type { Logger } from './logger';

/** Structural subset of the Elysia app a feature may mount routes on. */
export type ServerApp = {
  get: (...args: any[]) => any;
  post: (...args: any[]) => any;
};

export type GatewayDb = NodePgDatabase;

export type SendPayload = {
  content?: string;
  embeds?: APIEmbed[];
};

/** Shared context handed to every command, event, and schedule handler. */
export type FeatureContext = {
  config: AppConfig;
  db: GatewayDb;
  log: Logger;
  sendMessage: (channelId: string, payload: SendPayload) => Promise<void>;
};

export type CommandDef = {
  /** Top-level slash command (e.g. /jobs). Dispatched by commandName. */
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction, ctx: FeatureContext) => Promise<void>;
};

export type EventDef = {
  /** discord.js client event name, e.g. 'guildDelete'. */
  event: string;
  once?: boolean;
  handler: (ctx: FeatureContext, ...args: unknown[]) => Promise<void> | void;
};

export type ScheduleDef = {
  cron: string;
  run: (ctx: FeatureContext) => Promise<void>;
};

export type Feature = {
  name: string;
  description: string;
  commands?: CommandDef[];
  events?: EventDef[];
  /** Single schedule or list (e.g. poll + nightly cleanup). */
  schedule?: ScheduleDef | ScheduleDef[];
  /** Optional extra HTTP routes on the shared Elysia app. */
  server?: (app: ServerApp) => void;
};

export function defineFeature(feature: Feature): Feature {
  return feature;
}
