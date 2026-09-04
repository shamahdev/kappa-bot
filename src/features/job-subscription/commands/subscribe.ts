import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { channels, guilds, subscriptions } from '../schema';
import { errorEmbed, parseFilters, requireManageGuild } from './_shared';

export async function executeSubscribe(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireManageGuild(interaction))) return;
  await interaction.deferReply({ ephemeral: true });

  const source = interaction.options.getString('source', true);
  if (source !== 'linkedin') {
    await interaction.editReply({ embeds: [errorEmbed(`unknown source "${source}" (only linkedin is supported)`)] });
    return;
  }
  const keywords = interaction.options.getString('keywords', true);
  const location = interaction.options.getString('location');
  const distance = interaction.options.getInteger('distance');
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  if (!channel || !('id' in channel)) {
    await interaction.editReply({ embeds: [errorEmbed('pick a text channel (or run this inside one)')] });
    return;
  }
  let filters: Record<string, string>;
  try {
    filters = parseFilters(interaction.options.getString('filters'));
  } catch (e) {
    await interaction.editReply({ embeds: [errorEmbed((e as Error).message)] });
    return;
  }
  if (!interaction.guildId || !interaction.guild?.name) {
    await interaction.editReply({ embeds: [errorEmbed('this command only works inside a server')] });
    return;
  }

  await ctx.db.insert(guilds).values({ id: interaction.guildId, name: interaction.guild.name }).onConflictDoNothing();
  await ctx.db.insert(channels).values({ id: channel.id, guildId: interaction.guildId }).onConflictDoNothing();
  const [row] = await ctx.db
    .insert(subscriptions)
    .values({
      guildId: interaction.guildId,
      channelId: channel.id,
      keywords,
      location,
      distance,
      filters,
      source,
      createdBy: interaction.user.id,
    })
    .returning({ id: subscriptions.id });
  const [saved] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.id, row.id));

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2b4ffe)
        .setTitle('✅ Subscription created')
        .setDescription(
          [
            `**#${saved.id}** · \`${saved.source}\` → <#${saved.channelId}>`,
            `Keywords: ${saved.keywords ?? '—'}${saved.location ? ` · ${saved.location}` : ''}`,
            `Filters: \`${JSON.stringify(saved.filters)}\``,
            'New jobs arrive here every ~15 minutes.',
          ].join('\n'),
        ),
    ],
  });
}
