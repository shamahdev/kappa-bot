import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  smallint,
  index,
  uniqueIndex,
  jsonb,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const guilds = pgTable('guilds', {
  id: text('id').primaryKey(), // Discord snowflake
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const channels = pgTable(
  'channels',
  {
    id: text('id').primaryKey(),
    guildId: text('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('channels_guild_idx').on(t.guildId)],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    keywords: text('keywords'),
    location: text('location'),
    geoId: text('geo_id'),
    distance: integer('distance'),
    filters: jsonb('filters').$type<Record<string, string>>().default({}).notNull(),
    source: text('source').notNull().default('linkedin'), // future sources re-add here without core changes
    isActive: boolean('is_active').notNull().default(true),
    retentionDays: integer('retention_days').notNull().default(30),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('subs_guild_channel_idx').on(t.guildId, t.channelId),
    index('subs_active_idx').on(t.isActive).where(sql`is_active = true`),
    index('subs_filters_gin').using('gin', t.filters),
  ],
);

export const seenJobs = pgTable(
  'seen_jobs',
  {
    id: serial('id').primaryKey(),
    subscriptionId: integer('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('linkedin'),
    externalId: text('external_id').notNull(), // LinkedIn jobPosting numeric id, or adapter id
    url: text('url').notNull(),
    snapshot: jsonb('snapshot').$type<{ title: string; company: string; location: string }>(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('seen_jobs_sub_src_ext_uidx').on(t.subscriptionId, t.source, t.externalId),
    index('seen_jobs_url_idx').on(t.url),
    index('seen_jobs_seen_at_idx').on(t.firstSeenAt),
  ],
);

export const botConfig = pgTable(
  'bot_config',
  {
    id: smallint('id').primaryKey(), // singleton: only row allowed (CHECK id=1)
    pollIntervalMinutes: integer('poll_interval_minutes').notNull().default(15),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [check('bot_config_id_check', sql`${t.id} = 1`)],
);
