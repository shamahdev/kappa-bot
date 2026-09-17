import { index, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Web account keyed by Discord user id (spec §4). Existing guild/channel/
 * subscription tables are untouched; `subscriptions.createdBy` becomes the
 * ownership key for guild-scope rows in web authz.
 */
export const users = pgTable('users', {
  discordId: text('discord_id').primaryKey(),
  username: text('username').notNull(),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const discordConnections = pgTable(
  'discord_connections',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.discordId, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('discord'),
    scopes: text('scopes').notNull().default('identify'),
    // User OAuth tokens (identify + guilds): needed to list the user's servers
    // on their behalf. Stored plain (read-only Discord scopes; same trust as
    // DATABASE_URL on the VPS). Null for pre-guilds logins → must re-login.
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('discord_connections_user_provider_uidx').on(t.userId, t.provider)],
);

/**
 * Opaque sessions: the cookie holds a random 32B token, only its sha256 is
 * stored here. 30d expiry, rolling is intentionally not implemented v1.
 */
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.discordId, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);
