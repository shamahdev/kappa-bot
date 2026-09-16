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
import type { JobPosting } from './types';

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
    pollIntervalMinutes: integer('poll_interval_minutes').notNull().default(30),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [check('bot_config_id_check', sql`${t.id} = 1`)],
);

/**
 * Last fetched listing per filter fingerprint (schedule.ts cross-tick skip).
 * When a cron tick fetches a listing identical to the stored hash with
 * unchanged group membership, the per-subscription collect/delivery is
 * skipped. Membership is stored so a new or reactivated subscription still
 * receives the current listing on its first tick instead of being skipped.
 */
export const fingerprintSnapshots = pgTable('fingerprint_snapshots', {
  fingerprint: text('fingerprint').primaryKey(), // 16-char filter key from schedule.ts
  source: text('source').notNull(),
  listingHash: text('listing_hash').notNull(), // sha1 over sorted source:id pairs
  jobCount: integer('job_count').notNull().default(0),
  subscriptionIds: jsonb('subscription_ids').$type<number[]>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Persisted delivery contents for reply-by-number. The in-memory map in
 * events/reply.ts is only an L1 cache: it is capped, wiped on restart, and
 * never shared with worker polls — without this table, replying to an old
 * delivery silently does nothing.
 */
export const deliveryMessages = pgTable(
  'delivery_messages',
  {
    messageId: text('message_id').primaryKey(), // bot delivery message id
    channelId: text('channel_id').notNull(),
    jobs: jsonb('jobs').$type<JobPosting[]>().notNull(), // display order (flattened, capped)
    keyword: text('keyword'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('delivery_messages_created_at_idx').on(t.createdAt)],
);
