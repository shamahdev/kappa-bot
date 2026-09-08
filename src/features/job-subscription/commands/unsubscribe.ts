import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { subscriptions } from '../schema';
import { errorEmbed, requireManageGuild } from './_shared';
import { activeGuildSubs, pickerRow } from './_pick';

export async function executeUnsubscribe(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireManageGuild(interaction))) return;
  await interaction.deferReply();
  if (!interaction.guildId) {
    await interaction.editReply({ embeds: [errorEmbed('run this inside a server')] });
    return;
  }
  const subs = await activeGuildSubs(ctx, interaction.guildId);
  if (subs.length === 0) {
    await interaction.editReply({ embeds: [errorEmbed('no active subscriptions in this server')] });
    return;
  }
  await interaction.editReply({
    content: 'Pick a subscription to remove:',
    components: [pickerRow('jobs:unsub', subs, interaction).toJSON()],
  });
}

/** Shared by the command (no-op now) and the select-menu handler. */
export async function removeSubscription(
  ctx: FeatureContext,
  guildId: string,
  subId: number,
): Promise<{ ok: boolean; summary: string }> {
  const [row] = await ctx.db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subId));
  if (!row || row.guildId !== guildId) return { ok: false, summary: 'subscription not found in this server' };
  await ctx.db.delete(subscriptions).where(eq(subscriptions.id, subId)); // cascades seen_jobs
  return {
    ok: true,
    summary: `\`${row.source}\` ${row.keywords ?? ''}${row.location ? ` · ${row.location}` : ''}`,
  };
}

export function removedEmbed(summary: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3f6b55)
    .setDescription(`🗑️ Removed subscription (${summary}). Past deliveries stay deleted with it.`);
}
