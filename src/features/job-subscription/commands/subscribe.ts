import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { channels, guilds, subscriptions } from '../schema';
import { errorEmbed, requireManageGuild } from './_shared';
import { isSupportedSource, SUPPORTED_SOURCES } from '../adapter';

/**
 * Indonesia-jobseeker defaults (no per-subscription overrides — the command
 * exposes only source/keywords/channel). Rationale, verified 2026-09-08:
 * - location "Indonesia" matches "Jakarta"/ID-city postings AND worldwide/APAC
 *   remote roles via the shared `matchesLocation` predicate, while excluding
 *   EU/US-scoped remote roles;
 * - Kalibrr/TechInAsia already default to country Indonesia server-side;
 * - Greenhouse defaults include Xendit (Jakarta postings live);
 * - distance only applies to LinkedIn geoId searches — null keeps text search.
 */
const DEFAULT_LOCATION = 'Indonesia';

export async function executeSubscribe(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireManageGuild(interaction))) return;
  await interaction.deferReply({ ephemeral: true });

  const source = interaction.options.getString('source', true);
  if (!isSupportedSource(source)) {
    await interaction.editReply({
      embeds: [errorEmbed(`unknown source "${source}" (supported: ${SUPPORTED_SOURCES.join(', ')})`)],
    });
    return;
  }
  const keywords = interaction.options.getString('keywords', true);
  const location = DEFAULT_LOCATION;
  const distance = null;
  const filters: Record<string, string> = {};
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  if (!channel || !('id' in channel)) {
    await interaction.editReply({ embeds: [errorEmbed('pick a text channel (or run this inside one)')] });
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
        .setColor(0x3f6b55)
        .setTitle('✅ Subscription created')
        .setDescription(
          [
            `\`${saved.source}\` → <#${saved.channelId}>`,
            `Keywords: ${saved.keywords ?? '—'}`,
            'jobs will be searched every 30 minutes.',
          ].join('\n'),
        ),
    ],
  });
}
