import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { subscriptions } from '../schema';
import { errorEmbed, requireManageGuild } from './_shared';

export async function executeUnsubscribe(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireManageGuild(interaction))) return;
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.guildId) {
    await interaction.editReply({ embeds: [errorEmbed('run this inside a server')] });
    return;
  }
  const id = interaction.options.getInteger('id', true);
  const [row] = await ctx.db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.guildId, interaction.guildId)));
  if (!row) {
    await interaction.editReply({ embeds: [errorEmbed(`no subscription #${id} in this server`)] });
    return;
  }
  await ctx.db.delete(subscriptions).where(eq(subscriptions.id, id)); // cascades seen_jobs
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2b4ffe)
        .setDescription(`🗑️ Removed subscription **#${id}** (\`${row.source}\` ${row.keywords ?? ''}). Past deliveries stay deleted with it.`),
    ],
  });
}
