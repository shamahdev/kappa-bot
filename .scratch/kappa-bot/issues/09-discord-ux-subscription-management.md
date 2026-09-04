Status: resolved
Type: grilling
Blocked by: 07

## Question

Define the Discord UX for managing job subscriptions: slash command names and option schemas (`/jobs subscribe`, `/jobs list`, `/jobs unsubscribe`, `/jobs config`), permission gates (who may subscribe/configure), validation & error messages, and embed/notification format for delivered jobs (title, company, location, posted date, link, tags). Decide on ephemeral replies vs public confirmations and how subscription state is surfaced back to the user.

## Answer

**Status: resolved — Decision: `/jobs` umbrella subcommands, admin-only, ephemeral confirms, single rich embed no detail fetch (all A).**

- **Command surface (Q1 A):** One top-level `/jobs` with subcommands. discord.js v14:
  ```ts
  new SlashCommandBuilder()
    .setName('jobs')
    .setDescription('Manage job subscriptions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // Q3 A
    .addSubcommand(s => s.setName('subscribe').setDescription('Create a job subscription')
      .addStringOption(o => o.setName('source').setDescription('Job source').setRequired(true)
        .setAutocomplete(true).addChoices({name:'LinkedIn', value:'linkedin'}, {name:'Arbeitnow', value:'arbeitnow'}))
      .addStringOption(o => o.setName('keywords').setDescription('Search keywords').setRequired(true))
      .addStringOption(o => o.setName('location').setDescription('City/region (LinkedIn resolves to geoId)'))
      .addIntegerOption(o => o.setName('distance').setDescription('Radius (km/miles)').setMinValue(1).setMaxValue(100))
      .addChannelOption(o => o.setName('channel').setDescription('Text channel (default current)').addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('filters').setDescription('Advanced filters as JSON, e.g. {"f_TPR":"r86400","f_WT":"2"}'))
    )
    .addSubcommand(s => s.setName('list').setDescription('List active subscriptions')
      .addChannelOption(o => o.setName('channel').setDescription('Filter by channel')))
    .addSubcommand(s => s.setName('unsubscribe').setDescription('Remove a subscription by id')
      .addIntegerOption(o => o.setName('id').setDescription('Subscription id').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('config').setDescription('Bot/job config (retention, poll interval)')
      .addIntegerOption(o => o.setName('retention_days').setDescription('Seen-job retention (30 default)'))
      .addIntegerOption(o => o.setName('poll_interval_minutes').setDescription('Global poll interval (15 default)')));

  // /jobs config maps to bot_config singleton (ADR-0003), retention to subscription default
  ```

- **Subcommand semantics:**
  - `subscribe` → parse `filters` JSON, validate keys subset of research-01 vocab (`f_TPR/f_WT/f_E/f_JT/f_SB2/f_C/f_AL/f_EA/f_VJ`), upsert into `guilds/channels/subscriptions` (ADR-0003), resolve `location`→`geo_id` once (research-01 geoId pinning) when given.
  - `list` → `SELECT ... WHERE guild_id=$ AND channel_id=$` (optional) → ephemeral embed list of `id | source | keywords | location | active`.
  - `unsubscribe <id>` → autocomplete returns sub rows for the guild; delete cascade.
  - `config` → updates `bot_config` singleton (retention default, poll interval).
- **Permission (Q3 A):** `setDefaultMemberPermissions(ManageGuild)` at command level + belt-and-braces check in `execute` → ephemeral error embed `❌ You need Manage Guild permission` otherwise. MVP admin-only. `list`-for-non-admins (B) deferred until per-guild flag.
- **Reply strategy (Q4 A):** all management handlers `await interaction.deferReply({ ephemeral: true })`, then `editReply` with confirmation/summary embed. Only **delivered JobPostings** are public (via ADR-0003/0004 pipeline). No public ack embeds → no channel spam.
- **Job embed format (Q5 A — single rich embed, no detail fetch):**
  ```ts
  new EmbedBuilder()
    .setColor(guildAccent)               // fallback 0x2B4FFE
    .setTitle(`${job.position} @ ${job.company}`)
    .setURL(job.url)                     // stable jobs/view/...-{id}
    .setThumbnail(job.logo)
    .addFields({ name: 'Location', value: job.location, inline: true },
               { name: 'Posted', value: job.agoTime, inline: true })
    .addFields(...(job.salary ? [{ name: 'Salary', value: job.salary, inline: true }] : []))
    .setFooter({ text: `Kappa · ${sourceLabel}`, iconURL: undefined })
  ```
  No `/jobs-guest/jobs/api/jobPosting/{id}` enrichment (extra req/job budget risk, marginal card info). Click-through title link gives description.

- **Rejected:** multiple top-level commands (namespace pollution), public confirmations (noise), admin+list-anyone now (defer to flag), detail-fetch enrichment (budget, ADR research-02).

## Correction (found by prototype 10, 2026-09-04)

The `source` option above was sketched with both `.setAutocomplete(true)` and `.addChoices(...)` — discord.js throws `RangeError: Autocomplete and choices are mutually exclusive`. Fixed rule: `source` uses **choices only** (fixed 2-value enum); `autocomplete` is reserved for dynamic options (`unsubscribe id`). Prototype `register.ts` builds with choices-only and prints the registration JSON cleanly.

Evidence: research-01 embed field vocab + stable URL, research-02 rate-limit posture (no enrichment), ADR-0003/0004 storage+dedup, owner confirmation 2026-09-02 “Accept all A”. ADR `docs/adr/0005-discord-ux-subscription-management.md:1` records the tradeoff. Unblocks prototype `10`.

## Resolution Comment

Claimed → resolved via grilling 2026-09-02. All five Qs answered A. ADR 0005 and this command/embed sketch are the resolution record.

