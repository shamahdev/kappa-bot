## Destination

A decision-ready spec (and cleared path) for **kappa-bot**: a modular, scalable Discord bot whose first feature is a **job-listing subscription** — users/guilds subscribe a channel to filtered job listings, primarily via LinkedIn Jobs Guest APIs (`linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` and related guest endpoints), with **Neon Postgres** as the configuration/subscription store. Done = any build team can implement without further wayfinding: runtime/framework, module system, Neon schema, LinkedIn guest API surface, polling/delivery pipeline, and Discord UX are all decided with proof.

## Notes

- Domain: Discord bot platform (slash commands, embeds, permissions, sharding), job aggregation (LinkedIn Guest APIs + alternatives), Neon Postgres (serverless Postgres, branching, Drizzle/Prisma).
- Skills every session should consult: `grilling`, `domain-modeling`, `research`, `prototype` as ticket type dictates. Read `CONTEXT.md`/`docs/adr/` if present before exploring.
- Standing preferences for this effort:
  - Modular: features as isolated plugins/modules with a shared core; adding a second subscription source should not touch core.
  - Scalable: stateless bot, horizontal shardability, Neon pooling, scheduled jobs outside the gateway process if needed.
  - First feature is subscription for job listings — not a one-off search command; must support per-guild/per-channel filters, deduplication, and scheduled delivery.
  - Neon is the source of truth for configuration (guilds, channels, subscriptions, seen jobs).
  - LinkedIn `seeMoreJobPostings/search` is the starting point; additional guest endpoints and alternative job sources should be catalogued before the pipeline is locked.

## Decisions so far

<!-- one line per closed ticket, enough to judge relevance, then zoom the link for detail -->

- [01-linkedin-guest-api-surface](issues/01-linkedin-guest-api-surface.md): `GET /jobs-guest/jobs/api/seeMoreJobPostings/search` is sole guest polling surface (HTML fragment, `start` paging, full param vocabulary cataloged) — see `research-01-linkedin-guest-api.md`.
- [02-linkedin-guest-constraints](issues/02-linkedin-guest-constraints.md): `robots.txt` disallows `/jobs-guest/`, TOS bans bots; gate is Cloudflare `__cf_bm`/`999`, so compliant posture is alternatives-first, prototype flag at 2–3s jitter / 60m interval / ≤3 pages — see `research-02-linkedin-constraints.md`.
- [03-alternative-job-sources](issues/03-alternative-job-sources.md): Arbeitnow recommended as first fallback (zero-auth, free, 50-req), Remotive/Greenhouse/Lever/USAJOBS cataloged — see `research-03-alternative-sources.md`.
- [04-neon-postgres-patterns](issues/04-neon-postgres-patterns.md): `pg` Pool for gateway (pooled host) + `@neondatabase/serverless` HTTP for worker; Drizzle recommended, migrations on direct URL, autosuspend handled — see `research-04-neon-patterns.md`.
- [05-runtime-framework-choice](issues/05-runtime-framework-choice.md): **Bun 1.x + Elysia 1.x (HTTP) + discord.js v14** — `bun` manager, TS `ESNext/bundler`, plain `defineFeature` registry — see `CONTEXT.md` and `docs/adr/0001-bun-elysia-discordjs-runtime.md`.
- [06-modular-feature-architecture](issues/06-modular-feature-architecture.md): Flat `src/core` + `src/features/*`, `defineFeature` contract, central REST dispatch, try/catch isolation, Elysia in-core — see `docs/adr/0002-modular-feature-architecture.md`.
- [07-subscription-data-model](issues/07-subscription-data-model.md): 5-table normalized (guilds/channels/subscriptions/seen_jobs/bot_config), hybrid columns+JSONB, per-sub dedup `(sub,source,extId)`, 30d TTL — see `docs/adr/0003-subscription-data-model.md` + Drizzle sketch in ticket.
- [08-fetch-delivery-pipeline](issues/08-fetch-delivery-pipeline.md): In-process `cron` 15m, fingerprint group-by, tiered 429/999/backoff, insert-first at-most-once — see `docs/adr/0004-fetch-delivery-pipeline.md`.
- [09-discord-ux-subscription-management](issues/09-discord-ux-subscription-management.md): `/jobs` umbrella subcommands, `ManageGuild`-gated, ephemeral confirms, single rich embed no detail fetch — see `docs/adr/0005-discord-ux-subscription-management.md`.
- [12-hosting-deployment-topology](issues/12-hosting-deployment-topology.md): Portable Docker (`oven/bun:1`), env-switched gateway/worker roles, two Neon URLs, stdout+healthcheck — see `docs/adr/0006-hosting-deployment-topology.md`.
- [11-neon-bootstrap-task](issues/11-neon-bootstrap-task.md): Neon `young-sunset-25304132/production` linked, `drizzle/0000` applied, both drivers verified, secrets in gitignored `.env` — see ticket Answer.
- [10-prototype-subscription-wireframe](issues/10-prototype-subscription-wireframe.md): Runnable stub at `prototype-subscription/` proves 09's UX fits 07's schema on live Neon (subscribe/dedup/embed/cleanup green); found + fixed 09's autocomplete+choices bug — see ticket Answer.

## Not yet specified

<!-- All fog graduated: scaling/queue/sharding → 08 + 12; filter vocabulary shape → 07; dedup key/TTL → 07; rate-limit/backoff → 08; rendering tiers → 09; permission model → 09; observability/testing → 12. Nothing left to decide before build. -->

## Out of scope

- Implementation/build of the bot beyond the spec and decision records (this map produces decisions, not deliverables, unless Notes are amended).
- Non-job features (moderation, music, ticketing, etc.) — the module skeleton must allow them, but they are not specified here.
- Paid LinkedIn APIs or scraping that requires authentication/session hijacking beyond public guest endpoints.
