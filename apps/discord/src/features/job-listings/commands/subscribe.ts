import type { WorkEnvironmentType } from "@kappa/contracts";
import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import {
  errorEmbed,
  jobActor,
  jobScope,
  requireManageGuild,
} from "../interactions";
import { EMBED_COLOR } from "../presentation";

export const executeSubscribe = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireManageGuild(interaction))) {
    return;
  }
  await interaction.deferReply();
  // Personal subscriptions always use the current DM, never a guild channel option.
  const channel = interaction.guildId
    ? interaction.options.getChannel("channel")
    : null;
  const channelId = channel?.id ?? interaction.channelId;
  if (!channelId) {
    await interaction.editReply({
      embeds: [errorEmbed("Pick a text channel (or run this inside one).")],
    });
    return;
  }
  const saved = await ctx.jobListings.subscriptions.create(
    jobActor(interaction),
    {
      channelId,
      includeUnspecifiedEnvironment:
        interaction.options.getBoolean("include_unspecified_environment") ??
        false,
      includeUnspecifiedSalary:
        interaction.options.getBoolean("include_unspecified_salary") ?? false,
      keywords: interaction.options.getString("keywords", true),
      location: interaction.options.getString("location") ?? "Indonesia",
      minimumSalary: interaction.options.getNumber("minimum_salary"),
      scope: jobScope(interaction),
      scopeName: interaction.guild?.name ?? `DM with ${interaction.user.tag}`,
      source: interaction.options.getString("source", true),
      title: interaction.options.getString("title"),
      workEnvironments: (
        interaction.options.getString("work_environments") ?? ""
      )
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean) as WorkEnvironmentType[],
    }
  );
  const pollMinutes = await ctx.jobListings.subscriptions.pollIntervalMinutes();
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle("Subscription created")
        .setDescription(
          [
            `\`${saved.source}\` → <#${saved.channelId}>`,
            `Keywords: ${saved.keywords ?? "—"}`,
            ...(saved.title ? [`Title: ${saved.title}`] : []),
            ...(saved.workEnvironments?.length
              ? [`Work environment: ${saved.workEnvironments.join(", ")}`]
              : []),
            ...(saved.minimumSalary === null ||
            saved.minimumSalary === undefined
              ? []
              : [
                  `Minimum: IDR ${saved.minimumSalary.toLocaleString("id-ID")}/month (advertised upper pay may qualify)`,
                ]),
            `Jobs will be searched every ${pollMinutes} minutes.`,
          ].join("\n")
        ),
    ],
  });
};
