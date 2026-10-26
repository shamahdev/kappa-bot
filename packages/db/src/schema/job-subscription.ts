import type { JobPosting } from "@kappa/contracts";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const guilds = pgTable("guilds", {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Server ID or legacy personal scope key.
  id: text("id").primaryKey(),
  name: text("name"),
});

export const channels = pgTable(
  "channels",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
  },
  (t) => [index("channels_guild_idx").on(t.guildId)]
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: text("created_by"),
    distance: integer("distance"),
    filters: jsonb("filters")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    geoId: text("geo_id"),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    id: serial("id").primaryKey(),
    isActive: boolean("is_active").notNull().default(true),
    keywords: text("keywords"),
    location: text("location"),
    retentionDays: integer("retention_days").notNull().default(14),
    source: text("source").notNull().default("linkedin"),
  },
  (t) => [
    index("subs_guild_channel_idx").on(t.guildId, t.channelId),
    index("subs_active_idx")
      .on(t.isActive)
      .where(sql`is_active = true`),
    index("subs_filters_gin").using("gin", t.filters),
  ]
);

/**
 * One row per real posting, deduped by (source, external_id) across all
 * subscriptions and keywords. Holds the shared listing data plus the cached
 * AI summary (computed once per posting, reused by every card render).
 * Per-subscriber data (dedup, match score) stays on seen_jobs. Rows with no
 * seen_jobs reference are pruned by the service's retention pass.
 */
export const jobs = pgTable(
  "jobs",
  {
    aiSummary: text("ai_summary"),
    company: text("company"),
    externalId: text("external_id").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: serial("id").primaryKey(),
    location: text("location"),
    source: text("source").notNull(),
    title: text("title"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    url: text("url").notNull(),
  },
  (t) => [uniqueIndex("jobs_src_ext_uidx").on(t.source, t.externalId)]
);

export const seenJobs = pgTable(
  "seen_jobs",
  {
    // LinkedIn jobPosting numeric id, or adapter id
    externalId: text("external_id").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: serial("id").primaryKey(),
    // Shared posting row (nullable: legacy rows are backfilled, but a failed
    // jobs upsert must never block delivery, so collection tolerates null).
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    matchReason: text("match_reason"),
    // Personal-only AI match against the subscriber's CV (DM scope only;
    // guild rows stay NULL). Written when a DM card is scored.
    matchScore: smallint("match_score"),
    snapshot: jsonb("snapshot").$type<{
      title: string;
      company: string;
      location: string;
    }>(),
    source: text("source").notNull().default("linkedin"),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
  },
  (t) => [
    uniqueIndex("seen_jobs_sub_src_ext_uidx").on(
      t.subscriptionId,
      t.source,
      t.externalId
    ),
    index("seen_jobs_url_idx").on(t.url),
    index("seen_jobs_seen_at_idx").on(t.firstSeenAt),
    index("seen_jobs_job_idx").on(t.jobId),
  ]
);

/**
 * One CV per Discord user for AI match scores. Personal-only: DM-scope
 * deliveries read this, guild-scope deliveries never do. Keyed by Discord
 * user id with NO users FK — Discord-only users have no users row. Deleted
 * explicitly on account delete.
 */
export const cvProfiles = pgTable("cv_profiles", {
  discordId: text("discord_id").primaryKey(),
  filename: text("filename"),
  text: text("text").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const botConfig = pgTable(
  "bot_config",
  {
    // Singleton: only row allowed (CHECK id=1).
    id: smallint("id").primaryKey(),
    pollIntervalMinutes: integer("poll_interval_minutes").notNull().default(30),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [check("bot_config_id_check", sql`${t.id} = 1`)]
);

/**
 * Last fetched listing per filter fingerprint for cross-tick skipping.
 * When a cron tick fetches a listing identical to the stored hash with
 * unchanged group membership, the per-subscription collect/delivery is
 * skipped. Membership is stored so a new or reactivated subscription still
 * receives the current listing on its first tick instead of being skipped.
 */
export const fingerprintSnapshots = pgTable("fingerprint_snapshots", {
  // Poller's filter key.
  fingerprint: text("fingerprint").primaryKey(),
  jobCount: integer("job_count").notNull().default(0),
  // sha1 over sorted source:id pairs
  listingHash: text("listing_hash").notNull(),
  source: text("source").notNull(),
  subscriptionIds: jsonb("subscription_ids")
    .$type<number[]>()
    .notNull()
    .default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Exact per-message display order for reply-by-number, shared across processes. */
export const deliveryMessages = pgTable(
  "delivery_messages",
  {
    channelId: text("channel_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Exact display order for this message.
    jobs: jsonb("jobs").$type<JobPosting[]>().notNull(),
    keyword: text("keyword"),
    // Bot delivery message id.
    messageId: text("message_id").primaryKey(),
  },
  (t) => [index("delivery_messages_created_at_idx").on(t.createdAt)]
);
