import { JOB_SOURCE_OPTIONS } from "@kappa/contracts";
import {
  ApplicationIntegrationType,
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { defineFeature } from "../../core/feature";
import type { FeatureContext } from "../../core/feature";
import { applicationErrorMessage, errorEmbed } from "./commands/_shared";
import { executeConfig } from "./commands/config";
import {
  executeCvRemove,
  executeCvStatus,
  executeCvUpload,
} from "./commands/cv";
import { executeFetch } from "./commands/fetch";
import { executeHealth } from "./commands/health";
import { executeShowLatest } from "./commands/latest";
import { executeList } from "./commands/list";
import { executeSubscribe } from "./commands/subscribe";
import { executeUnsubscribe } from "./commands/unsubscribe";
import { onChannelDelete } from "./events/channel-delete";
import { onComponent } from "./events/components";
import { onGuildDelete } from "./events/guild-delete";
import { onMessage } from "./events/reply";

export { createDiscordNotifications } from "./notifications";

export const jobsCommand = new SlashCommandBuilder()
  .setName("jobs")
  .setDescription("Manage job subscriptions")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  // Guild default above still gates guild installs; contexts + user-install
  // make /jobs usable in DMs, where the caller manages their own DM subs.
  .setContexts(
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )
  .addSubcommand((s) =>
    s
      .setName("subscribe")
      .setDescription("Create a job subscription")
      .addStringOption((o) =>
        o
          .setName("source")
          .setDescription("Job source")
          .setRequired(true)
          .addChoices(
            ...JOB_SOURCE_OPTIONS.map((source) => ({
              name: source.name,
              value: source.id,
            }))
          )
      )
      .addStringOption((o) =>
        o
          .setName("keywords")
          .setDescription("Search keywords")
          .setRequired(true)
      )
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Text channel (default current)")
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("list")
      .setDescription("List active subscriptions")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Filter by channel")
      )
  )
  .addSubcommand((s) =>
    s
      .setName("unsubscribe")
      .setDescription("Remove a subscription (pick from a menu)")
  )
  .addSubcommand((s) =>
    s
      .setName("config")
      .setDescription("Scoped retention and read-only global poll interval")
      .addIntegerOption((o) =>
        o
          .setName("retention_days")
          .setDescription("Seen-job retention (14 default)")
      )
  )
  .addSubcommand((s) =>
    s
      .setName("fetch")
      .setDescription("Manually trigger a check for this channel (all or one)")
  )
  .addSubcommand((s) =>
    s
      .setName("fetch_latest")
      .setDescription("Show the single latest job for a subscription here")
  )
  .addSubcommand((s) =>
    s.setName("health").setDescription("Check which job sources are active")
  )
  .addSubcommand((s) =>
    s
      .setName("cv_upload")
      .setDescription("Upload your CV for A–E match grades (DM only)")
      .addAttachmentOption((o) =>
        o
          .setName("file")
          .setDescription("Your CV (.pdf, .txt, or .md)")
          .setRequired(true)
      )
  )
  .addSubcommand((s) =>
    s.setName("cv_status").setDescription("Show your saved CV (DM only)")
  )
  .addSubcommand((s) =>
    s.setName("cv_remove").setDescription("Remove your saved CV (DM only)")
  );

const dispatchJobs = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  switch (interaction.options.getSubcommand()) {
    case "subscribe": {
      return executeSubscribe(interaction, ctx);
    }
    case "list": {
      return executeList(interaction, ctx);
    }
    case "unsubscribe": {
      return executeUnsubscribe(interaction, ctx);
    }
    case "config": {
      return executeConfig(interaction, ctx);
    }
    case "fetch": {
      return executeFetch(interaction, ctx);
    }
    case "fetch_latest": {
      return executeShowLatest(interaction, ctx);
    }
    case "health": {
      return executeHealth(interaction, ctx);
    }
    case "cv_upload": {
      return executeCvUpload(interaction, ctx);
    }
    case "cv_status": {
      return executeCvStatus(interaction, ctx);
    }
    case "cv_remove": {
      return executeCvRemove(interaction, ctx);
    }
    default: {
      await interaction.reply({ content: "Unknown subcommand." });
    }
  }
};

const executeJobs = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  try {
    await dispatchJobs(interaction, ctx);
  } catch (error) {
    ctx.log.error({ command: "jobs", err: error }, "job command failed");
    const payload = { embeds: [errorEmbed(applicationErrorMessage(error))] };
    await (interaction.deferred || interaction.replied
      ? interaction.editReply(payload)
      : interaction.reply({ ...payload, ephemeral: true }));
  }
};

export default defineFeature({
  commands: [{ data: jobsCommand, execute: executeJobs }],
  description: "Channel and personal job subscriptions",
  events: [
    { event: "guildDelete", handler: onGuildDelete },
    { event: "channelDelete", handler: onChannelDelete },
    { event: "interactionCreate", handler: onComponent },
    { event: "messageCreate", handler: onMessage },
  ],
  name: "job-listings",
});
