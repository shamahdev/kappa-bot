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
import { executeEdit, executeRetry } from "./commands/edit";
import { executeFetch } from "./commands/fetch";
import { executeHealth } from "./commands/health";
import { executeShowLatest } from "./commands/latest";
import { executeList } from "./commands/list";
import { executeRoleTag } from "./commands/role-tag";
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
          .setDescription(
            "Comma-separated alternatives, e.g. frontend, nextjs, fullstack"
          )
          .setRequired(true)
          .setMaxLength(1018)
      )
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Text channel (default current)")
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption((o) =>
        o
          .setName("title")
          .setDescription("Optional display title; not a search keyword")
          .setMaxLength(80)
      )
      .addStringOption((o) =>
        o
          .setName("location")
          .setDescription("Search location (default Indonesia)")
      )
      .addStringOption((o) =>
        o
          .setName("work_environments")
          .setDescription(
            "Acceptable environments, comma-separated: onsite, remote, hybrid"
          )
      )
      .addNumberOption((o) =>
        o
          .setName("minimum_salary")
          .setDescription(
            "Minimum IDR/month; advertised upper salary can qualify"
          )
          .setMinValue(0)
      )
      .addBooleanOption((o) =>
        o
          .setName("include_unspecified_salary")
          .setDescription(
            "Include postings whose salary cannot be compared (default false)"
          )
      )
      .addBooleanOption((o) =>
        o
          .setName("include_unspecified_environment")
          .setDescription(
            "Include unspecified work environments (default false)"
          )
      )
      .addRoleOption((o) =>
        o
          .setName("role")
          .setDescription(
            "Mentionable role to ping on server notifications (server only)"
          )
      ),
    execute: executeSubscribe,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("role_tag")
      .setDescription("Set or remove a server subscription's notification role")
      .addRoleOption((o) =>
        o
          .setName("role")
          .setDescription("Mentionable server role; omit to remove the tag")
      ),
    execute: executeRoleTag,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("edit")
      .setDescription("Edit subscription keywords, title and posting filters"),
    execute: executeEdit,
  },
  {
    data: new SlashCommandSubcommandBuilder()
      .setName("retry_extraction")
      .setDescription("Retry failed posting extraction for a subscription"),
    execute: executeRetry,
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
