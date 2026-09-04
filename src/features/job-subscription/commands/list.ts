import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { subscriptions } from '../schema';
import { requireManageGuild } from './_shared';

export async function executeList(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireManageGuild(interaction))) return;
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Run this inside a server.', ephemeral: true });
    return;
  }
  const channel = interaction.options.getChannel('channel');
  const where = channel
    ? and(eq(subscriptions.guildId, interaction.guildId), eq(subscriptions.channelId, channel.id))
    : eq(subscriptions.guildId, interaction.guildId);
  const rows = await ctx.db.select().from(subscriptions).where(where);

  if (rows.length === 0) {
    await interaction.reply({ content: 'No active subscriptions here yet. Try `/jobs subscribe`.', ephemeral: true });
    return;
  }
  const lines = rows.map(
    (s) =>
      `**#${s.id}** ${s.isActive ? '🟢' : '⚪'} \`${s.source}\` ${s.keywords ?? '—'}${s.location ? ` · ${s.location}` : ''} → <#${s.channelId}>`,
  );
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x2b4ffe).setTitle('Job subscriptions').setDescription(lines.join('\n'))],
    ephemeral: true,
  });
}
