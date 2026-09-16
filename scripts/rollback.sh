#!/usr/bin/env bash
# Rollback: identical to scripts/deploy.sh minus the migration step (migrations
# are forward-only - a deploy whose migration must be undone ships as a NEW
# forward migration in a new deploy, never a downgrade).
# Spec: workflows/dev-deploys-monorepo.md section 4. Usage: scripts/rollback.sh <SHA>
# Target SHOULD be the previous SHA from the last Brief.
# Env: VPS_SSH=user@host (required), VPS_DIR=~/kappa-bot (default), DOMAIN (required).
set -euo pipefail

VPS_SSH="${VPS_SSH:?set VPS_SSH=user@host}"
VPS_DIR="${VPS_DIR:-~/kappa-bot}"
DOMAIN="${DOMAIN:?set DOMAIN (public origin served by Caddy, e.g. kappa.example.com)}"
SHA="${1:?usage: scripts/rollback.sh <SHA>}"

fail() { echo "rollback FAILED at $1: $2" >&2; exit 1; }

# --- Preflight (local, blocking) ---
[ -z "$(git status --porcelain)" ] || fail preflight "working tree dirty - commit or stash first"
[ "$(git branch --show-current)" = "main" ] || fail preflight "not on main"
git fetch origin
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
# 4. SKIPPED: migrations are forward-only (never downgraded by a rollback)
pm2 reload ecosystem.config.json --only kappa-service,kappa-web,kappa-bot-gateway  # 5.

# 6. health (all through Caddy except the pm2/log introspection)
curl -sf "https://$DOMAIN/api/health" >/dev/null
curl -sf "https://$DOMAIN/" >/dev/null
ME_CODE="$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/api/v1/auth/me")"
[ "$ME_CODE" = "401" ] || { echo "expected /api/v1/auth/me 401, got $ME_CODE" >&2; exit 1; }
for app in kappa-service kappa-web kappa-bot-gateway; do
  pm2 describe "$app" | grep -q "status.*online" || { echo "$app not online" >&2; exit 1; }
done
tail -n 50 ./logs/gateway-out.log | grep -q "bot ready" || { echo "no recent gateway ready line" >&2; exit 1; }

# 7. Brief (spec section 7)
UPTIME="$(pm2 describe kappa-service | grep -m1 uptime | awk '{print $NF}')"
echo "deploy ${NEW:0:7} (prev ${PREV:0:7}) - OK (rollback)"
echo "migrations: forward-only (not run)"
echo "pm2: service online, web online, gateway online (uptime $UPTIME)"
echo "health: /api/health 200, / 200, /auth/me 401"
echo "rollback: scripts/rollback.sh $PREV"
REMOTE
