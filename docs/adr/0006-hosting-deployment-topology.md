# Hosting & deployment topology

Ship kappa-bot as a **portable Docker image** deployable unchanged to Railway, Fly, Render, or any VPS/systemd — PAAS-agnostic, no host SDK; the owner picks the host later. One image holds **two env-switched roles**: `BOT_ROLE=gateway` (default: discord.js Client + Elysia `/health` `/metrics` + in-process cron per ADR-0002/0004, entrypoint `src/index.ts`) and `BOT_ROLE=worker` (`src/worker.ts`, Neon HTTP + Discord REST/webhook, no WS) for the ADR-0004 scaling upgrade. Dev/self-host runs `gateway` only.

`Dockerfile` is `FROM oven/bun:1`, `WORKDIR /app`, `bun install --frozen-lockfile`, `EXPOSE 3000`, `CMD ["bun","src/index.ts"]`. Env comes from `.env.example` (`DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` dev, pooled `DATABASE_URL`, direct `DATABASE_URL_UNPOOLED`, `PORT`, `LOG_LEVEL`, `BOT_ROLE`), injected by platform, never committed. Neon separation: `main`=prod, `staging`=integration, `feat/*` per-branch previews (research-04 §3.2); migrations always run on `DATABASE_URL_UNPOOLED` (ADR-0003).

Observability baseline is stdout Pino structured logs + `GET /health` (`{ok,features,uptime}`) consumed by platform healthcheck, `restartPolicy: always` (Docker/systemd), and `/metrics` exposing `feature_error_total` and `linkedin_circuit_open` (ADR-0004); log on `ready`, `disconnect`, cron tick boundaries. OTEL/APM deferred.
