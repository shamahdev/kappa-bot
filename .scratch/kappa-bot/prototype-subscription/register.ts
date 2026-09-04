// Throwaway prototype for wayfinder ticket 10 — NOT production code.
// Mirrors ticket 09's decided `/jobs` command schema (SlashCommandBuilder).
// Dry-run: prints the registration JSON. Performs the real REST PUT only
// when CLIENT_ID is set (it is blank in .env right now, so it skips).

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

export const jobsCommand = new SlashCommandBuilder()
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
            { name: 'LinkedIn', value: 'linkedin' },
            { name: 'Arbeitnow', value: 'arbeitnow' },
          ),
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
        o.setName('id').setDescription('Subscription id').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('config')
      .setDescription('Bot/job config (retention, poll interval)')
      .addIntegerOption((o) => o.setName('retention_days').setDescription('Seen-job retention (30 default)'))
      .addIntegerOption((o) => o.setName('poll_interval_minutes').setDescription('Global poll interval (15 default)')),
  );

if (import.meta.main) {
  const json = jobsCommand.toJSON();
  console.log(`subcommands: ${(json.options ?? []).map((o: { name: string }) => o.name).join(', ')}`);
  console.log(`default_member_permissions: ${json.default_member_permissions}`);
  if (!process.env.CLIENT_ID) {
    console.log('REST PUT skipped: CLIENT_ID is blank in .env (expected at prototype stage).');
  }
}
