import { JOB_SOURCE_OPTIONS, DEFAULT_RETENTION_DAYS } from "@kappa/contracts";
import {
  ApplicationIntegrationType,
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext, Feature } from "../../core/feature";
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
import { applicationErrorMessage, errorEmbed } from "./interactions";

const subcommands = [
  {
    data: new SlashCommandSubcommandBuilder()
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
      ),
    execute: executeSubscribe,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("list")
      .setDescription("List active subscriptions")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Filter by channel")
      ),
    execute: executeList,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("unsubscribe")
      .setDescription("Remove a subscription (pick from a menu)"),
    execute: executeUnsubscribe,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("config")
      .setDescription("Scoped retention and read-only global poll interval")
      .addIntegerOption((o) =>
        o
          .setName("retention_days")
          .setDescription(
            `Seen-job retention (${DEFAULT_RETENTION_DAYS} default)`
          )
      ),
    execute: executeConfig,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("fetch")
      .setDescription("Manually trigger a check for this channel (all or one)"),
    execute: executeFetch,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("fetch_latest")
      .setDescription("Show the single latest job for a subscription here"),
    execute: executeShowLatest,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("health")
      .setDescription("Check which job sources are active"),
    execute: executeHealth,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("cv_upload")
      .setDescription("Upload your CV for A–E match grades (DM only)")
      .addAttachmentOption((o) =>
        o
          .setName("file")
          .setDescription("Your CV (.pdf, .txt, or .md)")
          .setRequired(true)
      ),
    execute: executeCvUpload,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("cv_status")
      .setDescription("Show your saved CV (DM only)"),
    execute: executeCvStatus,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("cv_remove")
      .setDescription("Remove your saved CV (DM only)"),
    execute: executeCvRemove,
  },
];

export const jobsCommand = new SlashCommandBuilder()
  .setName("jobs")
  .setDescription("Manage job subscriptions")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  // Guild defaults gate server installs; user installs also support private subscriptions.
  .setContexts(
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  );

for (const subcommand of subcommands) {
  jobsCommand.addSubcommand(subcommand.data);
}

const dispatchJobs = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  const name = interaction.options.getSubcommand();
  const subcommand = subcommands.find((entry) => entry.data.name === name);
  if (subcommand) {
    return subcommand.execute(interaction, ctx);
  }
  await interaction.reply({ content: "Unknown subcommand." });
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

const feature: Feature = {
  commands: [{ data: jobsCommand, execute: executeJobs }],
  events: [
    { event: "guildDelete", handler: onGuildDelete },
    { event: "channelDelete", handler: onChannelDelete },
    { event: "interactionCreate", handler: onComponent },
    { event: "messageCreate", handler: onMessage },
  ],
  name: "job-listings",
};

export default feature;
