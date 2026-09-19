#!/usr/bin/env bash
#
# Shared settings for the Azure Container Apps deployment. Sourced by deploy.sh,
# redeploy.sh and migrate-data.sh; every value can be overridden from the
# environment, e.g.
#
#   MIN_REPLICAS=0 bash deploy/azure/containerapps/deploy.sh
#
# This is the container variant of the single-VM deployment in ../. The two are
# independent: they use different resource groups and can run side by side,
# which is how a cutover is verified before the VM is switched off.

# Container Apps and the existing registry both live here. Note this is a
# different region from the VM deployment (indiasouthcentral) -- putting the
# app next to the registry it pulls from avoids a cross-region image pull on
# every cold start.
LOCATION="${LOCATION:-centralindia}"

SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-6db0f523-d451-4746-9910-b5997d75506a}"

# Its own group, so tearing the container deployment down cannot touch the VM.
RESOURCE_GROUP="${RESOURCE_GROUP:-learnbase-aca-rg}"

ENV_NAME="${ENV_NAME:-learnbase-env}"
APP_NAME="${APP_NAME:-learnbase-web}"

# Registry. Reuses the Basic registry another project already pays for, because
# a second Basic registry is ~$5/month for the same 10 GiB. The repository
# names keep this project's images distinct inside it. Set ACR_NAME to a name
# that does not exist yet and deploy.sh creates a dedicated one instead.
ACR_NAME="${ACR_NAME:-gcpprep6db0f523d451}"
ACR_RESOURCE_GROUP="${ACR_RESOURCE_GROUP:-gcpprep-rg}"
BACKEND_REPO="${BACKEND_REPO:-learnbase-backend}"
FRONTEND_REPO="${FRONTEND_REPO:-learnbase-frontend}"
# Overridden per deploy so a rollback is just a redeploy at an older tag.
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"

# --- Database ---------------------------------------------------------------
# Burstable B1ms is the cheapest managed tier. It is the same class of hardware
# as the VM this replaces, but with automated backups and patching, which is
# the whole reason for paying for a managed database rather than running the
# container ourselves.
PG_NAME="${PG_NAME:-}"            # derived from the subscription id when empty
PG_TIER="${PG_TIER:-Burstable}"
PG_SKU="${PG_SKU:-Standard_B1ms}"
PG_STORAGE_GB="${PG_STORAGE_GB:-32}"
PG_VERSION="${PG_VERSION:-16}"
PG_ADMIN_USER="${PG_ADMIN_USER:-learnbase}"
PG_DATABASE="${PG_DATABASE:-learnbase}"
# Shortest retention the service offers. Longer costs more and this database is
# reconstructible from the seed plus whatever has been submitted since.
PG_BACKUP_RETENTION_DAYS="${PG_BACKUP_RETENTION_DAYS:-7}"

# --- Uploads ----------------------------------------------------------------
# A container's filesystem does not survive a restart, so media uploads need a
# share mounted into the backend. Without this, every revision silently loses
# whatever an admin uploaded.
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-}"   # derived when empty
FILE_SHARE="${FILE_SHARE:-uploads}"
STORAGE_MOUNT="${STORAGE_MOUNT:-uploads}"

# --- Sizing -----------------------------------------------------------------
# Container Apps bills per vCPU-second while a replica is running, so these two
# settings are the whole bill.
#
#   MIN_REPLICAS=1  keeps the site warm. Roughly $30/month at this size.
#   MIN_REPLICAS=0  scales to zero when idle and costs almost nothing, at the
#                   price of a cold start (~15-30s, including alembic) on the
#                   first request after a quiet period.
#
# 1 is the default because this is a live marketing site running a campaign,
# and a cold start on a discount landing page is a lost lead.
MIN_REPLICAS="${MIN_REPLICAS:-1}"
MAX_REPLICAS="${MAX_REPLICAS:-3}"

# Totals across both containers must be a combination Container Apps allows;
# 0.25+0.25 vCPU and 0.5+0.5 GiB sums to the valid 0.5 vCPU / 1.0 GiB.
BACKEND_CPU="${BACKEND_CPU:-0.25}"
BACKEND_MEMORY="${BACKEND_MEMORY:-0.5Gi}"
FRONTEND_CPU="${FRONTEND_CPU:-0.25}"
FRONTEND_MEMORY="${FRONTEND_MEMORY:-0.5Gi}"

# --- The VM this replaces ---------------------------------------------------
# Only used by migrate-data.sh, to pull the live database across.
VM_RESOURCE_GROUP="${VM_RESOURCE_GROUP:-learnbase-rg}"
VM_NAME="${VM_NAME:-learnbase-vm}"

SEED="${SEED:-0}"

# Resolve the Azure CLI. The Windows installer does not reliably put az on PATH
# for non-login shells, so fall back to the known install locations.
#
# Test with -f, not -x: the installer ships wbin/az.cmd as mode 644, so an
# executable-bit test rejects a perfectly working CLI.
AZ=""
if command -v az >/dev/null 2>&1; then
  AZ="az"
else
  for _candidate in \
    "/c/Program Files/Microsoft SDKs/Azure/CLI2/wbin/az" \
    "/c/Program Files (x86)/Microsoft SDKs/Azure/CLI2/wbin/az" \
    "/c/Program Files/Microsoft SDKs/Azure/CLI2/wbin/az.cmd" \
    "/c/Program Files (x86)/Microsoft SDKs/Azure/CLI2/wbin/az.cmd"
  do
    if [ -f "$_candidate" ]; then
      AZ="$_candidate"
      break
    fi
  done
fi

if [ -z "$AZ" ]; then
  echo "Azure CLI not found. Install it: https://aka.ms/installazurecli" >&2
  exit 1
fi

# Git Bash rewrites arguments that look like Unix paths into Windows ones
# before exec. That turns `--build-arg VITE_API_BASE_URL=/api` into
# `...=C:/Program Files/Git/api`, and the space splits the argument in two --
# which reaches ACR as a docker build with two positional arguments and fails
# with the memorably unhelpful `"docker build" requires exactly 1 argument`.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

# The CLI is Python, and on Windows its stdout defaults to the ANSI codepage.
# `az acr build` streams the image build log through it, and npm's output
# contains characters cp1252 cannot encode -- so a build that succeeded
# remotely still fails locally with a UnicodeEncodeError while printing it.
export PYTHONIOENCODING="${PYTHONIOENCODING:-utf-8}"
export PYTHONUTF8="${PYTHONUTF8:-1}"

az_() { "$AZ" "$@"; }

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
note() { printf '    %s\n' "$*"; }

require_account() {
  if ! az_ account show >/dev/null 2>&1; then
    echo "Not signed in. Run: az login" >&2
    echo "Interactive login is blocked by Conditional Access on this tenant;" >&2
    echo "sign in with the learnbase-deploy service principal instead." >&2
    exit 1
  fi
  if [ -n "$SUBSCRIPTION_ID" ]; then
    az_ account set --subscription "$SUBSCRIPTION_ID"
  fi
}

# Names for globally-unique resources are derived from the subscription id, so
# re-running picks the same ones rather than stranding what is already there.
name_suffix() {
  local sub
  sub="$(az_ account show --query id -o tsv | tr -d '\r-')"
  printf '%s' "${sub:0:12}"
}

resolve_names() {
  local suffix
  suffix="$(name_suffix)"
  [ -z "$PG_NAME" ] && PG_NAME="learnbase-pg-${suffix}"
  # Storage account names are 3-24 chars, lowercase alphanumeric only.
  [ -z "$STORAGE_ACCOUNT" ] && STORAGE_ACCOUNT="learnbase${suffix}"
  STORAGE_ACCOUNT="$(printf '%s' "$STORAGE_ACCOUNT" | tr -cd 'a-z0-9' | cut -c1-24)"
}

# Read a KEY=VALUE env file without sourcing it.
#
# Sourcing is wrong here: these files are written for docker compose, which
# treats the whole of the line after "=" as a literal value, so an unquoted
# `SEED_ADMIN_NAME=Platform Admin` is perfectly valid there and a syntax error
# to the shell -- it tries to run `Admin`.
#
# Values already present in the environment win, so an explicit override on the
# command line still beats whatever the file says.
load_env_file() {
  local file="$1" line key value
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    # These files are written on Windows and are CRLF, so every value would
    # otherwise carry a trailing carriage return. That is invisible in a diff
    # and fatal in use: `PAYMENT_PROVIDER=noop\r` fails the Literal['noop', ...]
    # check in the app's settings, and the container crashloops on startup.
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
    case "$line" in *=*) ;; *) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    # Trailing whitespace is never meaningful in these values either.
    value="${value%"${value##*[![:space:]]}"}"
    # Ignore anything that is not a plain shell identifier.
    case "$key" in ''|*[!A-Za-z0-9_]*) continue ;; esac
    # Strip one layer of matching quotes, as compose does.
    case "$value" in
      \"*\") value="${value#\"}"; value="${value%\"}" ;;
      \'*\') value="${value#\'}"; value="${value%\'}" ;;
    esac
    if [ -z "${!key+x}" ]; then
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < "$file"
}

# URL-safe random string. openssl is used when present because reading
# /dev/urandom through a pipe trips pipefail when the reader exits early.
gen_secret() {
  local n="${1:-48}" raw
  if command -v openssl >/dev/null 2>&1; then
    raw="$(openssl rand -base64 $((n * 2)) | tr -dc 'A-Za-z0-9')"
  else
    raw="$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | dd bs=1 count=$((n * 2)) 2>/dev/null)"
  fi
  printf '%s' "${raw:0:n}"
}

# Where generated secrets are kept between runs, so a redeploy does not
# invalidate every session by rotating JWT_SECRET. Gitignored via .env.*
ENV_FILE="${ENV_FILE:-.env.containerapps}"
