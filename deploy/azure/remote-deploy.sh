#!/usr/bin/env bash
# Runs on the Azure VM, invoked by redeploy.sh. Builds the images from the
# source that was just uploaded and rolls the stack forward.
set -euo pipefail

APP_DIR=/opt/learnbase
COMPOSE=(docker compose -f docker-compose.prod.yml)
SEED=0

for arg in "$@"; do
  case "$arg" in
    --seed) SEED=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "ERROR: $APP_DIR/.env is missing. redeploy.sh should have uploaded it." >&2
  exit 1
fi

echo "==> Building images (the frontend build is the slow part)"
"${COMPOSE[@]}" build

echo "==> Starting the stack"
# The backend's own command runs 'alembic upgrade head' before uvicorn, so
# migrations are applied here as part of the rollout.
"${COMPOSE[@]}" up -d --remove-orphans

if [ "$SEED" -eq 1 ]; then
  echo "==> Waiting for the API to become healthy before seeding"
  for _ in $(seq 1 60); do
    if "${COMPOSE[@]}" exec -T backend curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
      break
    fi
    sleep 5
  done
  echo "==> Seeding demo content"
  "${COMPOSE[@]}" exec -T backend python -m app.seed.run
fi

echo "==> Installing the nightly backup cron job"
# Idempotent: the grep -v drops any previous version of the line first, so
# re-deploying never stacks up duplicate jobs.
sed -i 's/\r$//' "$APP_DIR/deploy/azure/backup.sh"
chmod +x "$APP_DIR/deploy/azure/backup.sh"
mkdir -p "$APP_DIR/backups"
CRON_LINE="30 3 * * * $APP_DIR/deploy/azure/backup.sh >> $APP_DIR/backups/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -Fv 'deploy/azure/backup.sh' || true; echo "$CRON_LINE" ) | crontab -

echo "==> Reclaiming disk from superseded image layers"
docker image prune -f >/dev/null

echo "==> Current state"
"${COMPOSE[@]}" ps
