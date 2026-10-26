import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { jobActor, jobScope, requireManageGuild } from "./_shared";

/** Retention is scoped; the global poll interval is informational only. */
export const executeConfig = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireManageGuild(interaction))) {
    return;
  }
  await interaction.deferReply();
  const actor = jobActor(interaction);
  const scope = jobScope(interaction);
  const retention = interaction.options.getInteger("retention_days");
  if (retention !== null) {
    await ctx.jobListings.subscriptions.setRetention(actor, scope, retention);
  }
  const pollMinutes = await ctx.jobListings.subscriptions.pollIntervalMinutes();
  const rows = await ctx.jobListings.subscriptions.list(actor, scope);
  const lines = rows.map(
    (s) =>
      `${s.isActive ? "Active" : "Inactive"} · \`${s.source}\` ${s.keywords ?? "—"}${s.location ? ` · ${s.location}` : ""} → <#${s.channelId}>`
  );
  const sections = [
    `Poll: every **${pollMinutes}m** (operator-managed; changes apply after restart)`,
  ];
  if (retention !== null) {
    sections.push(
      `Retention: **${retention}d** applied to your subscriptions here`
    );
  }
  sections.push(
    lines.length
      ? `Subscribed channels (where jobs arrive):\n${lines.join("\n")}`
      : "No subscriptions yet — run `/jobs subscribe` to get jobs here."
  );
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3f_6b_55)
        .setTitle(retention === null ? "Job config" : "Config updated")
        .setDescription(sections.join("\n\n")),
    ],
  });
};
