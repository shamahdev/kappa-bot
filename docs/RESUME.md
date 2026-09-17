# Resume — kappa-bot monorepo (as of `3b9247f`, pushed)

## What exists

Bun workspaces monorepo. Three apps, two shared packages, one Postgres.

- `apps/service` (`@kappa/service`, Elysia :3443) — the only HTTP server. `/health`,
  `/metrics`, `/api/v1` (auth, subscriptions, account). Runs migrations at boot.
- `apps/web` (`@kappa/web`, TanStack Start + Effect + Astryx neutral theme + StyleX,
  :3444) — dashboard. Routes `/`, `/dashboard`, `/dashboard/settings`, `/auth/error`.
  UI primitives (`ui.tsx`) are Astryx components; page layout/typography stays StyleX.
  No DB access.
- `apps/discord` (`@kappa/discord`, discord.js) — gateway + worker via `BOT_ROLE`.
  `/jobs` commands, events, `*/30m` cron poller. No HTTP.
- `packages/db` (`@kappa/db`) — schema + pool + migrator. Tables: `guilds`,
  `channels`, `subscriptions`, `seen_jobs`, `bot_config`, `fingerprint_snapshots`,
  `delivery_messages`, plus new `users`, `discord_connections` (+ OAuth tokens, 0006),
  `sessions` (migrations `0005`–`0006`).
- `packages/contracts` (`@kappa/contracts`) — Effect Schemas, DTOs, `PATHS`,
  error codes. Service ↔ web source of truth.
- Deploy: nginx single origin `https://kappa.shamah.dev` (`/api/` → :3443, rest → :3444, certbot TLS), pm2 with 4 apps
  (`kappa-service`, `kappa-web`, `kappa-bot-gateway`, `kappa-bot-worker`),
  `scripts/deploy.sh` + `scripts/rollback.sh`.

## Auth & ownership model

- Session: opaque 32B token, sha256-stored in `sessions`, 30d expiry, HttpOnly
  `SameSite=Lax` cookie `kappa_session` (Secure in prod). Web never sees tokens.
- Row authz: `guildId = dm:<uid>` (DM subs, full CRUD, channel auto-resolved via
  Discord REST) OR `createdBy = <uid>` OR live ManageGuild proof (guild subs:
  edit/pause/delete). Legacy `createdBy IS NULL` rows are invisible to web.
- OAuth scope `identify guilds`; tokens persisted + refreshed inline. Servers tab lists
  manageable guilds (`GET /guilds`); stale grants answer 409 `RECONNECT_REQUIRED`.
- Theme: forced light + kappa-blurple accent; Astryx components stay neutral.
- Delete account cascade: sessions → connections → DM subs (+ seen) → DM
  channels + guild row → DM delivery rows → createdBy guild subs (+ seen) →
  users row → clear cookie. Best-effort token revoke. Idempotent (second call 401).

## Verification state

- All workspace typechecks green; `drizzle-kit generate` no-op after 0006;
  service: 66 in-process smoke checks passed (PGlite-backed, pre-guilds); web builds.
- Still open: `bun install` outside the sandbox; real OAuth round-trip (now with `guilds`
  scope — existing users must re-login once); first Neon boot applying 0005+0006;
  VPS cutover (`workflows/dev-deploys-monorepo.md` §3 checklist); poller move (deferred).

## Graphs

Production — deploy / request topology:

```ts
nginx (kappa.shamah.dev :443, certbot TLS)
  → /api/* → kappa-service (Elysia :3443, one-shot per request)
    → routes/auth → Discord OAuth + @kappa/db (users, discord_connections, sessions)
    → routes/subscriptions → @kappa/db + Discord REST (ensure DM channel)
    → routes/account → @kappa/db (cascade delete)
    → @kappa/db → Neon Postgres (pooled runtime, direct migrate at boot)
  → /* → kappa-web (TanStack Start :3444, one-shot per fetch)
    → routes/dashboard → lib/api.ts → Effect HttpClient → /api/*
    → contracts Schemas (boundary: unknown → trusted)
kappa-bot-gateway (discord.js WS, Stream over time: cron */30m + events)
  → /jobs commands → @kappa/db (direct)
  → schedule/pollAll → Source Adapters → deliverMessage → Discord
kappa-bot-worker (one-shot, autorestart false, external trigger reserved)
```

Production — web fetch (Effect A/E/R):

```ts
dashboard route
  → runApi (R: HttpClient via ApiLive; credentials: include)
    → request (A: SubscriptionsResponse DTO)
      → HttpClient.execute (E: NETWORK → ApiError; retry at react-query layer)
      → schemaBodyJson (E: DECODE → ApiError; contract drift = defect)
      → decodeEnvelope (E: service codes pass through as ApiError)
```

Production — OAuth login flow:

```ts
Browser: GET /api/v1/auth/discord/login?return_to
  → service: signState → 302 discord.com/authorize
    → Browser: approve → GET /api/v1/auth/discord/callback?code&state
      → service: verifyState → code↔token → GET /users/@me
        → upsert users + discord_connections → create session
          → 302 WEB_URL + return_to + Set-Cookie kappa_session
```

Production — delete account cascade:

```ts
DELETE /api/v1/account (authz: session user)
  → sessions (all user rows)
    → discord_connections
      → DM subscriptions (cascade seen_jobs)
        → DM channels + guilds('dm:<uid>')
          → delivery_messages (DM channel)
            → guild subscriptions createdBy=uid (cascade seen_jobs)
              → users row → clear cookie
```

Production — Discord poll / delivery (Stream, one tick at a time):

```ts
Cron */30m
  → schedule/pollAll → fingerprint groups
    → pollSources (concrete + cookie-gated opt-ins)
      → searchJobPostings → dedup seen_jobs (ON CONFLICT DO NOTHING)
        → deliverMessage (gateway WS / worker REST)
          → delivery_messages persist (reply-by-number)
```

Tests: none committed — the repo has no test harness. Verification is typecheck
+ generate no-op + in-process smoke (service) + production build (web).
