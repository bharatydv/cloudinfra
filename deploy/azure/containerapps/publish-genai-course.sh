#!/usr/bin/env bash
#
# Publish (or unpublish) the Generative AI for Beginners course.
#
#   bash deploy/azure/containerapps/publish-genai-course.sh          # publish
#   bash deploy/azure/containerapps/publish-genai-course.sh --off    # unpublish
#
# Publishing is deliberately separate from applying the content: it is the
# moment the course becomes visible in the catalogue and enters the sitemap,
# and it is trivially reversible. apply-genai-course.sh never changes this
# flag, so re-applying content does not undo a decision made here.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# shellcheck source=config.sh
. "$SCRIPT_DIR/config.sh"

cd "$REPO_ROOT"

PUBLISH="true"
[ "${1:-}" = "--off" ] && PUBLISH="false"

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

MY_IP="$(curl -fsS --max-time 20 https://api.ipify.org || true)"
if [ -z "$MY_IP" ]; then
  echo "Could not determine this machine's public address." >&2
  exit 1
fi
RULE_NAME="publish-genai-$(date +%s)"
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

say "Setting is_published=$PUBLISH"
(
  cd backend
  DATABASE_URL="postgresql+asyncpg://${PG_ADMIN_USER}:${PG_PASSWORD}@${PG_FQDN}:5432/${PG_DATABASE}?ssl=require" \
  PUBLISH_FLAG="$PUBLISH" \
    "$PY" - <<'PY'
import asyncio
import os

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.catalog import Course

SLUG = "generative-ai-for-beginners"
WANT = os.environ["PUBLISH_FLAG"] == "true"


async def main() -> None:
    async with SessionLocal() as db:
        course = await db.scalar(select(Course).where(Course.slug == SLUG))
        if course is None:
            raise SystemExit(
                f"{SLUG} is not in this database. "
                "Run apply-genai-course.sh first."
            )
        if course.is_published == WANT:
            print(f"  already is_published={WANT}; nothing to do")
            return
        course.is_published = WANT
        await db.commit()
        print(f"  is_published set to {WANT}")


asyncio.run(main())
PY
)

if [ "$PUBLISH" = "true" ]; then
  note "Live at ${PUBLIC_SITE_URL:-https://inferacloud.com}/courses/generative-ai-for-beginners"
  note "It also enters the sitemap, along with its 9 free preview lessons."
else
  note "The course is hidden again. Its URL now 404s."
fi
