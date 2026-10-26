import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { errorEmbed, jobActor, jobScope, requireManageGuild } from "./_shared";

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
      keywords: interaction.options.getString("keywords", true),
      scope: jobScope(interaction),
      scopeName: interaction.guild?.name ?? `DM with ${interaction.user.tag}`,
      source: interaction.options.getString("source", true),
    }
  );
  const pollMinutes = await ctx.jobListings.subscriptions.pollIntervalMinutes();
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3f_6b_55)
        .setTitle("Subscription created")
        .setDescription(
          [
            `\`${saved.source}\` → <#${saved.channelId}>`,
            `Keywords: ${saved.keywords ?? "—"}`,
            `Jobs will be searched every ${pollMinutes} minutes.`,
          ].join("\n")
        ),
    ],
  });
};
