#!/usr/bin/env bash
#
# Apply the Generative AI for Beginners course to the managed database.
#
#   bash deploy/azure/containerapps/apply-genai-course.sh --dry-run
#   bash deploy/azure/containerapps/apply-genai-course.sh
#
# The seed directory is not in the backend image (see
# DEPLOY-AZURE-CONTAINERAPPS.md), so content is applied from here with the
# server's firewall briefly open, which is the documented route.
#
# This runs backend/scripts/apply_genai_course.py, which touches one course and
# nothing else. It deliberately does NOT run `python -m app.seed.run`: on a live
# database that would create demo accounts with published passwords and
# overwrite every certification, course, article and setting with the repo's
# seed JSON, discarding anything edited through Admin.
#
# The course is created unpublished. Publishing stays a separate decision, and
# re-running this never changes an is_published an operator has set.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# shellcheck source=config.sh
. "$SCRIPT_DIR/config.sh"

cd "$REPO_ROOT"

DRY_RUN=""
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN="--dry-run"
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

# --- Open the firewall for this machine, and always close it again ----------
MY_IP="$(curl -fsS --max-time 20 https://api.ipify.org || true)"
if [ -z "$MY_IP" ]; then
  echo "Could not determine this machine's public address." >&2
  exit 1
fi
RULE_NAME="genai-course-$(date +%s)"
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

# --- Apply ------------------------------------------------------------------
PY="python"
if [ -x "backend/.venv/Scripts/python.exe" ]; then
  PY="./.venv/Scripts/python.exe"
elif [ -x "backend/.venv/bin/python" ]; then
  PY="./.venv/bin/python"
fi

say "Applying the course${DRY_RUN:+ (dry run)}"
(
  cd backend
  DATABASE_URL="postgresql+asyncpg://${PG_ADMIN_USER}:${PG_PASSWORD}@${PG_FQDN}:5432/${PG_DATABASE}?ssl=require" \
    "$PY" -m scripts.apply_genai_course ${DRY_RUN}
)

note "Done. The course is unpublished; publish it from Admin, or with:"
note "  bash deploy/azure/containerapps/publish-genai-course.sh"
