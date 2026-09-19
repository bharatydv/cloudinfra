#!/usr/bin/env bash
#
# Provision and deploy Inferacloud to Azure Container Apps.
#
#   bash deploy/azure/containerapps/deploy.sh
#
# Idempotent: every resource is created only if absent, so re-running ships new
# images without disturbing the database, the uploads share or the hostname.
#
# The shape of it:
#
#   Internet
#      |  https://learnbase-web.<env>.centralindia.azurecontainerapps.io
#      v                                    (managed TLS, no Caddy needed)
#   Container App "learnbase-web"  -- one app, two containers sharing localhost
#      |- frontend  :80    nginx + React build, proxies /api -> 127.0.0.1:8000
#      |- backend   :8000  FastAPI, runs alembic on start
#      |                      |- /app/uploads  -> Azure Files share
#      v
#   Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
#
# One app rather than two is deliberate: the containers share a network
# namespace, so the frontend reaches the backend on localhost with no internal
# ingress, no service discovery and one set of replicas to pay for.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# shellcheck source=config.sh
. "$SCRIPT_DIR/config.sh"

cd "$REPO_ROOT"

require_account
resolve_names

say "Deploying to $RESOURCE_GROUP ($LOCATION), image tag $IMAGE_TAG"

# --- Prerequisites ----------------------------------------------------------
if ! az_ extension show --name containerapp >/dev/null 2>&1; then
  say "Installing the containerapp CLI extension"
  az_ extension add --name containerapp --only-show-errors
fi

for provider in Microsoft.App Microsoft.DBforPostgreSQL Microsoft.OperationalInsights; do
  state="$(az_ provider show -n "$provider" --query registrationState -o tsv 2>/dev/null | tr -d '\r')"
  if [ "$state" != "Registered" ]; then
    say "Registering $provider (this can take a few minutes)"
    az_ provider register -n "$provider" --wait
  fi
done

# --- Secrets ----------------------------------------------------------------
# Reuse whatever the VM deployment generated. Carrying JWT_SECRET across means
# sessions issued by the old deployment stay valid through the cutover; a fresh
# secret would sign everyone out the moment DNS moved.
if [ -f .env.production ]; then
  note "Reading app secrets from .env.production"
  load_env_file .env.production
fi

JWT_SECRET="${JWT_SECRET:-$(gen_secret 64)}"
PG_ADMIN_PASSWORD="${PG_ADMIN_PASSWORD:-${POSTGRES_PASSWORD:-$(gen_secret 40)}}"
SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.com}"
SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-$(gen_secret 24)}"
SEED_ADMIN_NAME="${SEED_ADMIN_NAME:-Platform Admin}"

# --- Resource group ---------------------------------------------------------
say "Resource group"
az_ group create -n "$RESOURCE_GROUP" -l "$LOCATION" --only-show-errors -o none
note "$RESOURCE_GROUP"

# --- Registry ---------------------------------------------------------------
say "Container registry"
if az_ acr show -n "$ACR_NAME" -g "$ACR_RESOURCE_GROUP" >/dev/null 2>&1; then
  note "Reusing $ACR_NAME (in $ACR_RESOURCE_GROUP)"
else
  note "Creating $ACR_NAME in $RESOURCE_GROUP"
  ACR_RESOURCE_GROUP="$RESOURCE_GROUP"
  az_ acr create -n "$ACR_NAME" -g "$ACR_RESOURCE_GROUP" -l "$LOCATION" \
    --sku Basic --admin-enabled true --only-show-errors -o none
fi
# Admin credentials are how Container Apps pulls. Managed identity would be
# tidier, but it needs an AcrPull role assignment, and this service principal
# is Contributor -- it cannot grant roles.
az_ acr update -n "$ACR_NAME" --admin-enabled true --only-show-errors -o none
ACR_SERVER="$(az_ acr show -n "$ACR_NAME" --query loginServer -o tsv | tr -d '\r')"
ACR_USER="$(az_ acr credential show -n "$ACR_NAME" --query username -o tsv | tr -d '\r')"
ACR_PASSWORD="$(az_ acr credential show -n "$ACR_NAME" --query 'passwords[0].value' -o tsv | tr -d '\r')"

# --- Database (slow, so it runs while the images build) ----------------------
PG_LOG="$(mktemp)"
pg_exists() { az_ postgres flexible-server show -g "$RESOURCE_GROUP" -n "$PG_NAME" >/dev/null 2>&1; }

if pg_exists; then
  say "Database $PG_NAME already exists"
  PG_PID=""
else
  say "Creating database $PG_NAME ($PG_TIER $PG_SKU, ${PG_STORAGE_GB}GB) in the background"
  (
    az_ postgres flexible-server create \
      -g "$RESOURCE_GROUP" -n "$PG_NAME" -l "$LOCATION" \
      --admin-user "$PG_ADMIN_USER" --admin-password "$PG_ADMIN_PASSWORD" \
      --tier "$PG_TIER" --sku-name "$PG_SKU" \
      --storage-size "$PG_STORAGE_GB" --version "$PG_VERSION" \
      --backup-retention "$PG_BACKUP_RETENTION_DAYS" \
      --public-access Enabled --yes --only-show-errors -o none
  ) > "$PG_LOG" 2>&1 &
  PG_PID=$!
fi

# --- Container Apps environment ---------------------------------------------
say "Container Apps environment"
if az_ containerapp env show -g "$RESOURCE_GROUP" -n "$ENV_NAME" >/dev/null 2>&1; then
  note "Reusing $ENV_NAME"
else
  az_ containerapp env create -g "$RESOURCE_GROUP" -n "$ENV_NAME" -l "$LOCATION" \
    --only-show-errors -o none
fi
ENV_ID="$(az_ containerapp env show -g "$RESOURCE_GROUP" -n "$ENV_NAME" --query id -o tsv | tr -d '\r')"
ENV_DOMAIN="$(az_ containerapp env show -g "$RESOURCE_GROUP" -n "$ENV_NAME" \
  --query properties.defaultDomain -o tsv | tr -d '\r')"

# The hostname is predictable from the environment, so the frontend can be
# built with its own final URL before the app that serves it exists.
APP_FQDN="${APP_NAME}.${ENV_DOMAIN}"
SITE_URL="https://${APP_FQDN}"
note "Site URL will be $SITE_URL"

# --- Uploads share ----------------------------------------------------------
say "Uploads storage"
if ! az_ storage account show -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" >/dev/null 2>&1; then
  az_ storage account create -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" -l "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 --only-show-errors -o none
fi
STORAGE_KEY="$(az_ storage account keys list -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" \
  --query '[0].value' -o tsv | tr -d '\r')"
az_ storage share-rm create --storage-account "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" \
  -n "$FILE_SHARE" --quota 5 --only-show-errors -o none 2>/dev/null || true

# Registering the share on the environment is what lets a container mount it.
az_ containerapp env storage set -g "$RESOURCE_GROUP" -n "$ENV_NAME" \
  --storage-name "$STORAGE_MOUNT" \
  --azure-file-account-name "$STORAGE_ACCOUNT" \
  --azure-file-account-key "$STORAGE_KEY" \
  --azure-file-share-name "$FILE_SHARE" \
  --access-mode ReadWrite --only-show-errors -o none

# --- Images -----------------------------------------------------------------
# Built by ACR Tasks rather than locally: no Docker daemon is needed, and the
# layers never cross the internet from here.
#
# Each build runs from inside its own context directory. az acr build resolves
# --file against the working directory but the context against what it uploads,
# so `-f Dockerfile .` from within the directory is the only spelling where
# both agree.
#
# --no-logs because the CLI cannot print them on Windows: the build log carries
# characters the console codepage has no mapping for, and streaming it fails a
# build that actually succeeded. The command still waits for the build and
# still reports failure; only the running commentary is lost. To read it:
#
#   az acr task logs -r <registry> --run-id <id>
#
# SKIP_BUILD=1 reuses the images already tagged IMAGE_TAG, which is what you
# want when re-running to fix something in the infrastructure rather than in
# the code -- a rebuild of both images is several minutes of nothing useful.
if [ "${SKIP_BUILD:-0}" = "1" ]; then
  say "Reusing images tagged ${IMAGE_TAG} (SKIP_BUILD=1)"
else
  say "Building backend image"
  ( cd backend && az_ acr build -r "$ACR_NAME" \
      -t "${BACKEND_REPO}:${IMAGE_TAG}" -t "${BACKEND_REPO}:latest" \
      -f Dockerfile . --no-logs --only-show-errors )

  say "Building frontend image"
  # VITE_* are compiled into the bundle, so the site URL is a build argument.
  ( cd frontend && az_ acr build -r "$ACR_NAME" \
      -t "${FRONTEND_REPO}:${IMAGE_TAG}" -t "${FRONTEND_REPO}:latest" \
      -f Dockerfile . --no-logs --only-show-errors \
      --build-arg "VITE_API_BASE_URL=/api" \
      --build-arg "VITE_SITE_URL=${SITE_URL}" )
fi

# --- Wait for the database --------------------------------------------------
if [ -n "${PG_PID:-}" ]; then
  say "Waiting for the database to finish provisioning"
  if ! wait "$PG_PID"; then
    echo "Database creation failed:" >&2
    cat "$PG_LOG" >&2
    exit 1
  fi
fi
rm -f "$PG_LOG"

say "Database access"
# `--public-access None` at create time is documented as "public access mode,
# no firewall rule", but this CLI version leaves publicNetworkAccess Disabled --
# and a disabled server rejects firewall rules outright with "Firewall rule
# operations are not supported for a server without public access enabled".
# Setting it explicitly is idempotent and makes the outcome the same either way.
PG_ACCESS="$(az_ postgres flexible-server show -g "$RESOURCE_GROUP" -n "$PG_NAME" \
  --query network.publicNetworkAccess -o tsv | tr -d '\r')"
if [ "$PG_ACCESS" != "Enabled" ]; then
  note "Enabling public network access (currently ${PG_ACCESS:-unknown})"
  az_ postgres flexible-server update -g "$RESOURCE_GROUP" -n "$PG_NAME" \
    --public-access Enabled --only-show-errors -o none
fi

# Container Apps egress leaves from the environment's static outbound address,
# so the firewall is opened to exactly that rather than to all of Azure.
OUTBOUND_IPS="$(az_ containerapp env show -g "$RESOURCE_GROUP" -n "$ENV_NAME" \
  --query 'properties.staticIp' -o tsv 2>/dev/null | tr -d '\r')"
if [ -n "$OUTBOUND_IPS" ] && [ "$OUTBOUND_IPS" != "None" ]; then
  note "Allowing the environment's address $OUTBOUND_IPS"
  az_ postgres flexible-server firewall-rule create -g "$RESOURCE_GROUP" -s "$PG_NAME" \
    --name containerapps-env --start-ip-address "$OUTBOUND_IPS" \
    --end-ip-address "$OUTBOUND_IPS" --only-show-errors -o none
fi
# Consumption workloads can also egress from other addresses in the environment
# as it scales, so the Azure-services rule is what actually keeps it reachable.
az_ postgres flexible-server firewall-rule create -g "$RESOURCE_GROUP" -s "$PG_NAME" \
  --name allow-azure-services --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 --only-show-errors -o none

# Checked rather than create-and-ignore-errors: swallowing the failure here
# gets you a running server with no application database, and the only symptom
# is the app crashlooping on InvalidCatalogNameError several minutes later.
if ! az_ postgres flexible-server db list -g "$RESOURCE_GROUP" -s "$PG_NAME" \
     --query "[].name" -o tsv 2>/dev/null | tr -d '\r' | grep -qx "$PG_DATABASE"; then
  note "Creating database $PG_DATABASE"
  # -n names the database here; -s names the server. There is no -d.
  az_ postgres flexible-server db create -g "$RESOURCE_GROUP" -s "$PG_NAME" \
    -n "$PG_DATABASE" --only-show-errors -o none
fi

PG_HOST="$(az_ postgres flexible-server show -g "$RESOURCE_GROUP" -n "$PG_NAME" \
  --query fullyQualifiedDomainName -o tsv | tr -d '\r')"
# sslmode=require: Flexible Server refuses unencrypted connections, and asyncpg
# will not negotiate TLS unless it is asked to.
DATABASE_URL="postgresql+asyncpg://${PG_ADMIN_USER}:${PG_ADMIN_PASSWORD}@${PG_HOST}:5432/${PG_DATABASE}?ssl=require"

# --- The app ----------------------------------------------------------------
say "Container app"
SPEC="$(mktemp --suffix=.yaml)"
# The CLI is a Windows program and MSYS_NO_PATHCONV stops Git Bash rewriting
# paths for it, so a POSIX /tmp path has to be converted by hand or az reports
# the file does not exist.
spec_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s' "$1"
  fi
}
cat > "$SPEC" <<YAML
location: ${LOCATION}
type: Microsoft.App/containerApps
properties:
  managedEnvironmentId: ${ENV_ID}
  configuration:
    activeRevisionsMode: Single
    ingress:
      external: true
      targetPort: 80
      transport: auto
      allowInsecure: false
    secrets:
      - name: database-url
        value: "${DATABASE_URL}"
      - name: jwt-secret
        value: "${JWT_SECRET}"
      - name: seed-admin-password
        value: "${SEED_ADMIN_PASSWORD}"
      - name: acr-password
        value: "${ACR_PASSWORD}"
    registries:
      - server: ${ACR_SERVER}
        username: ${ACR_USER}
        passwordSecretRef: acr-password
  template:
    containers:
      - name: backend
        image: ${ACR_SERVER}/${BACKEND_REPO}:${IMAGE_TAG}
        command: ["/bin/sh"]
        args:
          - "-c"
          - "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"
        resources:
          cpu: ${BACKEND_CPU}
          memory: ${BACKEND_MEMORY}
        env:
          - name: ENVIRONMENT
            value: production
          - name: DEBUG
            value: "false"
          - name: DATABASE_URL
            secretRef: database-url
          - name: JWT_SECRET
            secretRef: jwt-secret
          - name: SEED_ADMIN_PASSWORD
            secretRef: seed-admin-password
          - name: SEED_ADMIN_EMAIL
            value: "${SEED_ADMIN_EMAIL}"
          - name: SEED_ADMIN_NAME
            value: "${SEED_ADMIN_NAME}"
          - name: PUBLIC_SITE_URL
            value: "${SITE_URL}"
          - name: FRONTEND_URL
            value: "${SITE_URL}"
          - name: BACKEND_CORS_ORIGINS
            value: "${SITE_URL}"
          - name: API_V1_PREFIX
            value: /api
          - name: RATE_LIMIT_ENABLED
            value: "true"
          - name: EMAIL_PROVIDER
            value: "${EMAIL_PROVIDER:-console}"
          - name: EMAIL_FROM_ADDRESS
            value: "${EMAIL_FROM_ADDRESS:-no-reply@example.com}"
          - name: EMAIL_FROM_NAME
            value: "${EMAIL_FROM_NAME:-Inferacloud}"
          - name: SALES_NOTIFICATION_EMAIL
            value: "${SALES_NOTIFICATION_EMAIL:-}"
          - name: PAYMENT_PROVIDER
            value: "${PAYMENT_PROVIDER:-noop}"
          - name: PAYMENT_CURRENCY
            value: "${PAYMENT_CURRENCY:-USD}"
          - name: STORAGE_PROVIDER
            value: local
        volumeMounts:
          - volumeName: uploads
            mountPath: /app/uploads
      - name: frontend
        image: ${ACR_SERVER}/${FRONTEND_REPO}:${IMAGE_TAG}
        resources:
          cpu: ${FRONTEND_CPU}
          memory: ${FRONTEND_MEMORY}
        env:
          # Both containers share a network namespace, so the API is on
          # localhost rather than behind a service name.
          - name: BACKEND_ORIGIN
            value: http://127.0.0.1:8000
    scale:
      minReplicas: ${MIN_REPLICAS}
      maxReplicas: ${MAX_REPLICAS}
    volumes:
      - name: uploads
        storageType: AzureFile
        storageName: ${STORAGE_MOUNT}
YAML

if az_ containerapp show -g "$RESOURCE_GROUP" -n "$APP_NAME" >/dev/null 2>&1; then
  note "Updating $APP_NAME"
  az_ containerapp update -g "$RESOURCE_GROUP" -n "$APP_NAME" --yaml "$(spec_path "$SPEC")" \
    --only-show-errors -o none
else
  note "Creating $APP_NAME"
  az_ containerapp create -g "$RESOURCE_GROUP" -n "$APP_NAME" --yaml "$(spec_path "$SPEC")" \
    --only-show-errors -o none
fi
rm -f "$SPEC"

# --- Record what was generated ----------------------------------------------
# Written after success so a failed run cannot leave a file claiming secrets
# that were never applied. Gitignored by the .env.* rule.
cat > "$ENV_FILE" <<ENVEOF
# Written by deploy/azure/containerapps/deploy.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ).
# Secrets for the Container Apps deployment. Not committed; keep it safe.
SITE_URL=${SITE_URL}
RESOURCE_GROUP=${RESOURCE_GROUP}
PG_NAME=${PG_NAME}
PG_HOST=${PG_HOST}
PG_ADMIN_USER=${PG_ADMIN_USER}
PG_ADMIN_PASSWORD=${PG_ADMIN_PASSWORD}
PG_DATABASE=${PG_DATABASE}
JWT_SECRET=${JWT_SECRET}
SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL}
SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}
STORAGE_ACCOUNT=${STORAGE_ACCOUNT}
ACR_SERVER=${ACR_SERVER}
IMAGE_TAG=${IMAGE_TAG}
ENVEOF
chmod 600 "$ENV_FILE" 2>/dev/null || true

FQDN="$(az_ containerapp show -g "$RESOURCE_GROUP" -n "$APP_NAME" \
  --query properties.configuration.ingress.fqdn -o tsv | tr -d '\r')"

say "Deployed"
note "URL:       https://${FQDN}"
note "Database:  ${PG_HOST}"
note "Secrets:   ${ENV_FILE}"
note ""
note "Migrate the live database across with:"
note "  bash deploy/azure/containerapps/migrate-data.sh"
