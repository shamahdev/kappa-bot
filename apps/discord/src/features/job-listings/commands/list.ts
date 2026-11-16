import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { jobActor, jobScope, requireManageGuild } from "../interactions";
import { EMBED_COLOR, subscriptionLine } from "../presentation";

export const executeList = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireManageGuild(interaction))) {
    return;
  }
  await interaction.deferReply();
  const channel = interaction.guildId
    ? interaction.options.getChannel("channel")
    : null;
  const rows = await ctx.jobListings.subscriptions.list(
    jobActor(interaction),
    jobScope(interaction),
    channel?.id
  );
  if (!rows.length) {
    await interaction.editReply({
      content: "No subscriptions here yet. Try `/jobs subscribe`.",
    });
    return;
  }
  const lines = rows.map(subscriptionLine);
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle("Job subscriptions")
        .setDescription(lines.join("\n")),
    ],
  });
};
