import { type APIEmbed, type ChatInputCommandInteraction } from 'discord.js';
import type { FeatureContext } from '../../../core/feature';
import { searchJobPostings } from '../adapter';
import { renderJobPostingCard, sortNewestFirst } from '../embed';
import { errorEmbed, requireManageGuild, scopeGuildId } from './_shared';
import { activeChannelSubs, pickerRow, type Subscription } from './_pick';

export async function executeShowLatest(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireManageGuild(interaction))) return;
  if (!interaction.channelId) {
    await interaction.reply({ content: 'Run this inside a server channel or DM.' });
    return;
  }

  await interaction.deferReply();

  const subs = await activeChannelSubs(ctx, scopeGuildId(interaction), interaction.channelId);
  if (subs.length === 0) {
    await interaction.editReply({
      embeds: [errorEmbed('No active subscriptions in this channel. Try `/jobs subscribe`.')],
    });
    return;
  }
  await interaction.editReply({
    content: 'Show the latest JobPosting for:',
    components: [pickerRow('jobs:latest', subs, interaction).toJSON()],
  });
}

/**
 * Latest JobPosting for one subscription, bypassing seen_jobs dedup entirely —
 * no rows read, no rows written. Returns null when the source has nothing.
 */
export async function showLatestJob(
  ctx: FeatureContext,
  sub: Subscription,
): Promise<{ embeds: APIEmbed[] } | null> {
  const jobs = await searchJobPostings(
    sub.source,
    {
      keywords: sub.keywords ?? '',
      location: sub.location,
      geoId: sub.geoId,
      distance: sub.distance,
      filters: (sub.filters ?? {}) as Record<string, string>,
    },
    `latest:${sub.id}`,
  );
  if (jobs.length === 0) return null;
  const [top] = sortNewestFirst(jobs.map((job) => ({ job })));
  const card = await renderJobPostingCard(ctx.log, top!.job, sub.keywords);
  return { embeds: [card.toJSON()] };
}
