import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { jobActor, jobScope, requireManageGuild } from "./_shared";

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
  const lines = rows.map(
    (s) =>
      `${s.isActive ? "Active" : "Inactive"} · \`${s.source}\` ${s.keywords ?? "—"}${s.location ? ` · ${s.location}` : ""} → <#${s.channelId}>`
  );
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3f_6b_55)
        .setTitle("Job subscriptions")
        .setDescription(lines.join("\n")),
    ],
  });
};
