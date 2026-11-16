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
  const statuses = await ctx.jobListings.evaluation.statuses(rows);
  for (const [index, row] of rows.entries()) {
    const status = statuses.get(row.id);
    if (status) {
      lines[index] +=
        `\nExtraction: ${status.pending} pending, ${status.failed} failed${status.unavailable ? ` · ${status.unavailable}` : ""}`;
    }
  }
  // Split at subscription boundaries to stay within Discord's description limit.
  const pages: string[] = [];
  for (const line of lines) {
    const last = pages.length - 1;
    if (last < 0 || (pages[last]?.length ?? 0) + line.length + 2 > 4000) {
      pages.push(line);
    } else {
      pages[last] += `\n\n${line}`;
    }
  }
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle("Job subscriptions")
        .setDescription(pages[0] ?? ""),
    ],
  });
  for (const page of pages.slice(1)) {
    // Discord messages also have a total embed-text limit; send pages separately.
    // oxlint-disable-next-line no-await-in-loop
    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle("Job subscriptions")
          .setDescription(page),
      ],
    });
  }
};
