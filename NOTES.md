# NOTES — kappa-bot world (loop-me raw notes)

## Round 1 answers (2026-09-16, all recommended accepted)

- Deploy: single Linux VPS, Bun >= 1.1, pm2 owns all apps, nginx in front for service + web.
  Single origin `https://kappa.shamah.dev` (service :3443, web :3444; amended 2026-09-17 —
  earlier rounds assumed Caddy + :3001/:3000, then a split api.* origin, both superseded).
- Jobs loop today: Discord `/jobs` commands only (guild channels + bot DMs). Web "manage" =
  list + create + edit filter + pause/resume + delete over the same (guild, channel, filter) tuple.
- Workflow #1: `user-manages-job-subscriptions` (Discord login → dashboard → manage subs →
  delete account). Monorepo + pm2 shape is decided inside that spec as its host.
  Workflow #2 (queued): `dev-deploys-monorepo`.

## Round 2 answers (2026-09-16, all recommended accepted)

- R1 Scope v1: DM subs full CRUD + createdBy-me guild subs edit/pause/delete.
- R2 Cron home v1: poller + worker stay in `apps/discord`; move to `service` deferred to #2.
- Spec `workflows/user-manages-job-subscriptions.md` → Status: ready.

## Workflow #2 answers (2026-09-16, all recommended accepted)

- R1 Trigger: manual `scripts/deploy.sh` over ssh v1; auto-deploy deferred.
- R2 VPS runtime: native Bun + pm2 via git pull; Dockerfile out of deploy path v1.
- Spec `workflows/dev-deploys-monorepo.md` → Status: ready.

## Tools

- Runtime: Bun >= 1.1. Process manager: pm2 (all apps). Reverse proxy: nginx (single origin) + certbot TLS.
- Backend: Elysia (HTTP), Drizzle ORM + drizzle-kit, Neon Postgres (pooled `DATABASE_URL`
  runtime, direct `DATABASE_URL_UNPOOLED` migrations), `pg` Pool, Pino logs.
- Discord: discord.js v14 gateway + REST, slash commands `/jobs`, `BOT_ROLE=gateway|worker`.
- Web (new): TanStack Start, Effect-TS (HttpClient + Schema, typed fetch against service —
  no Effect RPC v1, no Eden dependency in web), Astryx (Meta OSS React design system,
  neutral theme) + StyleX for custom styles.
- Polling: in-process cron `*/30 * * * *` (resolvable via `/jobs config`), worker one-shot mode.

## Channels

- Discord guild text channels (delivery target, ManageGuild-gated commands).
- Bot DM channels (per-user delivery, owner-authorized).
- Web dashboard (new): DM subs + createdBy-me guild subs. Guild-sub create stays in Discord v1.

## Canonical terminology

- `service`: Elysia HTTP API + Postgres access + (new) Discord OAuth/session + subs/account API.
  Only writer the web ever talks to. Avoid: backend (alias ok in prose), server.
- `web`: TanStack Start dashboard. Never touches the DB directly. Avoid: frontend, app.
- `discord`: discord.js gateway app (commands/events/schedule/worker). Avoid: bot (alias ok).
- `grizzle` = typo, canonical is `drizzle`.
- `Subscription`: persisted (guild, channel, filter) tuple driving scheduled delivery.
  DM scope uses synthetic guild id `dm:<userId>`. Avoid: Watch, Feed, Alert.
- `JobPosting`: external normalized listing. Avoid: Listing, Job, Vacancy.
- `SeenJob`: per-subscription dedup record. Avoid: DeliveredJob, SentJob.
- `Source Adapter`: one upstream behind the shared search/detail seam
  (`all | linkedin | kalibrr | techinasia | glints | indeed | jobstreet`). Avoid: Provider, Fetcher.
- `Delivery`: poll-to-channel send (single card or numbered digest). Avoid: Dispatch, Send.
- `Account`: `users` row + `discord_connections` rows + `sessions` rows for one Discord user id.
- `Connection`: one OAuth link row (`discord_connections`) between Account and Discord.
- Delete account = delete Account + its Connections + its DM-scope guild/channels/subs (+ seen)
  + any guild-scope subs with `createdBy` = user (+ seen). Real guild/channel rows and other
  users' subs stay. Irreversible, no soft-delete v1.
