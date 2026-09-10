import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { subscriptions } from '../schema';
import { errorEmbed, requireManageGuild, scopeGuildId } from './_shared';
import { activeGuildSubs, pickerRow } from './_pick';

export async function executeUnsubscribe(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireManageGuild(interaction))) return;
  await interaction.deferReply();
  const subs = await activeGuildSubs(ctx, scopeGuildId(interaction));
  if (subs.length === 0) {
    await interaction.editReply({ embeds: [errorEmbed('no active subscriptions here')] });
    return;
  }
  await interaction.editReply({
    content: 'Pick a subscription to remove:',
    components: [pickerRow('jobs:unsub', subs, interaction).toJSON()],
  });
}

/** Used by the select-menu handler (`jobs:unsub`); the command only renders the picker. */
export async function removeSubscription(
  ctx: FeatureContext,
  guildId: string,
  subId: number,
): Promise<{ ok: boolean; summary: string }> {
  const [row] = await ctx.db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subId));
  if (!row || row.guildId !== guildId) return { ok: false, summary: 'subscription not found here' };
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
