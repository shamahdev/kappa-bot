Status: resolved
Type: grilling
Blocked by: 05, 06

## Question

Decide hosting & deployment topology: process layout (bot gateway + scheduler/worker as one deploy vs split), container/Docker shape, env & secrets management, Neon env separation (dev/branch vs prod), and observability baseline (logs, health check, restart policy). Choose a default host target (Railway/Render/Fly/VPS) with rationale; the choice must be compatible with the runtime (`05`) and module architecture (`06`) and not presuppose a paid platform without owner consent.

## Answer

**Status: resolved — Decision: portable Docker, env-switched roles, `oven/bun:1`, two Neon URLs, stdout+healthcheck (all A).**

- **Host (Q1 A):** No PAAS lock. `Dockerfile` at repo root builds image runnable on Railway/Fly/Render/VPS/systemd. PAAS-agnostic — no host-specific SDK or volumes. Default dev = `bun src/index.ts` locally (needs Discord token + Neon). Owner chooses host later; this topology is the default contract for build tickets.
  ```dockerfile
  FROM oven/bun:1
  WORKDIR /app
  COPY package.json bun.lockb ./
  RUN bun install --frozen-lockfile
  COPY src ./src
  COPY drizzle ./drizzle
  COPY drizzle.config.ts tsconfig.json ./
  ENV NODE_ENV=production BOT_ROLE=gateway PORT=3000
  EXPOSE 3000
  CMD ["bun", "src/index.ts"]
  ```
- **Process layout (Q2 A):** Single image, two entrypoints.
  - `BOT_ROLE=gateway` (default) → `src/index.ts`: creates `Client`, runs loader (register commands, attach events), starts Elysia (`/health`,`/metrics`), `CronJob.start()` (ADR-0004). Long-lived Discord WS.
  - `BOT_ROLE=worker` (scaling upgrade, ADR-0004) → `src/worker.ts`: `neon()` HTTP client only (no `pg` Pool), reads subscriptions, fetches fingerprints, posts via Discord REST/webhook. No gateway WS.
  - `package.json` scripts: `"dev": "bun --watch src/index.ts"`, `"start:worker": "bun src/worker.ts"`, `"typecheck": "tsc --noEmit"`.
- **Container shape (Q3 A):** `oven/bun:1` (Debian variant avoids Alpine glibc nuance), single stage for MVP; EXPOSE 3000; healthcheck optional platform-side hitting `/health`. Non-root: create `user` and `USER` only if platform requires; note as post-MVP hardening.
- **Env & secrets (Q4 A):** `.env.example` (committed, no secrets):
  ```
  DISCORD_TOKEN=        # bot token
  CLIENT_ID=            # application id
  GUILD_ID=             # dev-only: guild for local command deploy
  DATABASE_URL=         # pooled (ep-...-pooler...)  → runtime
  DATABASE_URL_UNPOOLED=# direct (ep-...)           → drizzle-kit migrate only
  PORT=3000
  LOG_LEVEL=info
  BOT_ROLE=gateway
  ```
  `.gitignore` excludes `.env*`. Neon branches: `main`=prod, `staging`, `feat/*` per ADR-0004 research-04 §3.2, each with own branch URL. Never run migrations on `DATABASE_URL` (`-pooler` rejects advisory locks, research-04 §5).
- **Observability & restart (Q5 A):**
  - Pino JSON logs → stdout (`logger.child({ feature })` per ADR-0002). Log `bot ready`, `disconnect`, cron tick start/end/skip.
  - `GET /health` → `200 { ok:true, uptime, features:[...] }`; Elysia starts after `client.login()`.
  - `GET /metrics` → plaintext counters `feature_error_total{feature}`, `linkedin_circuit_open{fingerprint}` (ADR-0004), `cron_ticks_total`, `jobs_delivered_total`.
  - Restart: Docker `restart: unless-stopped` / systemd `Restart=always`; `unhandledRejection` logs fatal but does NOT exit (ADR-0002 isolation). OTEL/APM deferred (map fog: observability).

- **Rejected:** commit-to-Railway/Fly now (locks config), two separate images (CI overhead), full OTEL (heavy for MVP), single env dev/prod same DB (risk).

Evidence: ADR-0001 Bun/Elysia/discord.js, ADR-0002 single-deployable architecture, ADR-0004 in-process cron upgrade path, research-04 pooled/direct + branching, owner confirmation 2026-09-02 “Accept all A”. ADR `docs/adr/0006-hosting-deployment-topology.md:1` records the tradeoff.

## Resolution Comment

Claimed → resolved via grilling 2026-09-02. All five Qs answered A. ADR 0006 and this Docker/env sketch are the resolution record.

