import type { SourceHealth } from "@kappa/service/job-listings";
import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { formatSourceName } from "../embed";
import { requireManageGuild } from "./_shared";

export const healthEmbed = (rows: SourceHealth[]): EmbedBuilder => {
  const lines = rows.map(
    (r) =>
      `${r.active ? "Ready" : "Inactive"} · ${formatSourceName(r.source)} — ${r.detail}`
  );
  return new EmbedBuilder()
    .setColor(0x3f_6b_55)
    .setTitle("Job source health")
    .setDescription(lines.join("\n"));
};

export const executeHealth = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireManageGuild(interaction))) {
    return;
  }
  await interaction.deferReply();
  await interaction.editReply({
    embeds: [healthEmbed(await ctx.jobListings.sourceHealth())],
  });
};
