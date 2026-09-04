import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { defineFeature, type FeatureContext } from '../../core/feature';
import { executeSubscribe } from './commands/subscribe';
import { executeList } from './commands/list';
import { executeUnsubscribe } from './commands/unsubscribe';
import { executeConfig } from './commands/config';
import { onGuildDelete } from './events/guildDelete';
import { onChannelDelete } from './events/channelDelete';
import { pollAll } from './schedule';

const jobsCommand = new SlashCommandBuilder()
  .setName('jobs')
  .setDescription('Manage job subscriptions')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) =>
    s
      .setName('subscribe')
      .setDescription('Create a job subscription')
      .addStringOption((o) =>
        o
          .setName('source')
          .setDescription('Job source')
          .setRequired(true)
          .addChoices({ name: 'LinkedIn', value: 'linkedin' }),
      )
      .addStringOption((o) => o.setName('keywords').setDescription('Search keywords').setRequired(true))
      .addStringOption((o) => o.setName('location').setDescription('City/region (LinkedIn resolves to geoId)'))
      .addIntegerOption((o) =>
        o.setName('distance').setDescription('Radius (km/miles)').setMinValue(1).setMaxValue(100),
      )
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Text channel (default current)')
          .addChannelTypes(ChannelType.GuildText),
      )
      .addStringOption((o) =>
        o.setName('filters').setDescription('Advanced filters as JSON, e.g. {"f_TPR":"r86400","f_WT":"2"}'),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('list')
      .setDescription('List active subscriptions')
      .addChannelOption((o) => o.setName('channel').setDescription('Filter by channel')),
  )
  .addSubcommand((s) =>
    s
      .setName('unsubscribe')
      .setDescription('Remove a subscription by id')
      .addIntegerOption((o) =>
        o.setName('id').setDescription('Subscription id (see /jobs list)').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('config')
      .setDescription('Bot/job config (retention, poll interval)')
      .addIntegerOption((o) => o.setName('retention_days').setDescription('Seen-job retention (30 default)'))
      .addIntegerOption((o) => o.setName('poll_interval_minutes').setDescription('Global poll interval (15 default)')),
  );

async function executeJobs(interaction: ChatInputCommandInteraction, ctx: FeatureContext): Promise<void> {
  switch (interaction.options.getSubcommand()) {
    case 'subscribe':
      return executeSubscribe(interaction, ctx);
    case 'list':
      return executeList(interaction, ctx);
    case 'unsubscribe':
      return executeUnsubscribe(interaction, ctx);
    case 'config':
      return executeConfig(interaction, ctx);
    default:
      await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

export default defineFeature({
  name: 'job-subscription',
  description: 'Channel subscriptions for filtered job listings (LinkedIn Guest, Arbeitnow)',
  commands: [{ data: jobsCommand, execute: executeJobs }],
  events: [
    { event: 'guildDelete', handler: onGuildDelete },
    { event: 'channelDelete', handler: onChannelDelete },
  ],
  schedule: { cron: '*/15 * * * *', run: pollAll },
});
