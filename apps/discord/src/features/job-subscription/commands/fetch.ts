import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { FeatureContext } from '../../../core/feature';
import { errorEmbed, requireManageGuild, scopeGuildId } from './_shared';
import { activeChannelSubs, pickerRow, type Subscription } from './_pick';
import { pollSubscriptions, type PollResult } from '../schedule';

export async function executeFetch(
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
    content: 'Fetch now — all subscriptions here, or one:',
    components: [pickerRow('jobs:fetch', subs, interaction, 'All in this channel').toJSON()],
  });
}

export function fetchResultEmbed(result: PollResult): EmbedBuilder {
  const timeFormatted = (result.durationMs / 1000).toFixed(2);
  const subText = result.subscriptionsCount === 1 ? '1 subscription' : `${result.subscriptionsCount} subscriptions`;
  const jobText = result.newJobsDelivered === 1 ? '1 new job' : `${result.newJobsDelivered} new jobs`;
  return new EmbedBuilder()
    .setColor(0x3f6b55)
    .setTitle('⚡ Manual Fetch Complete')
    .setDescription(
      [
        `Polled **${subText}**`,
        `Delivered **${jobText}** to subscribed channels`,
        `Completed in **${timeFormatted}s**`,
      ].join('\n'),
     );
}

export async function runFetch(
  ctx: FeatureContext,
  targetSubs: Subscription[],
): Promise<PollResult> {
  return pollSubscriptions(ctx, targetSubs);
}
