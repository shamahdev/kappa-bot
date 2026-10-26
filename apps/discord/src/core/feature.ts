import type { JobListings } from "@kappa/service/job-listings";
import type {
  APIEmbed,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

import type { AppConfig } from "./config";
import type { Logger } from "./logger";

export interface MessagePayload {
  content?: string;
  embeds?: APIEmbed[];
}
export type DeliverMessage = (
  channelId: string,
  payload: MessagePayload
) => Promise<{ messageId?: string }>;

export interface FeatureContext {
  config: AppConfig;
  jobListings: JobListings;
  log: Logger;
}

export interface CommandDef {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (
    interaction: ChatInputCommandInteraction,
    ctx: FeatureContext
  ) => Promise<void>;
}

export interface EventDef {
  event: string;
  once?: boolean;
  handler: (ctx: FeatureContext, ...args: unknown[]) => Promise<void> | void;
}

export interface Feature {
  name: string;
  description: string;
  commands?: CommandDef[];
  events?: EventDef[];
}

export const defineFeature = (feature: Feature): Feature => feature;
