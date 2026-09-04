Status: resolved
Type: grilling
Blocked by: 01, 04

## Question

Design the subscription data model on Neon: tables for guilds, channels, subscriptions, filters, and seen/delivered jobs. Decide primary keys, foreign keys, indexes, filter representation (JSONB vs normalized columns), dedup key (LinkedIn job ID / normalized URL), and retention/TTL for seen jobs. Account for LinkedIn's searchable fields discovered in `01` and Neon idioms from `04`. Output a DDL sketch (or Drizzle/Prisma schema snippet) plus one example subscription row per common use case.

## Answer

**Status: resolved — Decision: 5-table normalized, hybrid JSONB, per-subscription dedup, 30d TTL (all A).**

- **Topology (Q1 A):** `guilds` → `channels` → `subscriptions` → `seen_jobs` + `bot_config` singleton. `text` PKs for snowflakes, `serial` for subs/seen.
- **Filters (Q2 A):** `keywords`, `location`, `geo_id`, `distance` as columns + `filters jsonb` for remaining LinkedIn + future adapter fields; `GIN(filters)`.
- **Dedup (Q3 A):** `seen_jobs (subscription_id, source, external_id)` unique; `external_id` = LinkedIn numeric `urn:li:jobPosting:{id}`.
- **TTL (Q4 A):** `retention_days` per subscription, default 30, nightly `DELETE` cron.
- **Indexes/constraints (Q5 A):** as listed + `ON CONFLICT DO NOTHING`.

**Drizzle DDL sketch (`src/features/job-subscription/schema.ts`, re-exported via `src/db/schema.ts` per ADR-0002):**
```ts
import { pgTable, serial, text, integer, timestamp, boolean, smallint, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const guilds = pgTable('guilds', {
  id: text('id').primaryKey(), // Discord snowflake
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const channels = pgTable('channels', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [index('channels_guild_idx').on(t.guildId)]);

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  keywords: text('keywords'),
  location: text('location'),
  geoId: text('geo_id'),
  distance: integer('distance'),
  filters: jsonb('filters').$type<Record<string, string>>().default({}).notNull(),
  source: text('source').notNull().default('linkedin'), // linkedin|arbeitnow|...
  isActive: boolean('is_active').notNull().default(true),
  retentionDays: integer('retention_days').notNull().default(30),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index('subs_guild_channel_idx').on(t.guildId, t.channelId),
  index('subs_active_idx').on(t.isActive).where(sql`is_active = true`),
  index('subs_filters_gin').using('gin', t.filters),
]);

export const seenJobs = pgTable('seen_jobs', {
  id: serial('id').primaryKey(),
  subscriptionId: integer('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  source: text('source').notNull().default('linkedin'),
  externalId: text('external_id').notNull(), // 4456297886
  url: text('url').notNull(),
  snapshot: jsonb('snapshot').$type<{ title:string; company:string; location:string }>(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex('seen_jobs_sub_src_ext_uidx').on(t.subscriptionId, t.source, t.externalId),
  index('seen_jobs_url_idx').on(t.url),
  index('seen_jobs_seen_at_idx').on(t.firstSeenAt),
]);

export const botConfig = pgTable('bot_config', {
  id: smallint('id').primaryKey(), // enforce CHECK(id=1) via raw SQL migration + INSERT VALUES(1) ON CONFLICT DO NOTHING
  pollIntervalMinutes: integer('poll_interval_minutes').notNull().default(15),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// migration SQL adds: CHECK (id = 1)
```
**Raw SQL TTL cron (application, per ADR-0001):**
```sql
-- nightly via Elysia cron or pg_cron if enabled
DELETE FROM seen_jobs USING subscriptions
WHERE seen_jobs.subscription_id = subscriptions.id
  AND subscriptions.retention_days IS NOT NULL
  AND seen_jobs.first_seen_at < now() - (subscriptions.retention_days || ' days')::interval;
```

**Example rows:**

1. **BE junior daily, US, #jobs-usa** (`guild 123`, `channel 456`):
   `subscriptions{ id:1, guildId:'123', channelId:'456', keywords:'backend junior', location:'United States', geoId:'103644278', distance:null, filters:{f_TPR:'r86400', f_E:'2'}, source:'linkedin', isActive:true, retentionDays:30 }`
2. **Remote python, Berlin 25km, #remote-berlin** (`guild 123`, `channel 789`):
   `subscriptions{ id:2, keywords:'python', location:'Berlin', geoId:null, distance:25, filters:{f_WT:'2', f_TPR:'r604800'}, source:'linkedin' }`
3. **Arbeitnow fallback, devops, #jobs-eu** (`guild 123`, `channel 999`):
   `subscriptions{ id:3, keywords:'devops', location:'Germany', geoId:null, filters:{}, source:'arbeitnow' }` → dedup via `seen_jobs{ subscriptionId:3, source:'arbeitnow', externalId:'arbeitnow-12345' }`

**Insert-then-send pattern (per Q3):**
```ts
const inserted = await db.insert(seenJobs).values({ subscriptionId: sub.id, source: sub.source, externalId: job.id, url: job.url }).onConflictDoNothing().returning();
if (inserted.length) await channel.send(embedFor(job)); // only if inserted → not seen
```

Evidence: research-01 filter vocab + `urn:li:jobPosting` stable key, research-04 Drizzle/Neon patterns, ADR-0002 schema re-export, owner confirmation 2026-09-02 “Accept all A”. ADR `docs/adr/0003-subscription-data-model.md:1` records the tradeoff. Unblocks `08`, `09`, `10`.

## Resolution Comment

Claimed → resolved via grilling 2026-09-02. All five Qs answered A. ADR 0003 and this DDL are the resolution record.

