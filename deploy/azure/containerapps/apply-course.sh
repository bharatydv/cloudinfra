#!/usr/bin/env bash
#
# Apply one split-directory course to the managed database, and optionally
# publish it.
#
#   bash deploy/azure/containerapps/apply-course.sh <slug> --dry-run
#   bash deploy/azure/containerapps/apply-course.sh <slug>
#   bash deploy/azure/containerapps/apply-course.sh <slug> --publish
#   bash deploy/azure/containerapps/apply-course.sh <slug> --unpublish
#
# <slug> is a folder under database/seed/courses/, for example
# generative-ai-for-beginners or digital-marketing-beginner-to-advanced.
#
# This is the generic version of apply-genai-course.sh, which stays as it is.
#
# The seed directory is not in the backend image (see
# DEPLOY-AZURE-CONTAINERAPPS.md), so content is applied from here with the
# server's firewall briefly open, which is the documented route.
#
# It runs backend/scripts/apply_genai_course.py, which touches one course and
# nothing else. It deliberately does NOT run `python -m app.seed.run`: on a live
# database that would create demo accounts with published passwords and
# overwrite every certification, course, article and setting with the repo's
# seed JSON, discarding anything edited through Admin.
#
# Without --publish or --unpublish the script never changes is_published, so
# re-applying content cannot undo a decision made in Admin.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# shellcheck source=config.sh
. "$SCRIPT_DIR/config.sh"

cd "$REPO_ROOT"

COURSE_SLUG="${1:-}"
if [ -z "$COURSE_SLUG" ] || [ "${COURSE_SLUG:0:2}" = "--" ]; then
  echo "Usage: $0 <course-slug> [--dry-run] [--publish|--unpublish]" >&2
  echo "Available:" >&2
  ls -1 database/seed/courses >&2
  exit 1
fi
shift

if [ ! -d "database/seed/courses/$COURSE_SLUG" ]; then
  echo "No such course folder: database/seed/courses/$COURSE_SLUG" >&2
  echo "Available:" >&2
  ls -1 database/seed/courses >&2
  exit 1
fi

EXTRA=()
for arg in "$@"; do
  case "$arg" in
    --dry-run|--publish|--unpublish) EXTRA+=("$arg") ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

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
note "Course:   $COURSE_SLUG"

# --- Open the firewall for this machine, and always close it again ----------
MY_IP="$(curl -fsS --max-time 20 https://api.ipify.org || true)"
if [ -z "$MY_IP" ]; then
  echo "Could not determine this machine's public address." >&2
  exit 1
fi
RULE_NAME="apply-course-$(date +%s)"
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

say "Applying $COURSE_SLUG"
(
  cd backend
  DATABASE_URL="postgresql+asyncpg://${PG_ADMIN_USER}:${PG_PASSWORD}@${PG_FQDN}:5432/${PG_DATABASE}?ssl=require" \
    "$PY" -m scripts.apply_genai_course --course "$COURSE_SLUG" ${EXTRA[@]+"${EXTRA[@]}"}
)

case " ${EXTRA[*]-} " in
  *" --publish "*)
    note "Live at ${PUBLIC_SITE_URL:-https://inferacloud.com}/courses/$COURSE_SLUG"
    note "It also enters the sitemap, along with its free preview lessons." ;;
  *" --unpublish "*)
    note "Hidden again. Its URL now 404s." ;;
  *)
    note "Content applied. is_published was left as it is; publish with:"
    note "  bash deploy/azure/containerapps/apply-course.sh $COURSE_SLUG --publish" ;;
esac
