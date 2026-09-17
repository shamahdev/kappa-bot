#!/usr/bin/env bash
# Steady-state deploy: dev machine -> single VPS over ssh.
# Spec: workflows/dev-deploys-monorepo.md section 4. Usage: scripts/deploy.sh [SHA]
# Env: VPS_SSH=user@host (required), VPS_DIR=~/kappa-bot (default), DOMAIN (required).
set -euo pipefail

VPS_SSH="${VPS_SSH:?set VPS_SSH=user@host}"
VPS_DIR="${VPS_DIR:-~/kappa-bot}"
DOMAIN="${DOMAIN:?set DOMAIN (public origin served by nginx, e.g. kappa.example.com)}"

fail() { echo "deploy FAILED at $1: $2" >&2; exit 1; }

# --- Preflight (local, blocking) ---
[ -z "$(git status --porcelain)" ] || fail preflight "working tree dirty - commit or stash first"
[ "$(git branch --show-current)" = "main" ] || fail preflight "not on main"
git fetch origin
SHA="${1:-$(git rev-parse origin/main)}"
git cat-file -e "$SHA^{commit}" 2>/dev/null || fail preflight "unknown SHA: $SHA"
bun run typecheck || fail preflight "typecheck failed"

# --- Over ssh (single session) ---
ssh "$VPS_SSH" bash -s -- "$SHA" "$VPS_DIR" "$DOMAIN" <<'REMOTE'
set -euo pipefail
SHA="$1"; DIR="${2/#\~/$HOME}"; DOMAIN="$3"
cd "$DIR"
PREV="$(git rev-parse HEAD)"
trap 'echo "deploy ${SHA:0:7} (prev ${PREV:0:7}) - FAILED"; echo "rollback: scripts/rollback.sh $PREV"' ERR

git fetch origin && git checkout "$SHA"            # 1. detached, explicit SHA
NEW="$(git rev-parse HEAD)"
bun install --frozen-lockfile                     # 2.
bun --filter @kappa/web build                     # 3. web production build
bun run db:migrate                                # 4. forward-only, DIRECT url
pm2 reload ecosystem.config.json --only kappa-service,kappa-web,kappa-bot-gateway  # 5.

# 6. health (service direct on localhost; web + auth routing through nginx)
curl -sf http://127.0.0.1:3001/health >/dev/null
curl -sf "https://$DOMAIN/" >/dev/null
ME_CODE="$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/api/v1/auth/me")"
[ "$ME_CODE" = "401" ] || { echo "expected /api/v1/auth/me 401, got $ME_CODE" >&2; exit 1; }
for app in kappa-service kappa-web kappa-bot-gateway; do
  pm2 describe "$app" | grep -q "status.*online" || { echo "$app not online" >&2; exit 1; }
done
tail -n 50 ./logs/gateway-out.log | grep -q "bot ready" || { echo "no recent gateway ready line" >&2; exit 1; }

# 7. Brief (spec section 7)
MIGRATIONS="$(git diff --name-only "$PREV" "$NEW" -- 'drizzle/*.sql' | xargs -n1 basename 2>/dev/null | tr '\n' ' ')"
[ -z "$MIGRATIONS" ] && MIGRATIONS="none"
UPTIME="$(pm2 describe kappa-service | grep -m1 uptime | awk '{print $NF}')"
echo "deploy ${NEW:0:7} (prev ${PREV:0:7}) - OK"
echo "migrations: $MIGRATIONS"
echo "pm2: service online, web online, gateway online (uptime $UPTIME)"
echo "health: service :3001/health 200, / 200, /api/v1/auth/me 401"
echo "rollback: scripts/rollback.sh $PREV"
REMOTE
