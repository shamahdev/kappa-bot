Status: done
Type: research
Blocked by:

## Question

Research Neon Postgres patterns for a Discord bot's configuration store: serverless driver choices (Neon `serverless`/`@neondatabase/serverless` vs `pg` + pooling), connection pooling & branching, recommended ORM/query layer (Drizzle vs Prisma vs Kysely) for serverless/edge, migration story, and singleton config table patterns. Include minimal connection + migration example and note autosuspend/cold-start implications for a polling worker vs gateway process.

## Answer

**Research:** `.scratch/kappa-bot/research-04-neon-patterns.md` (2026-09-02, sources: Neon docs live fetches).

**Verdict — driver split by process:**
- **Gateway (`discord.js` long-lived):** `pg` (node-postgres) + **pooled** `DATABASE_URL` (`-pooler` host) via `drizzle-orm/node-postgres` with a single `Pool{max:10}` kept for the process. TCP reuse is ~40 ms vs HTTP ~120 ms p95, supports interactive txns and future `LISTEN/NOTIFY`. Avoid client double-pooling — PgBouncer handles it. ([choose-connection quick-ref](https://neon.com/docs/connect/choose-connection) + [serverless-driver HTTP vs WS](https://neon.com/docs/serverless/serverless-driver) + [pooling PgBouncer transaction mode](https://neon.com/docs/connect/connection-pooling))
- **Polling/delivery worker (cron 5–30 min, one-shot fan-out):** `@neondatabase/serverless` **HTTP** (`neon()` function) via `drizzle-orm/neon-http` on the pooled URL + `async-retry` (3×, `connect_timeout=15`). Stateless `fetch`-based, 3 round-trips vs 8 for TCP+TLS, tolerates scale-to-zero wakes; batch via `sql.transaction([...])` (non-interactive). **Edge (CF Workers/Vercel Edge):** same driver over WebSocket (`neon-serverless` + `ws` shim) for interactive txns. ([serverless-driver](https://neon.com/docs/serverless/serverless-driver) + [pooling](https://neon.com/docs/connect/connection-pooling))

**Pooling & branching:**
- Neon pools via PgBouncer `pool_mode=transaction` → `max_client_conn=10k`, `default_pool_size=0.9*max_connections` (0.25 CU=104 → 1 CU=419 → ≥9 CU=4000, 7 reserved), `query_wait_timeout=120s`. Pooled host has `-pooler`; **direct host (no `-pooler`) is mandatory for migrations/`pg_dump`/`SET`/`LISTEN`** — transaction mode rejects `SET/RESET`, `LISTEN/NOTIFY`, `WITH HOLD CURSOR`, SQL `PREPARE`, etc. Use `DATABASE_URL` (pooled, app) + `DATABASE_URL_UNPOOLED` (direct, Kit/CLI). ([pooling](https://neon.com/docs/connect/connection-pooling))
- Branch = copy-on-write clone (parent load 0, deltas only), instant API `POST /projects/{id}/branches {parent_id, expires_at (≤30d, RFC3339), init_source:schema-only}`, TTL auto-delete, `restore` within history window (Free 6 h, paid 1 d, up to 30 d on Scale). Pattern for kappa-bot: `main`=prod, per-PR preview branches + TTL 7 d to canary migrations. ([branching](https://neon.com/docs/introduction/branching) + [branching API](https://neon.com/docs/guides/branching-neon-api))

**ORM — Drizzle recommended:**
- **Drizzle** = 35 kB, no native binary/cold-start penalty, supports `pg`/`postgres.js`/`neon-http`/`neon-serverless`, schema in `pgTable`, `drizzle-kit generate`→`drizzle/*.sql` + `migrate`. ([drizzle guide](https://neon.com/docs/guides/drizzle) + [drizzle migrations](https://neon.com/docs/guides/drizzle-migrations))
- **Prisma** = `@prisma/adapter-neon` (`PrismaNeon`) via WS, pooled for app + direct via `prisma.config.ts` for CLI, `migrate dev`/`deploy`, but engine = ~5 MB + WASM → 200-800 ms cold-start. Avoid for edge/worker. ([prisma guide](https://neon.com/docs/guides/prisma) + [prisma migrations](https://neon.com/docs/guides/prisma-migrations))
- **Kysely** = `kysely-neon` `NeonDialect` (HTTP, no interactive txns) or WS `PostgresDialect`, builder-only with hand-written `interface Database` + `Migrator/FileMigrationProvider` — viable minimal alternative if ORM opinions unwanted. ([kysely guide](https://neon.com/docs/guides/kysely))

**Migration:** `drizzle.config.ts dialect:postgresql dbCredentials:{url: DATABASE_URL_UNPOOLED}` → `npx drizzle-kit generate` → `npx drizzle-kit migrate` (advisory lock `30000`, direct only) or programmatic `import {migrate} from 'drizzle-orm/neon-http/migrator'`. Always split URLs. Prismas analogue is `prisma migrate deploy` on direct URL. Kysely is manual `up`/`down` builder.

**Singleton config table:** `CREATE TABLE bot_config (id smallint PRIMARY KEY CHECK (id=1), poll_interval_minutes int NOT NULL DEFAULT 15, updated_at timestamptz DEFAULT now()); INSERT ... VALUES(1) ON CONFLICT DO NOTHING;` — read `WHERE id=1`, write via `UPDATE WHERE id=1 RETURNING *` or upsert. Alternatives: `jsonb` singleton or `VIEW current_config`. Avoid `LIMIT 1` without constraint. For kappa-bot, only truly global knobs belong here; per-guild/channel state stays in `subscriptions`/`seen_jobs` (see research §8.2 normalized schema).

**Autosuspend / cold-start:**
- Suspend after **5 min** idle (Free fixed; Launch can disable; Scale tunable 60 s–7 d), reactivation **~200-600 ms**, only for ≤16 CU, session context resets (temp tables/`SET`/prepared stmts). ([scale-to-zero](https://neon.com/docs/introduction/scale-to-zero) + [guide](https://neon.com/docs/guides/scale-to-zero-guide))
- **Polling worker:** cold wake is acceptable (1 wake per poll); handle with `?connect_timeout=15` + retry.
- **Gateway:** cold wake violates Discord's 3 s ACK; on paid plan **disable scale-to-zero** (Console Branches→Computes→Edit or `PATCH /endpoints/{id} {suspend_timeout_seconds:60}`); on Free add `setInterval('SELECT 1',4min).unref()` heartbeat to keep warm.

**Minimal wire (gateway + worker) + normalized schema** in research §8.2–§8.5 (pooled vs direct env, `guilds`/`channels`/`subscriptions`/`seen_jobs`/`bot_config`, `Pool` + `neon()` clients, `drizzle-kit generate/migrate`, branch TTL `curl` and gateway heartbeat).

Status: done.

