import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { channels, guilds, subscriptions } from '../schema';
import { errorEmbed, requireManageGuild, scopeGuildId } from './_shared';
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
  await interaction.deferReply();

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
  // The channel option is guild-only: in DMs always deliver to this DM
  // channel, so a DM caller can never point a dm-scoped sub at a guild channel.
  const channel = interaction.guildId ? interaction.options.getChannel('channel') : null;
  const target = channel ?? interaction.channel;
  if (!target || !('id' in target)) {
    await interaction.editReply({ embeds: [errorEmbed('pick a text channel (or run this inside one)')] });
    return;
  }
  // Guilds scope to the guild; DMs scope to a synthetic per-user guild and
  // always deliver to this DM channel (the channel option is guild-only).
  const scope = scopeGuildId(interaction);
  const scopeName = interaction.guild?.name ?? `DM with ${interaction.user.tag}`;

  await ctx.db.insert(guilds).values({ id: scope, name: scopeName }).onConflictDoNothing();
  await ctx.db.insert(channels).values({ id: target.id, guildId: scope }).onConflictDoNothing();
  const [row] = await ctx.db
    .insert(subscriptions)
    .values({
      guildId: scope,
      channelId: target.id,
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
