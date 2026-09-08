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
import { executeFetch } from './commands/fetch';
import { executeShowLatest } from './commands/latest';
import { executeHealth } from './commands/health';
import { onGuildDelete } from './events/guildDelete';
import { onChannelDelete } from './events/channelDelete';
import { onComponent } from './events/components';
import { onMessage } from './events/reply';
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
          .addChoices(
            { name: 'All Sources', value: 'all' },
            { name: 'LinkedIn', value: 'linkedin' },
            { name: 'Kalibrr', value: 'kalibrr' },
            { name: 'Tech in Asia', value: 'techinasia' },
            { name: 'Glints', value: 'glints' },
            { name: 'Indeed', value: 'indeed' },
            { name: 'Jobstreet', value: 'jobstreet' },
          ),
      )
      .addStringOption((o) => o.setName('keywords').setDescription('Search keywords').setRequired(true))
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Text channel (default current)')
          .addChannelTypes(ChannelType.GuildText),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('list')
      .setDescription('List active subscriptions')
      .addChannelOption((o) => o.setName('channel').setDescription('Filter by channel')),
  )
  .addSubcommand((s) =>
    s.setName('unsubscribe').setDescription('Remove a subscription (pick from a menu)'),
  )
  .addSubcommand((s) =>
    s
      .setName('config')
      .setDescription('Bot/job config (retention, poll interval)')
      .addIntegerOption((o) => o.setName('retention_days').setDescription('Seen-job retention (30 default)'))
      .addIntegerOption((o) => o.setName('poll_interval_minutes').setDescription('Global poll interval (30 default)')),
  )
  .addSubcommand((s) =>
    s
      .setName('fetch')
      .setDescription('Manually trigger a check for this channel (all or one)'),
  )
  .addSubcommand((s) =>
    s
      .setName('fetch_latest')
      .setDescription('Show the single latest JobPosting for a Subscription here'),
  )
  .addSubcommand((s) =>
    s.setName('health').setDescription('Check which job sources are active'),
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
    case 'fetch':
      return executeFetch(interaction, ctx);
    case 'fetch_latest':
      return executeShowLatest(interaction, ctx);
    case 'health':
      return executeHealth(interaction, ctx);
    default:
      await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

export default defineFeature({
  name: 'job-subscription',
  description: 'Channel subscriptions for filtered JobPostings (LinkedIn, Kalibrr, Tech in Asia, Glints, Indeed, Jobstreet)',
  commands: [{ data: jobsCommand, execute: executeJobs }],
  events: [
    { event: 'guildDelete', handler: onGuildDelete },
    { event: 'channelDelete', handler: onChannelDelete },
    { event: 'interactionCreate', handler: onComponent },
    { event: 'messageCreate', handler: onMessage },
  ],
  schedule: { cron: '*/30 * * * *', run: pollAll },
});
