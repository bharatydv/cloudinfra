#!/usr/bin/env bash
#
# Run one of backend/scripts/*.py against the managed database.
#
#   bash deploy/azure/containerapps/run-script.sh apply_genai_course --dry-run
#   bash deploy/azure/containerapps/run-script.sh disable_demo_accounts
#
# The seed directory is not in the backend image (see
# DEPLOY-AZURE-CONTAINERAPPS.md), so maintenance scripts run from here with the
# server's firewall open for this machine only, and closed again on exit even
# if the script fails.
#
# Never use this to run `app.seed.run`: on a live database that creates demo
# accounts with published passwords and overwrites every certification, course,
# article and setting with the repo's seed JSON.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# shellcheck source=config.sh
. "$SCRIPT_DIR/config.sh"

cd "$REPO_ROOT"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <script-module> [args...]" >&2
  echo "Available:" >&2
  ls backend/scripts/*.py | sed 's#backend/scripts/#  #; s#\.py##' >&2
  exit 1
fi

MODULE="$1"
shift

if [ "$MODULE" = "app.seed.run" ] || [ "$MODULE" = "seed" ]; then
  echo "Refusing: the full seeder must not run against a live database." >&2
  echo "It creates demo accounts with published passwords and overwrites" >&2
  echo "content edited through Admin. Use a targeted script instead." >&2
  exit 1
fi

if [ ! -f "backend/scripts/${MODULE}.py" ]; then
  echo "No such script: backend/scripts/${MODULE}.py" >&2
  exit 1
fi

require_account
resolve_names

if [ -f .env.production ]; then
  load_env_file .env.production
fi

PG_PASSWORD="${POSTGRES_PASSWORD:-}"
if [ -z "$PG_PASSWORD" ]; then
  echo "POSTGRES_PASSWORD is not set. Put it in .env.production." >&2
  exit 1
fi

PG_FQDN="$(az_ postgres flexible-server show -g "$RESOURCE_GROUP" -n "$PG_NAME" \
  --query fullyQualifiedDomainName -o tsv | tr -d '\r')"
note "Database: $PG_FQDN/$PG_DATABASE"

MY_IP="$(curl -fsS --max-time 20 https://api.ipify.org || true)"
if [ -z "$MY_IP" ]; then
  echo "Could not determine this machine's public address." >&2
  exit 1
fi
RULE_NAME="script-$(date +%s)"
say "Allowing $MY_IP through the database firewall (rule $RULE_NAME)"
az_ postgres flexible-server firewall-rule create -g "$RESOURCE_GROUP" -s "$PG_NAME" \
  --name "$RULE_NAME" --start-ip-address "$MY_IP" --end-ip-address "$MY_IP" \
  --only-show-errors -o none

cleanup() {
  say "Removing firewall rule $RULE_NAME"
  az_ postgres flexible-server firewall-rule delete -g "$RESOURCE_GROUP" -s "$PG_NAME" \
    --name "$RULE_NAME" --yes --only-show-errors -o none 2>/dev/null || true
}
trap cleanup EXIT

PY="python"
if [ -x "backend/.venv/Scripts/python.exe" ]; then
  PY="./.venv/Scripts/python.exe"
elif [ -x "backend/.venv/bin/python" ]; then
  PY="./.venv/bin/python"
fi

say "Running scripts.${MODULE}"
(
  cd backend
  DATABASE_URL="postgresql+asyncpg://${PG_ADMIN_USER}:${PG_PASSWORD}@${PG_FQDN}:5432/${PG_DATABASE}?ssl=require" \
    "$PY" -m "scripts.${MODULE}" "$@"
)
