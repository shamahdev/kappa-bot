# Workflow: user-manages-job-subscriptions

Status: ready (rounds 1–2 confirmed 2026-09-16; implementer may build without further questions).
Owner loop: a user with Discord-linked job subscriptions manages them from the web instead of
only via `/jobs` commands, and can delete their account entirely.

## 1. Loop

- Who: any Discord user with ≥0 kappa subscriptions (DM-scope and/or guild-scope created by them).
- Cadence: on-demand (a few times a month: tweak keywords, pause a noisy sub, prune, leave).
- Today: Discord `/jobs list|subscribe|unsubscribe|config` only; no account concept, no web.
- Target: Login with Discord → dashboard (list/create/edit/pause/delete) → optional delete account.
- Non-goals v1: guild-sub *create* from web (stays in Discord), ManageGuild-permission-based
  guild management, soft-delete/restore, Effect RPC, moving the poller to `service`.

## 2. Vocabulary binding

- Trigger: **event** — user opens the dashboard / clicks Login with Discord. No schedule, no AI.
- Checkpoints (2, both pushed right — everything is prepared before the human decides):
  1. `delete-subscription` — one click + inline confirm; Brief = one-line sub summary.
  2. `delete-account` — dedicated settings step; Brief = account summary counts + consequences
     (see §7). Type-to-confirm (`delete my account`).
- No other checkpoints: login, list, create, edit, pause/resume run autonomously once authed.

## 3. Monorepo host (decided inside this spec)

Bun workspaces. Three deployable apps, two shared packages:

```
apps/service/   Elysia HTTP API (health, metrics, auth, subscriptions, account) + migrations at boot
apps/web/       TanStack Start + Effect + Astryx + StyleX dashboard (no DB access)
apps/discord/   discord.js gateway: commands/events/schedule + worker one-shot (unchanged behavior v1)
packages/db/    drizzle schema (existing tables + users/discord_connections/sessions) + createDb + runMigrations
packages/contracts/  shared Effect Schemas + DTO types + API path constants (service ↔ web)
drizzle/        stays at root; drizzle-kit schema glob → packages/db/src/schema/*
ecosystem.config.json  4 pm2 processes across the 3 code apps (see §9)
nginx.conf       site snippet, single origin: /api/ → service:3443, rest → web:3444
```

- Migration order (behavior-preserving): ① extract `packages/db` (move schema + `db.ts`, update
  imports, `drizzle-kit generate` must be a no-op diff); ② carve `apps/discord` (move gateway,
  commands, events, schedule, worker; keep `BOT_ROLE` switch); ③ new `apps/service` (move
  `server.ts`, add §5 API, boot migrations); ④ new `apps/web` (§6); ⑤ `packages/contracts`
  Schemas consumed by both sides; ⑥ pm2 + nginx cutover (§9).
- Root `package.json` keeps `db:generate`, `db:migrate`, `typecheck` (now runs per-workspace);
  per-app scripts: `dev`, `start`, `typecheck`.

## 4. Data model (new tables; existing tables untouched)

```ts
users:                 discord_id text PK, username text, avatar text|null,
                       created_at timestamptz default now, updated_at timestamptz default now
discord_connections:   id serial PK, user_id text FK→users.discord_id cascade,
                       provider text default 'discord', scopes text default 'identify',
                       created_at timestamptz default now,
                       unique (user_id, provider)
sessions:              token_hash text PK (sha256 of opaque 32B token), user_id text FK cascade,
                       expires_at timestamptz, created_at timestamptz default now,
                       index on (user_id)
```

- DM scope unchanged: guild id `dm:<discordId>` + DM channel row + subs; cascade-cleaned on delete.
- `subscriptions.createdBy` (existing, Discord user id) becomes the ownership key for guild-scope
  rows in web authz. Rows with `createdBy IS NULL` (legacy) are invisible to web v1.
- `delivery_messages` rows for the user's DM channel are deleted on account delete; guild-channel
  delivery rows stay.

## 5. Service API (Elysia, `/api/v1`, JSON, session cookie `kappa_session`)

Auth (service owns OAuth + session; web never sees tokens):

- `GET /api/v1/auth/discord/login?return_to=/dashboard` → 302 Discord authorize
  (`client_id`, `redirect_uri=<SERVICE_URL>/api/v1/auth/discord/callback`, `scope=identify`,
  `state` = signed return_to).
- `GET /api/v1/auth/discord/callback?code&state` → code↔token, fetch `/users/@me`, upsert
  `users` + `discord_connections(provider=discord)`, create session (opaque token, sha256 stored,
  30d expiry), set `HttpOnly; Secure(prod); SameSite=Lax; Path=/` cookie, 302 to `WEB_URL` + return_to.
- `POST /api/v1/auth/logout` → delete session, clear cookie. `GET /api/v1/auth/me` → `{ user }` | 401.

Subscriptions (all require session; authz per row: `guildId == dm:<uid> OR createdBy == <uid>`, else 404):

- `GET /api/v1/subscriptions` → `{ subscriptions: [...] }` (DM + createdBy-me, newest first).
  DTO: `{ id, scope: 'dm'|'guild', guildId, channelId, source, keywords, location, isActive,
  retentionDays, createdAt }`. Sources: `all|linkedin|kalibrr|techinasia|glints|indeed|jobstreet`.
- `POST /api/v1/subscriptions` — **DM scope only v1**. Body `{ source, keywords }`
  (location defaults `Indonesia`, distance null, filters `{}`). Service ensures the DM channel via
  Discord REST (`POST /users/@me/channels { recipient_id }`), upserts `guilds(dm:<uid>)` +
  `channels`, inserts sub with `createdBy=<uid>`. 400 on unknown source / blank keywords.
- `PATCH /api/v1/subscriptions/:id` — `{ keywords?, location?, isActive?, retentionDays? }`
  (retention 1–365; channel/source immutable v1).
- `DELETE /api/v1/subscriptions/:id` → `{ summary }` (cascades seen_jobs).
- Poll-now (`fetch`) stays Discord-only v1.

Account:

- `GET /api/v1/account/summary` → `{ discordId, username, dmSubscriptions, guildSubscriptionsCreated,
  connections: ['discord'], sessionsActive }` — feeds the delete-account Brief.
- `DELETE /api/v1/account` → exact order: sessions → `discord_connections` → DM subs (cascade seen)
  → DM `channels` + `guilds('dm:<uid>')` rows → `delivery_messages` for DM channel →
  guild subs with `createdBy=<uid>` (cascade seen) → `users` row. Then clear cookie.
  Best-effort Discord token revoke; failure never fails the delete. Idempotent per session
  (second call → 401, account already gone).

Errors: `{ error: { code, message } }`; codes `UNAUTHORIZED|NOT_FOUND|VALIDATION|OAUTH_FAILED|CONFLICT`.

New env (service): `DISCORD_CLIENT_SECRET`, `SERVICE_URL` (e.g. `https://kappa.shamah.dev`),
`WEB_URL` (same origin, e.g. `https://kappa.shamah.dev`), `SESSION_SECRET` (state signing),
`DISCORD_REDIRECT_PATH=/api/v1/auth/discord/callback`. Reuse `CLIENT_ID` (= Discord client id),
`DISCORD_TOKEN`, `DATABASE_URL(+_UNPOOLED)`, `PORT` (service 3443).

## 6. Web (TanStack Start + Effect + Astryx + StyleX)

- Routes: `/` (landing + “Login with Discord” → service login URL), `/dashboard`
  (subs table/cards: source, keywords, location, scope, active toggle, edit, delete;
  “New DM subscription” form: source select + keywords), `/dashboard/settings`
  (account summary Brief + delete-account type-to-confirm), `/auth/error`.
- Data: Effect `HttpClient` layer + `packages/contracts` Schemas decode every response; `credentials:
  'include'` (same-origin via nginx, no token handling in JS). Mutations invalidate the subs query.
- UI: Astryx components on the neutral theme; StyleX only for layout/custom CSS. Speed of review
  governs: dashboard shows the Brief-level table, never raw JSON; destructive actions confirm inline.
- No SSR secrets, no DB env in web. `WEB_PORT=3444`.

## 7. Briefs

- `delete-subscription` Brief: `` `linkedin` backend engineer · Indonesia → #jobs `` + “past
  deliveries stay deleted with it”.
- `delete-account` Brief (from `GET /account/summary`): “Deletes your account (discord @user),
  1 connection (discord), N DM subscriptions, M guild subscriptions you created, and their seen-job
  history. Guilds/channels and other users' subscriptions are untouched. Irreversible.” + link back
  to `/dashboard`. Confirm phrase: `delete my account`.

## 8. Discord app (no behavior change v1)

- Keeps gateway login, `/jobs` commands, component/reply handlers, `guildDelete`/`channelDelete`
  cascades, in-process cron + `BOT_ROLE=worker` one-shot. Imports DB via `@kappa/db`.
- No HTTP listener v1 (service owns `/health` + `/metrics`; gateway health = pm2 + Discord ready log).
- Cron stays here v1 (recommendation R2 below); the service↔discord poller move is workflow #2 fuel.

## 9. Deploy (pm2 + nginx, single VPS)

- pm2 apps: `kappa-service` (`apps/service`, `bun src/index.ts`, port 3443, autorestart),
  `kappa-web` (`apps/web`, `bun start`/TanStack, port 3444, autorestart),
  `kappa-bot-gateway` (`apps/discord`, `BOT_ROLE=gateway`, autorestart),
  `kappa-bot-worker` (`apps/discord`, `BOT_ROLE=worker`, autorestart false, external cron).
- nginx (root `nginx.conf` site snippet): `/api/` → 127.0.0.1:3443, `/` → 127.0.0.1:3444.
  Single origin ⇒ session cookie needs no `Domain`, no CORS. HTTPS via certbot is
  required (Secure cookies). Logs stay in `./logs/`.

## 10. Acceptance

1. `bun install`, per-workspace `typecheck`, and `db:generate` (no-op after phase ①) pass.
2. OAuth round-trip: login → cookie → `/auth/me` 200 → dashboard lists DM + createdBy-me subs.
3. Dashboard CRUD + pause/resume round-trips; Discord `/jobs list` shows the same rows.
4. Delete account on a fixture user removes exactly the §5 set; guild rows + others' subs intact.
5. pm2 starts all 4 processes on the VPS; nginx serves web + `/api/*` from one origin (`https://kappa.shamah.dev`).
6. Discord delivery + cron behavior unchanged (existing flows, same embeds).

## 11. Confirmations (round 2 — all recommended accepted)

- R1 Scope: v1 = DM subs (full CRUD) + createdBy-me guild subs (edit/pause/delete). Guild create
  and ManageGuild-based management deferred. CONFIRMED.
- R2 Cron home: poller + worker stay in `apps/discord` v1; move to `service` is workflow #2.
  CONFIRMED.
