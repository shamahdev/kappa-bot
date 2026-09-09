import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { subscriptions } from '../schema';
import { requireManageGuild, scopeGuildId } from './_shared';

export async function executeList(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireManageGuild(interaction))) return;
  const scope = scopeGuildId(interaction);
  const channel = interaction.guildId ? interaction.options.getChannel('channel') : null;
  const where = channel
    ? and(eq(subscriptions.guildId, scope), eq(subscriptions.channelId, channel.id))
    : eq(subscriptions.guildId, scope);
  const rows = await ctx.db.select().from(subscriptions).where(where);

  if (rows.length === 0) {
    await interaction.reply({ content: 'No active subscriptions here yet. Try `/jobs subscribe`.' });
    return;
  }
  const lines = rows.map(
    (s) =>
      `${s.isActive ? '🟢' : '⚪'} \`${s.source}\` ${s.keywords ?? '—'}${s.location ? ` · ${s.location}` : ''} → <#${s.channelId}>`,
  );
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x3f6b55).setTitle('Job subscriptions').setDescription(lines.join('\n'))],
  });
}
