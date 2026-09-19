#!/usr/bin/env bash
#
# Ship code to an already-provisioned Container Apps deployment.
#
#   bash deploy/azure/containerapps/redeploy.sh
#
# Rebuilds both images and points the app at them. Nothing is provisioned, so
# the database, the uploads share and the hostname are untouched.
#
# To roll back, redeploy an older tag rather than rebuilding:
#
#   IMAGE_TAG=20260918-233816 bash deploy/azure/containerapps/redeploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# shellcheck source=config.sh
. "$SCRIPT_DIR/config.sh"

cd "$REPO_ROOT"

require_account
resolve_names

if ! az_ containerapp show -g "$RESOURCE_GROUP" -n "$APP_NAME" >/dev/null 2>&1; then
  echo "$APP_NAME does not exist in $RESOURCE_GROUP. Run deploy.sh first." >&2
  exit 1
fi

ACR_SERVER="$(az_ acr show -n "$ACR_NAME" --query loginServer -o tsv | tr -d '\r')"
SITE_URL="https://$(az_ containerapp show -g "$RESOURCE_GROUP" -n "$APP_NAME" \
  --query properties.configuration.ingress.fqdn -o tsv | tr -d '\r')"

BACKEND_IMAGE="${ACR_SERVER}/${BACKEND_REPO}:${IMAGE_TAG}"
FRONTEND_IMAGE="${ACR_SERVER}/${FRONTEND_REPO}:${IMAGE_TAG}"

# Only build when the tag is new. An explicit IMAGE_TAG that already exists is
# a rollback, and rebuilding it would defeat the point.
if az_ acr repository show-tags -n "$ACR_NAME" --repository "$BACKEND_REPO" \
     --query "contains(@, '${IMAGE_TAG}')" -o tsv 2>/dev/null | grep -qi true; then
  say "Reusing existing images tagged ${IMAGE_TAG}"
else
  # Each build runs from inside its own context directory: az acr build
  # resolves --file against the working directory but the context against what
  # it uploads, so `-f Dockerfile .` is the only spelling where both agree.
  #
  # --no-logs because the CLI cannot print them on Windows -- the build log
  # carries characters the console codepage cannot encode, which fails a build
  # that actually succeeded. Read them with `az acr task logs -r <registry>`.
  say "Building backend image"
  ( cd backend && az_ acr build -r "$ACR_NAME" \
      -t "${BACKEND_REPO}:${IMAGE_TAG}" -t "${BACKEND_REPO}:latest" \
      -f Dockerfile . --no-logs --only-show-errors )

  say "Building frontend image"
  ( cd frontend && az_ acr build -r "$ACR_NAME" \
      -t "${FRONTEND_REPO}:${IMAGE_TAG}" -t "${FRONTEND_REPO}:latest" \
      -f Dockerfile . --no-logs --only-show-errors \
      --build-arg "VITE_API_BASE_URL=/api" \
      --build-arg "VITE_SITE_URL=${SITE_URL}" )
fi

# One update per container: --image on its own would be ambiguous in a
# multi-container app.
say "Rolling out"
az_ containerapp update -g "$RESOURCE_GROUP" -n "$APP_NAME" \
  --container-name backend --image "$BACKEND_IMAGE" --only-show-errors -o none
az_ containerapp update -g "$RESOURCE_GROUP" -n "$APP_NAME" \
  --container-name frontend --image "$FRONTEND_IMAGE" --only-show-errors -o none

say "Deployed ${IMAGE_TAG}"
note "$SITE_URL"
note ""
note "Traffic shifts to the new revision once it reports healthy; the previous"
note "one keeps serving until then, so a failed start is not an outage."
