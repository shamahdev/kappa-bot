import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { botConfig, subscriptions } from '../schema';
import { errorEmbed, requireManageGuild, scopeGuildId } from './_shared';

/** Poll interval from the singleton, or 30 (schema default) when unset. */
async function currentPollMinutes(ctx: FeatureContext): Promise<number> {
  const [row] = await ctx.db.select().from(botConfig).where(eq(botConfig.id, 1));
  return row?.pollIntervalMinutes ?? 30;
}

/** Where JobPostings go: one line per subscription → target channel. */
async function subscriptionLines(ctx: FeatureContext, guildId: string): Promise<string[]> {
  const rows = await ctx.db.select().from(subscriptions).where(eq(subscriptions.guildId, guildId));
  return rows.map(
    (s) =>
      `${s.isActive ? '🟢' : '⚪'} \`${s.source}\` ${s.keywords ?? '—'}${s.location ? ` · ${s.location}` : ''} → <#${s.channelId}>`,
  );
}

/**
 * /jobs config: with options → update (poll → bot_config singleton, effective
 * on restart; retention → bulk-update this guild's subscriptions); always
 * ends by showing current state (poll interval + where JobPostings are delivered).
 */
export async function executeConfig(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireManageGuild(interaction))) return;
  await interaction.deferReply();
  const scope = scopeGuildId(interaction);
  const retention = interaction.options.getInteger('retention_days');
  const poll = interaction.options.getInteger('poll_interval_minutes');

  // Poll interval is a global singleton: DM callers must not mutate shared state.
  if (poll !== null && !interaction.guildId) {
    await interaction.editReply({
      embeds: [errorEmbed('poll_interval_minutes is server-managed — change it from a server, or set retention_days here')],
    });
    return;
  }

  if (poll !== null) {
    if (poll < 1 || poll > 1440) {
      await interaction.editReply({ embeds: [errorEmbed('poll_interval_minutes must be 1–1440')] });
      return;
    }
    await ctx.db.insert(botConfig).values({ id: 1, pollIntervalMinutes: poll }).onConflictDoUpdate({
      target: botConfig.id,
      set: { pollIntervalMinutes: poll },
    });
  }
  if (retention !== null) {
    if (retention < 1 || retention > 365) {
      await interaction.editReply({ embeds: [errorEmbed('retention_days must be 1–365')] });
      return;
    }
    await ctx.db
      .update(subscriptions)
      .set({ retentionDays: retention })
      .where(eq(subscriptions.guildId, scope));
  }

  const pollMinutes = await currentPollMinutes(ctx);
  const lines = await subscriptionLines(ctx, scope);
  const sections = [`🔁 Poll: every **${pollMinutes}m** (change applies on restart)`];
  if (retention !== null) sections.push(`🗑️ Retention: **${retention}d** applied to your subscriptions here`);
  sections.push(
    lines.length > 0
      ? `📡 Subscribed channels (where JobPostings arrive):\n${lines.join('\n')}`
      : '📡 No subscriptions yet — run `/jobs subscribe` to get JobPostings here.',
  );

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3f6b55)
        .setTitle(poll !== null || retention !== null ? '⚙️ Config updated' : '⚙️ Job config')
        .setDescription(sections.join('\n\n')),
    ],
  });
}
