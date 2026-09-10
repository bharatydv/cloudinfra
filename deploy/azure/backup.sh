#!/usr/bin/env bash
# Nightly database dump. Installed as a cron job by remote-deploy.sh.
#
# Postgres runs as a container on this VM, so nothing backs it up for us.
# Dumps land on the OS disk, which means they survive a container or volume
# rebuild but NOT losing the VM -- pair this with Azure Backup, or copy the
# dumps off-box, before you have users who would miss the data.
set -euo pipefail

APP_DIR=/opt/learnbase
BACKUP_DIR="$APP_DIR/backups"
RETENTION_DAYS=14

cd "$APP_DIR"

# The credentials live in .env; read just the two keys rather than sourcing the
# whole file, so a value with shell metacharacters can't be executed.
read_env() {
  local key="$1" fallback="$2" value
  value="$(grep -E "^${key}=" .env 2>/dev/null | head -n1 | cut -d= -f2- || true)"
  if [ -z "$value" ]; then printf '%s' "$fallback"; else printf '%s' "$value"; fi
}

PG_USER="$(read_env POSTGRES_USER learnbase)"
PG_DB="$(read_env POSTGRES_DB learnbase)"

mkdir -p "$BACKUP_DIR"

stamp="$(date +%Y-%m-%d-%H%M)"
target="$BACKUP_DIR/learnbase-$stamp.sql.gz"

echo "[$(date --iso-8601=seconds)] dumping $PG_DB -> $target"

# --no-owner keeps the dump restorable into a database with a different role.
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump --username "$PG_USER" --no-owner "$PG_DB" | gzip > "$target"

# A pg_dump that fails mid-stream still leaves a valid gzip of a partial dump,
# so check for the marker pg_dump writes last before trusting this one.
if ! gzip -dc "$target" | tail -n 5 | grep -q 'PostgreSQL database dump complete'; then
  echo "ERROR: dump looks truncated, keeping it but skipping the prune" >&2
  mv "$target" "$target.suspect"
  exit 1
fi

size="$(du -h "$target" | cut -f1)"
echo "[$(date --iso-8601=seconds)] ok ($size)"

# Only prune once a good dump exists, so a run of failures can never leave you
# with no backups at all.
find "$BACKUP_DIR" -name 'learnbase-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
