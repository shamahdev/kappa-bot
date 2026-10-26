import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Web account keyed by Discord identity; subscription creator attribution is not an access grant. */
export const users = pgTable("users", {
  avatar: text("avatar"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  discordId: text("discord_id").primaryKey(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  username: text("username").notNull(),
});

export const discordConnections = pgTable(
  "discord_connections",
  {
    // User OAuth tokens (identify + guilds): needed to list the user's servers
    // on their behalf. Stored plain (read-only Discord scopes; same trust as
    // DATABASE_URL on the VPS). Null for pre-guilds logins → must re-login.
    accessToken: text("access_token"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: serial("id").primaryKey(),
    provider: text("provider").notNull().default("discord"),
    refreshToken: text("refresh_token"),
    scopes: text("scopes").notNull().default("identify"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.discordId, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("discord_connections_user_provider_uidx").on(
      t.userId,
      t.provider
    ),
  ]
);

/**
 * Opaque sessions: the cookie holds a random 32B token, only its sha256 is
 * stored here. 30d expiry, rolling is intentionally not implemented v1.
 */
export const sessions = pgTable(
  "sessions",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.discordId, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);
