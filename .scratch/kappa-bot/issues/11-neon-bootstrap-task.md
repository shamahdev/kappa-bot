Status: resolved
Type: task
Blocked by: 04, 07

## Question

Provision/verify the Neon project for kappa-bot: create (or reuse) Neon project, capture connection strings (pooled vs direct), verify connectivity from local with the chosen driver/ORM (`04` + `07` schema), run a sample migration, and record credentials location (env names, `.env.example`, Vercel/secret manager if used). This unblocks the prototype and build tickets; do not build features here — just make the DB reachable and migration-ready.

## Answer

**Status: resolved — Neon project linked, migration applied, connectivity verified (2026-09-04).**

### AFK portion — DONE (agent, offline, verified)

Migration-ready DB layer scaffolded in-repo exactly per ADR-0001/0003/research-04. No secrets required; `drizzle-kit generate` proven to emit SQL offline:

| Artifact | Path | Purpose |
|---|---|---|
| `package.json` | `/Users/airmasperkasa/Documents/Codes/kappa-bot/package.json` | Bun project, `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10` (bumped from 0.24/0.34: 0.24 failed to generate silently on Bun; 0.45/0.31 generated cleanly), `pg`, `@neondatabase/serverless`, TS 5.5 |
| `tsconfig.json` | `…/tsconfig.json` | `ESNext`/`bundler`/`strict`, `bun-types`, `noEmit` |
| `drizzle.config.ts` | `…/drizzle.config.ts` | schema `src/db/schema.ts` → `./drizzle`; `dbCredentials.url` from `DATABASE_URL_UNPOOLED` only when present (generate offline, migrate needs direct URL) |
| `.env.example` | `…/.env.example` | `DISCORD_TOKEN, CLIENT_ID, GUILD_ID, DATABASE_URL, DATABASE_URL_UNPOOLED, PORT, LOG_LEVEL, BOT_ROLE, REPLICAS` — matches ADR-0006 |
| `.gitignore` | `…/.gitignore` | ignores `.env*` (keeps `.env.example`) |
| Schema | `…/src/features/job-subscription/schema.ts` | 5 tables verbatim from ADR-0003 (guilds/channels/subscriptions/seen_jobs/bot_config), GIN + partial + unique indexes, cascading FKs, `CHECK(id=1)` |
| Schema re-export | `…/src/db/schema.ts` | `export * from '../features/job-subscription/schema'` per ADR-0002 |
| Migration | `…/drizzle/0000_slow_santa_claus.sql` | generated SQL — verified matches ADR-0003 (5 tables, dedup unique, GIN, partial active, cascade, singleton check) |

**Proof:** `bunx drizzle-kit generate` → `5 tables … [✓] Your SQL migration file drizzle/0000_slow_santa_claus.sql`; `bun run typecheck` → exit 0. `bun.lockb` written; deps installed.

### HITL portion — DONE (owner supplied project + bot token, 2026-09-04)

Owner provided: Neon project `young-sunset-25304132` (branch `production`) + setup steps, and the Discord bot token. Agent executed all 7 setup steps; no secret values are recorded here (all live in gitignored `.env`/`.env.local` only):

1. `npm i -g neon@latest` → CLI `4.14.1`; `neon me` authenticated as owner account (OAuth completed).
2. `neon skills -y` → 7 skills installed for opencode (neon, neon-ai-gateway, neon-functions, neon-object-storage, neon-postgres, neon-postgres-branches, neon-postgres-egress-optimizer); wrote `.agents/` + `skills-lock.json`. (First attempt hung with no output; retry after link succeeded.)
3. `neon mcp -y` → MCP server installed for all detected agents (incl. opencode); minted `neon-cli-mcp-*` API key stored in agent MCP configs (revocable via `neon api-keys revoke 3309903`).
4. `neon link --project-id young-sunset-25304132 --branch production -y` → wrote `.neon` (`org-crimson-lake-83734798` / project / `production`) and pulled `DATABASE_URL` (pooled, `-pooler` host ✓), `DATABASE_URL_UNPOOLED` (direct ✓), `NEON_BRANCH` into `.env.local`.
5. `neon config init` → scaffolded `neon.ts` starter policy; installed `@neon/config@1.3.0` + `@neon/env@1.2.1` (package.json/bun.lock updated).
6. `neon.ts` simplified to `export default defineConfig({});` per owner instruction (dropped starter's 7d TTL on new branches — re-add if ADR-0006 preview-branch TTL is wanted).
7. `neon deploy` → "No changes — branch production already matches the policy"; refreshed the 3 Neon vars into `.env` (merge preserved all existing keys).

**Credentials (locations only, never values):** Discord bot token + both Neon URLs live in `.env` (gitignored); Neon-managed copy of DB URLs in `.env.local` (gitignored); `.env.example` is the empty template. Verified via filenames-only grep: bot token appears solely in `.env`; connection hosts appear solely in `.env`/`.env.local` (other matches are doc comments). `.gitignore` covers `.env`, `.env.*`, `node_modules/`, `.neon`. No git repo yet — nothing committed. `CLIENT_ID`/`GUILD_ID` still blank in `.env` (needed later for Discord REST deploy, ticket 10).

**Proof (all 2026-09-04, production branch):**
- `bun run db:migrate` → `[✓] migrations applied successfully!` (twice: pre- and post-deploy, second run idempotent). Uses `pg` driver on `DATABASE_URL_UNPOOLED` — proves gateway driver path on direct URL.
- Smoke via `@neondatabase/serverless` HTTP on `DATABASE_URL` → tables `bot_config,channels,guilds,seen_jobs,subscriptions` present; `subscriptions: 0`, `bot_config: 0` — proves worker driver path on pooled URL.
- `bun run typecheck` → exit 0 (earlier session).

### Facts recorded for later tickets
- Credentials live only in local `.env` (gitignored); never commit.
- Neon branch layout (ADR-0006/research-04): `main`=prod, `staging`, `feat/*`; migrate only on `DATABASE_URL_UNPOOLED` (pooled rejects advisory locks).
- Migration file committed to repo so `11`/prototype `10` and build tickets run `bun run db:migrate` on any Neon branch.

## Resolution Comment

Claimed → resolved 2026-09-04. Owner unblocked by supplying project id + token; agent linked, migrated, smoke-tested, and completed all 7 Neon setup steps. This answer is the resolution record.

