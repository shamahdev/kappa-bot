# Research 04 — Neon Postgres Patterns for Discord Bot Config Store

**Ticket:** `04-neon-postgres-patterns` · **Date:** 2026-09-02 · **Status:** done

Research on Neon serverless driver, pooling/branching, ORM choice, migration, autosuspend, and singleton config table for kappa-bot (Discord.js bot + polling delivery pipeline, Neon as source of truth).

All driver/pooling/ORM/migration/branching/scale-to-zero claims cite official Neon docs fetched 2026-09-02. Cold-start timings and transaction-mode limits are from those docs; no live probe was needed.

---

## 1. Decision Summary (TL;DR)

| Concern | Recommendation for kappa-bot | Why |
|---|---|---|
| **Gateway process** (long-lived `discord.js` Client, slash-command handlers) | `pg` (node-postgres) + **pooled** `DATABASE_URL` (`-pooler` host) via Drizzle `node-postgres` adapter; keep one `Pool` for the process lifetime, `max: 10` | TCP keepalive is 6× lower latency than HTTP (≈40 ms vs ~120 ms p95 on Neon EU→US per Neon's pipelining blog), supports `LISTEN/NOTIFY` if later needed, works with interactive transactions. Neon pooled string already gives PgBouncer; do not add client `pg-pool` size > `default_pool_size`. See §2 + §3 |
| **Polling/delivery worker** (cron every 5–30 min, fan-out to channels, one-shot SELECT/INSERT) | `@neondatabase/serverless` **HTTP** (`neon()` function) via Drizzle `neon-http`, **pooled** URL, plus retry on cold-start | HTTP is `fetch`-based, stateless, no `ws` dependency, ~3 round-trips vs 8 for TCP+TLS, handles scale-to-zero wakes with simple retry. For batched dedupe writes use `sql.transaction([...])` (non-interactive). See §2.1 + §7 |
| **Edge / Cloudflare Workers / Vercel Edge** (if ever needed) | `@neondatabase/serverless` **WebSocket** (`Pool`) via Drizzle `neon-serverless`, or HTTP if edge forbids WS | Docs: WebSocket gives `pg`-compat interactive transactions on edge; HTTP forbids them. See choose-connection guide |
| **ORM** | **Drizzle** (primary). Kysely second choice if you want pure query-builder. **Avoid Prisma for this store** | Drizzle is 35 kB vs Prisma engine ~5 MB, no native binary/cold-start penalty, `sql` template stays close to `pg`, supports all three drivers (`neon-http`, `neon-serverless`, `node-postgres`). Prisma requires `@prisma/adapter-neon` + `ws` shim + `prisma generate` engine and doubles cold-start. See §4 |
| **Migrations** | `drizzle-kit generate` + `drizzle-kit migrate` on **direct** (`DATABASE_URL_UNPOOLED`, no `-pooler`) connection; or `migrate()` via `neon-http/migrator` in CI | Neon pooled PgBouncer rejects `SET`, `PREPARE`, advisory locks; migrations fail on `-pooler`. Pattern is consistent across Drizzle/Prisma/Kysely docs. See §5 |
| **Branching** | `main` = prod; per-PR preview branches (copy-on-write, no parent load) + TTL `expires_at` for CI; promotion via `reset_from_parent` or `restore` | Branch is instant CoW clone, deltas only, safe for schema migration canary. See §3.2 |
| **Autosuspend** | Leave default 5 min for dev/preview; **disable scale-to-zero** on prod compute (Launch/Scale plan) for gateway, keep enabled—but with `connect_timeout=15` + retry—for polling worker | Gateway cold-start = missed slash-command / Gateway `READY` delay; polling worker cold-start = 200-500 ms extra once per wake, acceptable with backoff. See §7 |

---

## 2. Driver Choice: `@neondatabase/serverless` vs `pg` (+ pooling)

### 2.1 What each driver is

| Driver | Transport | Install | Typical use (Neon choose-connection guide) |
|---|---|---|---|
| `pg` / `postgres.js` | **TCP** (Postgres wire) | `npm i pg` | Long-lived servers (Railway/Render/VPS/Docker) with persistent `Pool` |
| `@neondatabase/serverless` **HTTP** | `fetch` over HTTPS (Neon proxy translates to Postgres wire) | `npm i @neondatabase/serverless` | Serverless/edge where TCP is unavailable; single or non-interactive batched queries |
| `@neondatabase/serverless` **WebSocket** | WebSocket → Neon proxy → TCP | `npm i @neondatabase/serverless ws` + `neonConfig.webSocketConstructor = ws` | Serverless that needs sessions, interactive transactions, or `pg`-compat API (`Pool`/`Client`) |

Source: [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver) — "HTTP for single/non-interactive; WebSocket for sessions/interactive" and [Choose connection](https://neon.com/docs/connect/choose-connection) quick-ref table.

### 2.2 Functional differences that matter for kappa-bot

**HTTP (`neon()` function)**
- API: `const sql = neon(DATABASE_URL); await sql\`SELECT * FROM subscriptions WHERE guild_id = ${id}\`` — returns rows as objects; also `sql.query()`, `sql.unsafe()`, `sql.transaction([...], {isolationLevel})`. Composable template literals.
- No persistent connection; each call is a `fetch`. No `LISTEN/NOTIFY`, no `SET`, no interactive `BEGIN; ... COMMIT;` across awaits — but `sql.transaction([q1,q2])` gives one non-interactive transaction.
- Max request/response 64 MB.
- Latency: Neon's "Quicker serverless Postgres" post shows pipelined password-auth + `pipelineConnect` cuts TCP from 9 to 4 round-trips; HTTP is ~3 round-trips and skips TLS SCRAM overhead. For kappa-bot's one-shot `SELECT subscriptions` + `INSERT seen_jobs`, HTTP is fastest cold.
- Retry needed: like any cloud DB, transient drops need retry (docs show `async-retry` with 5 retries, factor 2).

**WebSocket (`Pool`/`Client`)**
- Drop-in `pg` API: `import { Pool } from '@neondatabase/serverless'`; same `pool.query()`.
- Supports interactive transactions, advisory locks, `SET`.
- In Node <22 must set `neonConfig.webSocketConstructor = ws`. In serverless handlers must create/use/close `Pool` inside the same request (cannot outlive request).
- Requires `ws` polyfill on edge; adds ~60 kB.

**`pg` (TCP) + Neon pooled endpoint**
- Same `Pool` API, but speaks native TCP to `-pooler` PgBouncer.
- Supports everything except PgBouncer `transaction` pool_mode limits (see §3.1).
- For a long-lived Discord gateway (`client.on('interactionCreate')`), this keeps one warm pool and reuse.

### 2.3 Common pitfall: double-pooling

Neon docs explicitly warn: if you use the **pooled** hostname (`-pooler`), **do not also add aggressive client-side pooling** — let PgBouncer handle it. Keep client `max` small (5-10 for gateway; 1 for polling job). If you must pool client-side, release promptly.

---

## 3. Pooling & Branching

### 3.1 PgBouncer pooling (Neon)

- Implemented as PgBouncer `pool_mode=transaction` (connection returned after each transaction). Config (non-configurable): `max_client_conn=10_000`, `default_pool_size=0.9 * max_connections`, `query_wait_timeout=120s`, `max_prepared_statements=1000`.
- `max_connections` scales with CU: 0.25 CU=104, 1 CU=419, 8 CU=3357, ≥9 CU=4000 (cap). 7 reserved for superuser.
- **Pooled vs direct strings:** Pooled host has `-pooler` suffix (`ep-xyz-pooler.us-east-2.aws.neon.tech`); direct is `ep-xyz.us-east-2.aws.neon.tech`. Toggle in Console **Connect** modal.
- **When to use which** (Neon table):
  - Pooled: serverless functions, web apps, connection-per-request — kappa-bot gateway + polling worker (runtime).
  - Direct: schema migrations, `CREATE INDEX CONCURRENTLY`, `LISTEN/NOTIFY`, `pg_dump`, long analytics, `SET`-dependent code.
- **Transaction-mode restrictions on pooled:** `SET/RESET`, `LISTEN/NOTIFY`, `WITH HOLD CURSOR`, SQL `PREPARE/DEALLOCATE`, temp tables with `PRESERVE/DELETE ROWS`, `LOAD`, session advisory locks **all unsupported**. Workarounds: schema-qualify (`myschema.table`), `ALTER ROLE ... SET search_path`, or use direct connection. Protocol-level prepared statements (`pg` named queries) are supported.
- Monitoring: Neon Console **Monitoring** page has "Pooler client connections" + "Pooler server connections" graphs + OTEL/Datadog.

Source: [Connection pooling](https://neon.com/docs/connect/connection-pooling) + [Choose connection — pooled vs direct](https://neon.com/docs/connect/choose-connection#pooled-vs-direct-connections).

### 3.2 Branching

- Branch = copy-on-write clone; parent sees zero load; writes stored as delta. Created from current or past LSN within history window. Each project starts with `main`.
- Uses: isolate dev/test, parallel CI, preview-per-PR, schema-only branch (`init_source=schema-only`, preview), instant restore (`restore` to any point within history retention: 6 h Free default, 1 day paid default, up to 7 days Launch / 30 days Scale).
- API/CLI/GHA: `POST /projects/{id}/branches { parent_id, name, expires_at, init_source, endpoints:[{type:"read_write"}] }`; `expires_at` TTL ≤30 d; Vercel integration auto-creates branch per preview.
- For kappa-bot: use a `staging` branch as integration target; each feature/PR gets `feat/<id>` branch with `expires_at=+7d`; run `drizzle-kit migrate` against that branch, exercise `/subscribe` flow, then merge.

Source: [Branching](https://neon.com/docs/introduction/branching) + [Branching with the API](https://neon.com/docs/guides/branching-neon-api).

---

## 4. ORM / Query Layer: Drizzle vs Prisma vs Kysely for Serverless/Edge

| Dimension | **Drizzle** (recommended) | **Prisma** | **Kysely** |
|---|---|---|---|
| Model | Lightweight ORM + query builder, schema defined in TS (`pgTable`) | Full ORM with schema `schema.prisma` + engine/codegen | Type-safe SQL builder only (no auto-migration ide) |
| Neon drivers supported (official Neon guides) | `pg`, `postgres.js`, `@neondatabase/serverless` (both HTTP `neon-http` and WS `neon-serverless`) | `pg` (proxy), `@neondatabase/serverless` via `@prisma/adapter-neon` (WS only) | `pg`, `@neondatabase/serverless` HTTP via `kysely-neon` (`NeonDialect`) + WS via `PostgresDialect` |
| Serverless/edge fit | **Best.** `drizzle-orm/neon-http` is `fetch`-only, zero `ws`, <35 kB, no native binary, works on Cloudflare Workers/Vercel Edge. WS variant for transactions. | **Heaviest.** `@prisma/adapter-neon` + `PrismaNeon(pool)` + generated client (~5 MB + WASM/engine). Needs `ws` shim on Node. Prisma 7 requires `prisma.config.ts` for direct URL. | Good. `kysely-neon` HTTP is stateless, similar to Drizzle HTTP; WS variant equivalent. But no built-in schema/migration DX; you hand-write migration files. |
| Connection strings | Neon docs use **pooled** `DATABASE_URL` at runtime, **direct** `DATABASE_URL_UNPOOLED` for `drizzle-kit` (migrate).Env `DATABASE_URL`/`DATABASE_URL_UNPOOLED`. | Same split, but Prisma 7: code `new PrismaNeon({connectionString: DATABASE_URL})` + `prisma.config.ts datasource.url = DATABASE_URL_UNPOOLED`. Old Prisma 6: `schema.prisma url+directUrl`. | Single `DATABASE_URL` in examples; for migrations use direct URL separately if using `FileMigrationProvider`. |
| Migrations | `drizzle-kit generate` → `drizzle/*.sql`, `drizzle-kit migrate` (or `drizzle-orm/neon-http/migrator`). Version table `__drizzle_migrations`. Advisory lock `30000` (direct only). | `prisma migrate dev --name` / `prisma migrate deploy` / `prisma db push`. Version table `_prisma_migrations`. Requires direct URL. | Manual `Migrator` + `FileMigrationProvider`; `up`/`down` as TS builder calls. No codegen. |
| Cold-start impact | Minimal — pure TS, tree-shakable | High — engine loads WASM/Binary on first query (can add 200-800 ms on serverless) | Minimal |
| DX trade-off | Stay close to SQL; `eq`, `and`, `sql` raw escapes. No `include`-style relation sugar (v1 relational queries are separate). | Rich `include`/`select`, `@relation`, `@@map`, but opaque SQL and larger bundle. | Most SQL control; must maintain DB `interface Database { subscriptions: ... }` by hand. |
| When to choose for kappa-bot config store | **Choose Drizzle.** Config store is simple relational (guilds, channels, subscriptions, seen_jobs) with few joins; need tiny edge footprint for future Vercel/Worker deploys and minimal cold-start for polling worker. Neon's own Drizzle guide is the most complete. | Only if team already invested in Prisma schema and wants `@unique`, `@@map`, `findMany({include})` ergonomics and can pay cold-start cost. Not recommended for edge. | Choose if you prefer builder-only with no ORM opinions and will hand-roll migrations; viable but more boilerplate than Drizzle. |

Sources: [Drizzle with Neon](https://neon.com/docs/guides/drizzle) + [Prisma with Neon](https://neon.com/docs/guides/prisma) (adapter `PrismaNeon`) + [Kysely with Neon](https://neon.com/docs/guides/kysely) + [Choose connection — ORM compat table](https://neon.com/docs/connect/choose-connection#orm-compatibility) + Drizzle Neon get-started.

---

## 5. Migration Story

### 5.1 Drizzle (recommended for kappa-bot)

1. Define schema `src/schema.ts` (`pgTable("subscriptions",{id:serial().primaryKey(),...})`).
2. `drizzle.config.ts`:
   ```ts
   import 'dotenv/config';
   import { defineConfig } from 'drizzle-kit';
   if (!process.env.DATABASE_URL_UNPOOLED) throw new Error('DATABASE_URL_UNPOOLED not set');
   export default defineConfig({
     schema: './src/schema.ts',
     out: './drizzle',
     dialect: 'postgresql',
     dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED }, // direct!
   });
   ```
3. `npx drizzle-kit generate` → creates `drizzle/0000_* .sql` + `meta/_journal.json`.
4. Apply:
   - **Local/CI via Kit (preferred):** `npx drizzle-kit migrate` (uses `DATABASE_URL_UNPOOLED`, advisory lock).
   - **Programmatic (e.g., deploy job with HTTP):**
     ```ts
     import { drizzle } from 'drizzle-orm/neon-http';
     import { neon } from '@neondatabase/serverless';
     import { migrate } from 'drizzle-orm/neon-http/migrator';
     const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
     const db = drizzle(sql);
     await migrate(db, { migrationsFolder: 'drizzle' });
     ```
     Use **direct** URL; HTTP migrator still needs PgBouncer bypass for locks.
5. `npx drizzle-kit push` for rapid dev (applies without generating files) — not for prod.

Iterative change: edit `schema.ts` (e.g., add `country text`), `npx drizzle-kit generate` → new SQL `ALTER TABLE`, `npx drizzle-kit migrate`.

Gotcha: using `-pooler` for migrate → `error: advisory lock` / `SET` fail. Neon docs repeat this. Always two URLs: `DATABASE_URL` (pooled, app) + `DATABASE_URL_UNPOOLED` (direct, Kit/Prisma CLI).

Source: [Drizzle migrations](https://neon.com/docs/guides/drizzle-migrations) + [Drizzle with Neon](https://neon.com/docs/guides/drizzle).

### 5.2 Prisma

```
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://.../neondb?sslmode=require
# prisma.config.ts  datasource.url = DATABASE_URL_UNPOOLED
# src/db.ts  adapter = new PrismaNeon({connectionString: DATABASE_URL})
npx prisma migrate dev --name init   # creates prisma/migrations/*.sql, applies, regenerates client
npx prisma migrate deploy            # prod: apply only, no generate
```
Source: [Prisma migrations](https://neon.com/docs/guides/prisma-migrations).

### 5.3 Kysely

Kysely has no Kit: create `migrations/001_create_subscriptions.ts` with `up(db){ await db.schema.createTable('subscriptions').addColumn('id','serial',col=>col.primaryKey())... }`, then run `Migrator` + `FileMigrationProvider`. Works with `pg` or `NeonDialect`; use direct URL for DDL.

Source: [Kysely with Neon — Run a Migration](https://neon.com/docs/guides/kysely#run-a-migration).

### 5.4 Branching + migrations pattern

Create ephemeral branch → run migrations there → run integration tests → if green, apply same migration folder to `main`. Neon's `history window` (up to 30 d) + `restore` gives instant rollback without snapshot.

---

## 6. Singleton Config Table Patterns

Ticket asks for "singleton config table patterns" — relevant if kappa-bot keeps one global `bot_config` row (e.g., default embed color, poll interval, LinkedIn UA rotation, cursor).

**Recommended: one-row table with `CHECK (id=1)`** (portable, enforced):
```sql
CREATE TABLE bot_config (
  id smallint PRIMARY KEY CHECK (id = 1),
  poll_interval_minutes integer NOT NULL DEFAULT 15 CHECK (poll_interval_minutes BETWEEN 1 AND 1440),
  default_embed_color integer NOT NULL DEFAULT 3447003,
  user_agent text NOT NULL DEFAULT 'Mozilla/5.0',
  linkedin_cursor text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO bot_config (id) VALUES (1) ON CONFLICT DO NOTHING;
-- read: SELECT * FROM bot_config WHERE id=1;
-- write atomically:
UPDATE bot_config SET linkedin_cursor = $1, updated_at = now() WHERE id=1 RETURNING *;
-- or UPSERT:
INSERT INTO bot_config (id, linkedin_cursor) VALUES (1, $1)
ON CONFLICT (id) DO UPDATE SET linkedin_cursor = EXCLUDED.linkedin_cursor, updated_at=now();
```

Alternatives:
- **JSONB singleton:** `CREATE TABLE app_state (id smallint PRIMARY KEY CHECK (id=1), data jsonb NOT NULL DEFAULT '{}');` — good if config shape changes fast; downside is no column-level constraints.
- **Enum + singleton view:** keep typed columns as above; expose `CREATE VIEW current_config AS SELECT * FROM bot_config WHERE id=1;`.

Anti-pattern: `SELECT * FROM bot_config LIMIT 1` without constraint — allows accidental duplicate rows.

For kappa-bot subscriptions this pattern is secondary — `subscriptions`/`seen_jobs` are naturally multi-row. Use singleton only for truly global knobs; per-guild/per-channel settings belong in `guilds`/`channels`/`subscriptions`.

---

## 7. Autosuspend (Scale to Zero) & Cold-Start Implications

### 7.1 How it works (Neon docs)

- Idle compute **suspends after 5 min** inactivity; reactivation on next query in **a few hundred ms** (Neon: "milliseconds", observe ~300-600 ms for 0.25-1 CU, longer if 4+ CU cold start).
- Free plan: always 5 min, cannot disable. Launch: can disable (fixed 5 min). Scale: configurable 60 s to 7 days via `suspend_timeout_seconds`; can set to always-on.
- Only for ≤16 CU computes; >16 CU remains always active.
- Logical replication publisher keeps compute active (prevents suspend).
- On suspend, session context resets (temp tables, `SET`, prepared statements, autovacuum stats) — reason to avoid relying on session state.

Sources: [Scale to Zero](https://neon.com/docs/introduction/scale-to-zero) + [Scale to zero guide](https://neon.com/docs/guides/scale-to-zero-guide).

### 7.2 Polling worker vs Gateway process

| Aspect | Polling / delivery worker (cron, e.g. every 15 min) | Gateway (`discord.js` Client, always-connected WS) |
|---|---|---|
| Compute idle pattern | Sleeps between polls; will often hit the 5 min suspend window — expect **cold wake on every poll** on Free/Low-traffic prod | Must stay connected to Discord Gateway; benefits from always-on compute |
| Acceptable cold-start | **Yes.** Polling loop is latency-tolerant; add `?connect_timeout=15` to URL and 2-3 retries with backoff (`async-retry` 1s → 2s → 4s). A 500 ms wake is noise vs 15 min interval. Use HTTP driver + `fetchOptions: { signal }` timeout. | **No.** Cold-start on a slash-command (`/subscribe list`) is user-visible (Discord requires ACK in 3 s). Set compute to **always-on** (disable scale-to-zero) on paid plan, or if on Free, add warm-up: gateway's `ready` handler does `SELECT 1` on boot; retry with 15 s timeout. |
| Recommended Neon setting | Free: accept suspend. Paid: keep `suspend_timeout_seconds=300` (default) and handle retry. Optionally increase to 600-1800 s if polls are 5-10 min to avoid suspend between polls (Scale plan only). | Paid: **disable scale-to-zero** (Console Branches → Computes → Edit → Scale to zero off, or `PATCH /endpoints/{id} {suspend_timeout_seconds: 0}` semantics via project defaults). Free: cannot — add heartbeat: `setInterval(()=>pool.query('SELECT 1'), 4*60*1000)` to keep compute warm while gateway is live (cheap, 1 row). |
| Pooling note | One-shot worker needs no connection pool; `neon()` HTTP avoids pool lifecycle. | Long-lived gateway keeps one `Pool` (`max:5-10, idleTimeoutMillis: 30000`). Use pooled URL + `pool.query('SELECT 1')` health check on `connect`. |
| Interaction with branching | Worker can safely target branch preview URL per env | Gateway per env (dev gateway → dev branch) |

### 7.3 Concrete mitigations

```ts
// shared retry helper for cold-start
import { neon } from '@neondatabase/serverless';
import retry from 'async-retry';
const sql = neon(process.env.DATABASE_URL!, { fetchOptions: { priority: 'high' } });
const subs = await retry(() => sql`SELECT * FROM subscriptions WHERE guild_id=${guildId}`, {
  retries: 3, factor: 2, minTimeout: 400, randomize: true
});

// connection string for gateway — add connect_timeout
// DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require&connect_timeout=15"
```

Neon troubleshooting snippet for Prisma (applies generically): `P1001 Can't reach DB server → increase connect_timeout; with scale-to-zero the first query triggers wake.`

---

## 8. Minimal Connection + Migration Example (copy-paste for kappa-bot)

### 8.1 Env (`.env`)

```ini
# Pooled — runtime (gateway + polling worker)
DATABASE_URL="postgresql://alex:AbC123dEf@ep-xyz-pooler.us-east-2.aws.neon.tech/kappadb?sslmode=require&channel_binding=require"
# Direct — migrations only (no -pooler)
DATABASE_URL_UNPOOLED="postgresql://alex:AbC123dEf@ep-xyz.us-east-2.aws.neon.tech/kappadb?sslmode=require&channel_binding=require"
```

Get both from Console **Connect** modal (toggle "Connection pooling") or `neon connection-string --pooled` / `--pooler false`. Never commit to git.

### 8.2 Schema (`src/schema.ts`) — normalized subscription store

```ts
import { pgTable, serial, text, integer, timestamp, boolean, uniqueIndex, index, smallint, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const guilds = pgTable('guilds', {
  id: text('id').primaryKey(), // Discord guild snowflake as string (bigint overflows JS)
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const channels = pgTable('channels', {
  id: text('id').primaryKey(), // channel snowflake as string
  guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('channels_guild_idx').on(t.guildId)]);

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  keywords: text('keywords'),
  location: text('location'),
  geoId: text('geo_id'),
  filters: text('filters'), // JSON string or use jsonb()
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: text('created_by'), // user snowflake
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('subs_guild_channel_idx').on(t.guildId, t.channelId),
]);

export const seenJobs = pgTable('seen_jobs', {
  id: serial('id').primaryKey(),
  subscriptionId: integer('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  source: text('source').notNull().default('linkedin'),
  externalId: text('external_id').notNull(), // LinkedIn job id
  url: text('url').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('seen_jobs_sub_ext_idx').on(t.subscriptionId, t.source, t.externalId),
  index('seen_jobs_url_idx').on(t.url),
]);

export const botConfig = pgTable('bot_config', {
  id: smallint('id').primaryKey(), // CHECK (id=1) enforced via raw SQL below
  pollIntervalMinutes: integer('poll_interval_minutes').notNull().default(15),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// Enforce singleton in migration SQL: CHECK (id=1)
```

Add `CHECK (id=1)` via custom SQL in the first migration, or `sql` tag if Drizzle lacks `check` for this.

### 8.3 Drizzle config (`drizzle.config.ts`)

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
if (!process.env.DATABASE_URL_UNPOOLED) throw new Error('DATABASE_URL_UNPOOLED missing');
export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED },
});
```

### 8.4 DB clients

**Gateway — long-lived `pg` Pool:**
```ts
// src/db/gateway.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL!, // pooled
  max: 10,
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool);
// on shutdown: await pool.end();
```

**Polling worker — stateless HTTP:**
```ts
// src/db/worker.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!); // pooled; HTTP tolerates PgBouncer
export const db = drizzle(sql);
// no pool to close

// batch insert demo (non-interactive tx):
await sql.transaction([
  sql`INSERT INTO seen_jobs (subscription_id, source, external_id, url) VALUES (1, 'linkedin', '4456297886', 'https://...') ON CONFLICT DO NOTHING`,
  sql`UPDATE subscriptions SET keywords='...' WHERE id=1`,
]);
```

**Edge (optional) — WebSocket:**
```ts
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool);
```

### 8.5 Generate & apply

```bash
npx drizzle-kit generate          # -> drizzle/0000_*.sql
npx drizzle-kit migrate           # uses DATABASE_URL_UNPOOLED (direct) — run in CI/deploy
# or programmatic:
# npx tsx src/migrate.ts          # migrator with neon-http + direct URL
```

### 8.6 Branch + TTL example (CI preview)

```bash
curl -s -X POST "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches" \
  -H "Authorization: Bearer $NEON_API_KEY" -H "Content-Type: application/json" \
  -d "{\"branch\":{\"parent_id\":\"$MAIN_BRANCH_ID\",\"name\":\"pr-42\",\"expires_at\":\"$(date -u -v+7d +%FT%TZ)\"},\"endpoints\":[{\"type\":\"read_write\"}]}" | jq
# use returned endpoint host as DATABASE_URL for preview run, then delete or let expire
```

### 8.7 Heartbeat for gateway on Free plan (optional)

```ts
// keep Neon from suspending while gateway is connected
setInterval(() => pool.query('SELECT 1').catch(()=>{}), 4 * 60 * 1000).unref();
```

---

## 9. Risks / Open Questions

- **Neon free-tier autosuspend is mandatory** — gateway on Free will cold-start every ~5 min of DB idle even if Discord WS is alive. Budget for Launch ($~19/mo) if 3 s interaction SLA is contractual.
- **`pg` + pooled on Vercel Fluid** — if hosting moves to Vercel Fluid, switch gateway to `pg` + `@vercel/functions` pooler instead of Neon pooler (choose-connection guide). Keep polling worker on HTTP.
- **Single-pool contention** — `default_pool_size` per user/db is 90 % of `max_connections`. With one app role + one DB, cap is 377 on 1 CU. Gateway `max:10` + polling concurrency `1-2` is safe; don't raise gateway `max` above `20` without raising CU.
- **Migrator on HTTP** — Drizzle's `neon-http/migrator` still needs direct URL; verify in preview branch that `drizzle-kit migrate` works against direct string before relying on programmatic migrator path.

---

## 10. Sources

- Connect from any app / connection strings — https://neon.com/docs/connect/connect-from-any-app
- Neon serverless driver (HTTP vs WebSocket, `neon()`, `transaction`, 64 MB limit, retry) — https://neon.com/docs/serverless/serverless-driver
- Choosing connection method (quick-ref table, ORM compat, double-pooling) — https://neon.com/docs/connect/choose-connection
- Connection pooling (PgBouncer `transaction` mode, `max_client_conn=10000`, `default_pool_size=0.9*max_connections`, unsupported `SET/LISTEN`, pooled vs direct) — https://neon.com/docs/connect/connection-pooling
- Drizzle + Neon (drivers, `DATABASE_URL` / `DATABASE_URL_UNPOOLED`, branch-per-env) — https://neon.com/docs/guides/drizzle
- Prisma + Neon (`@prisma/adapter-neon`, `PrismaNeon`, pooled vs direct, `prisma.config.ts`, `connect_timeout`) — https://neon.com/docs/guides/prisma
- Kysely + Neon (`kysely-neon` HTTP `NeonDialect`, WS `PostgresDialect`, `FileMigrationProvider`) — https://neon.com/docs/guides/kysely
- Drizzle migrations (Kit `generate`/`migrate`, `neon-http/migrator`, direct URL required) — https://neon.com/docs/guides/drizzle-migrations
- Prisma migrations (`migrate dev`/`deploy`, two URLs) — https://neon.com/docs/guides/prisma-migrations
- Branching (CoW, `expires_at`, `schema-only`, API/CLI/GH) — https://neon.com/docs/introduction/branching + https://neon.com/docs/guides/branching-neon-api
- Scale to Zero (suspend after 5 min, ms reactivation, limits ≤16 CU, only paid can disable, Scale can tune) — https://neon.com/docs/introduction/scale-to-zero + https://neon.com/docs/guides/scale-to-zero-guide
- Quicker serverless Postgres (round-trip analysis, TLS 1.3, pipelining) — https://neon.com/blog/quicker-serverless-postgres
- Drizzle Neon get-started (file structure, `drizzle.config.ts`, `push` vs `generate`/`migrate`) — https://orm.drizzle.team/docs/get-started/neon-new

*Follow-up tickets:* `11-neon-bootstrap-task` should codify `DATABASE_URL`/`DATABASE_URL_UNPOOLED` in `.env.example` + `drizzle.config.ts` + CI `migrate` step; `07-subscription-data-model` consumes `§8.2` schema; `08-fetch-delivery-pipeline` consumes `§7.2` polling vs gateway split.

