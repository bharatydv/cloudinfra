#!/usr/bin/env bash
#
# Ship the current working tree to the running VM.
#
# Images are built on the VM itself, so there is no container registry to pay
# for. The backend's start command is `alembic upgrade head && uvicorn ...`,
# so every rollout applies pending migrations before serving traffic.
#
#   SUBSCRIPTION_ID=<id> bash deploy/azure/redeploy.sh
#
# Set SEED=1 to load the demo catalogue once the API is healthy.

set -euo pipefail

cd "$(dirname "$0")/../.."
. deploy/azure/config.sh

require_account

FQDN="$(vm_fqdn)"
if [ -z "$FQDN" ]; then
  echo "No VM found in ${RESOURCE_GROUP}. Run: bash deploy/azure/deploy.sh" >&2
  exit 1
fi

if [ ! -f .env.production ]; then
  echo ".env.production is missing. Run: bash deploy/azure/deploy.sh" >&2
  exit 1
fi

REMOTE="${ADMIN_USER}@${FQDN}"

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  # The upload is the working tree, not a commit — say so, so the deploy is
  # never mistaken for a clean checkout.
  echo "note: working tree has uncommitted changes; they are included"
fi

# ---------------------------------------------------------------------------
# Package. Anything rebuilt inside the image, or holding state that lives on
# the VM, is left out — without this the upload is hundreds of megabytes of
# node_modules.
# ---------------------------------------------------------------------------
say "Packaging the source tree"

ARCHIVE="$(mktemp -t learnbase-XXXXXX.tgz)"
trap 'rm -f "$ARCHIVE"' EXIT

tar -czf "$ARCHIVE" \
  --exclude './frontend/node_modules' --exclude './frontend/node_modules/*' \
  --exclude './frontend/dist'         --exclude './frontend/dist/*' \
  --exclude './backend/.venv'         --exclude './backend/.venv/*' \
  --exclude './backend/uploads'       --exclude './backend/uploads/*' \
  --exclude './.git'                  --exclude './.git/*' \
  --exclude './backups'               --exclude './backups/*' \
  --exclude './.env' \
  --exclude './.env.production' \
  --exclude '*/__pycache__'   --exclude '*/__pycache__/*' \
  --exclude '*/.pytest_cache' --exclude '*/.pytest_cache/*' \
  --exclude '*/.ruff_cache'   --exclude '*/.ruff_cache/*' \
  --exclude '*/.mypy_cache'   --exclude '*/.mypy_cache/*' \
  -C . .

echo "    $(du -h "$ARCHIVE" | cut -f1)"

# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------
say "Uploading to ${FQDN}"
scp -o StrictHostKeyChecking=accept-new -q "$ARCHIVE"       "${REMOTE}:/tmp/learnbase.tgz"
scp -o StrictHostKeyChecking=accept-new -q .env.production  "${REMOTE}:/tmp/learnbase.env"

# ---------------------------------------------------------------------------
# Build and roll forward. The .env is moved into place after extraction so the
# archive can never overwrite it, and chmod 600 keeps the secrets readable only
# by the deploy user. The sed strips CRLF in case a script was checked out on
# Windows, which would otherwise make bash fail on the shebang line.
# ---------------------------------------------------------------------------
say "Building and starting on the VM"

SEED_FLAG=""
if [ "$SEED" = "1" ]; then
  SEED_FLAG=" --seed"
fi

ssh -o StrictHostKeyChecking=accept-new "$REMOTE" 'bash -s' <<REMOTEEOF
set -euo pipefail
mkdir -p "${APP_DIR}"
tar -xzf /tmp/learnbase.tgz -C "${APP_DIR}"
rm -f /tmp/learnbase.tgz
mv /tmp/learnbase.env "${APP_DIR}/.env"
chmod 600 "${APP_DIR}/.env"
sed -i 's/\r\$//' "${APP_DIR}/deploy/azure/remote-deploy.sh"
bash "${APP_DIR}/deploy/azure/remote-deploy.sh"${SEED_FLAG}
REMOTEEOF

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
say "Verifying"
# Caddy obtains the certificate on first start, so allow for that on a new VM.
CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 90 "https://${FQDN}/api/health" || echo failed)"
echo "    https://${FQDN}/api/health -> ${CODE}"

if [ "$CODE" != "200" ]; then
  echo "    not healthy yet — on a first deploy the certificate can take a minute." >&2
  echo "    check: ssh ${REMOTE} 'cd ${APP_DIR} && docker compose -f ${COMPOSE_FILE} logs --tail 50'" >&2
  exit 1
fi

say "Live at https://${FQDN}"

cat <<TXT

    Site:  https://${FQDN}
    API:   https://${FQDN}/api/health
    Docs:  https://${FQDN}/docs

    Logs:
      ssh ${REMOTE} 'cd ${APP_DIR} && docker compose -f ${COMPOSE_FILE} logs -f'

    Ship new code:
      SUBSCRIPTION_ID=\${SUBSCRIPTION_ID} bash deploy/azure/redeploy.sh

    Backups: a nightly pg_dump runs at 03:30 on the VM, 14-day retention, in
    ${APP_DIR}/backups. They sit on the same disk as the database, so copy
    them off the box before this holds data you would miss.

    Cost: roughly \$20-25/month — the VM, its disk and a static IP. Postgres
    runs on the VM, so there is no database bill. Tear it all down with:
      az group delete -n ${RESOURCE_GROUP}

TXT
