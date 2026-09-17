# Workflow: dev-deploys-monorepo

Status: ready (round 1 confirmed 2026-09-16; implementer may build without further questions).
Owner loop: a dev ships `main` to the single VPS. Cadence: on demand, a few times a week.
Today: no VPS path — only a local `pm2 start --only kappa-bot-gateway`, no CI, no nginx.conf,
Dockerfile builds the old single-app layout. Target: one command → VPS updated, verified, briefed.

## 1. Vocabulary binding

- Trigger: **event** — dev runs the deploy command (manual event v1; push-to-main auto-deploy
  deferred, see R1). No schedule. No AI.
- Checkpoints: none pre-deploy — the manual trigger IS the deploy decision (nothing to push right
  past it). One post-deploy review, fully pushed right: the script does pull → install → build →
  migrate → reload → health-check, then presents a single Brief; the human reads the Brief, not logs.
- Brief: SHA deployed (+ previous SHA), migrations applied, pm2 status per process, health results,
  one-command rollback. Reviewed once, late, with everything prepared.

## 2. VPS runtime (R2 recommendation)

- Native Bun + pm2 via git pull. VPS provisioned once: Bun >= 1.1, pm2 (with `pm2 startup` +
  `pm2 save`), nginx (system service) + TLS cert (certbot — required for Secure cookies),
  Node not required.
- `Dockerfile` is OUT of the deploy path v1 (left untouched in repo; ADR-0006's portable-image
  topology is superseded for deploys by the pm2-native topology — record an ADR update at cutover).
- Repo clone on VPS at `~/kappa-bot`, branch `main`, always deployed at an explicit SHA
  (default: `origin/main` at deploy time; the SHA is printed in the Brief and is the rollback unit).
- Secrets: single root `.env` on the VPS, created by hand during cutover, never in git, never
  overwritten by deploys. Each app loads it via the existing `dotenv/config` pattern. Changing
  secrets = `scp`/edit on VPS + `pm2 reload` (outside this loop, noted in the Brief when relevant).
- pm2 is VPS-only (not installed locally — verified). Local machine needs only `git`, `ssh`, `bun`.

## 3. First-run cutover (one-shot, executed once through §4 mechanics)

1. Provision VPS (Bun, pm2 + startup, nginx + certbot TLS, user, firewall 80/443).
2. `git clone git@github.com:shamahdev/kappa-bot.git`, checkout monorepo `main` SHA.
3. Hand-write VPS root `.env` (all of §5-service env + Discord + DB URLs + ports).
4. `bun install --frozen-lockfile`, `bun run db:migrate`, web build, `pm2 start ecosystem.config.json`,
   `pm2 save`, install `nginx.conf` (+ TLS via certbot), point DNS
   (`kappa.shamah.dev` → VPS), smoke test (§6).
5. Record ADR update (pm2-native supersedes Docker for deploys) + cutover Brief in chat/log.

## 4. Steady-state loop (`scripts/deploy.sh [SHA]`, run from dev machine)

Preflight (local, blocking): tree clean (block on dirty), on `main`, `git fetch`, resolve SHA
(default `origin/main`), `bun run typecheck` passes (block on fail).

Over ssh (single session, `set -euo pipefail`):

1. `git fetch origin && git checkout <SHA>` (detached, explicit).
2. `bun install --frozen-lockfile`.
3. Build web (`bun --filter web build` or workspace equivalent — exact command fixed at implementation).
4. `bun run db:migrate` (DIRECT url; forward-only — see rollback rule).
5. `pm2 reload ecosystem.config.json --only kappa-service,kappa-web,kappa-bot-gateway`
   (reload order: service → web → gateway; worker is never reloaded here).
6. Health: `GET http://127.0.0.1:3443/health` 200 (service direct), `GET /` 200 (web via nginx),
   `pm2 describe` all `online` (gateway), recent gateway `ready` log line present.
7. Print the Brief (§7). Non-zero exit on any failure; script stops at the failing step.

`scripts/rollback.sh <SHA>`: identical minus step 4 (migrations are forward-only — a deploy whose
migration must be undone is a NEW forward migration, shipped as a new deploy, never a downgrade).
Rollback target SHOULD be the previous SHA from the last Brief.

Worker note: `kappa-bot-worker` (`autorestart: false`) is NOT part of reloads; the in-gateway cron
is the v1 poller. Wiring an external scheduler for worker mode is out of scope v1.

## 5. Files this workflow owns

- `scripts/deploy.sh`, `scripts/rollback.sh` (executable, no dependencies beyond git/ssh/bun).
- Root `ecosystem.config.json`: 4 apps (`kappa-service` :3443, `kappa-web` :3444,
  `kappa-bot-gateway`, `kappa-bot-worker`), each with `cwd: ./apps/<name>`, Bun-native
  (`script: bun`, `interpreter: none`), `./logs/` files, per-app `BOT_ROLE` where needed.
- Root `nginx.conf`: site snippet (`/api/` → 127.0.0.1:3443, `/` → 127.0.0.1:3444,
  with install + certbot instructions in its header).
- VPS-only (never in git): root `.env`, `~/.ssh` access, nginx site install + TLS cert.

## 6. Verification gates (each deploy)

1. Local `typecheck` green before ssh.
2. Post-reload: service `GET http://127.0.0.1:3443/health` 200, web `/` 200, pm2 all online.
3. Spot: `/api/v1/auth/me` 401 without cookie (service routing through nginx proven).
4. Discord: gateway `ready` log line after reload; no cron double-fire (single gateway instance —
   `instances: 1`, never cluster for gateway).

## 7. Brief format (printed by the script, reviewed by the human)

```
deploy <SHA-short> (prev <SHA-short>) — OK|FAILED at <step>
migrations: <none|0005_... applied>
pm2: service online, web online, gateway online (uptime …)
health: service :3443/health 200, / 200, /api/v1/auth/me 401
rollback: scripts/rollback.sh <prev-SHA>
```

## 8. One-shot migrations executed through this loop (deferred, planned here)

- Poller move (`apps/discord` → `apps/service`): service gains cron ownership + worker mode;
  discord becomes commands/events-only; ecosystem + worker wiring updated; shipped as one normal
  deploy + Brief. NOT executed at cutover (per workflow #1 R2) — this section is its parking spot.

## 9. Acceptance

1. Cutover done via §3; VPS serves web + `/api/*` from one origin (`https://kappa.shamah.dev`); gateway delivering jobs.
2. A no-op deploy (same SHA) succeeds and prints a correct Brief.
3. A failing deploy (e.g. bad SHA, failing typecheck) stops before touching the VPS / before reload.
4. Rollback to previous SHA restores service within minutes; Brief shows the rollback SHA.
5. No secrets in git; VPS `.env` survives deploys untouched.

## 10. Confirmations (round 1 — all recommended accepted)

- R1 Trigger: manual `scripts/deploy.sh` over ssh v1; GitHub Actions push-to-deploy deferred.
  CONFIRMED.
- R2 VPS runtime: native Bun + pm2 via git pull; Dockerfile out of the deploy path v1. CONFIRMED.
