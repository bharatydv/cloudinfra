#!/usr/bin/env bash
#
# Shared settings for the Azure deployment. Sourced by deploy.sh and
# redeploy.sh; every value can be overridden from the environment, e.g.
#
#   LOCATION=westeurope bash deploy/azure/deploy.sh

# Matches the region the other projects deploy into.
LOCATION="${LOCATION:-centralindia}"

# Which subscription to deploy into. Leave empty to use whichever one the CLI
# has active. Set it when the account has several — this account has two named
# "Azure subscription 1", and the active one is not necessarily the intended
# one, so pinning the id is the only way to be sure of what gets billed.
SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-}"

RESOURCE_GROUP="${RESOURCE_GROUP:-learnbase-rg}"
VM_NAME="${VM_NAME:-learnbase-vm}"
ADMIN_USER="${ADMIN_USER:-azureuser}"

# Ubuntu 24.04 LTS. cloud-init.yaml installs Docker on first boot.
VM_IMAGE="${VM_IMAGE:-Ubuntu2404}"

# Standard_B1ms = 1 vCPU / 2 GiB, the smallest size that can build the frontend
# (with the 4 GiB swap file cloud-init adds). Standard_B2ls_v2 (2 vCPU / 4 GiB)
# costs roughly twice as much and builds much faster.
VM_SIZE="${VM_SIZE:-Standard_B1ms}"

# StandardSSD is about half the price of the Premium default and ample for a
# stack whose hot data lives in the Postgres page cache.
OS_DISK_SKU="${OS_DISK_SKU:-StandardSSD_LRS}"
OS_DISK_GB="${OS_DISK_GB:-30}"

# DNS labels are global within a region. A suffix is derived from the
# subscription id on first run so that re-running picks the same hostname
# rather than stranding the old one. Set DNS_LABEL to pin your own.
DNS_LABEL="${DNS_LABEL:-}"

# Where the stack lives on the VM. cloud-init creates it.
APP_DIR="${APP_DIR:-/opt/learnbase}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

# Let's Encrypt uses this for expiry warnings. deploy.sh prompts for it on the
# first run and stores it in .env.production; it is not needed after that.
TLS_EMAIL="${TLS_EMAIL:-}"

# Set SEED=1 to load the demo catalogue as part of a deploy.
SEED="${SEED:-0}"

# Resolve the Azure CLI. The Windows installer does not reliably put az on PATH
# for non-login shells, so fall back to the known install locations.
#
# Test with -f, not -x: the installer ships wbin/az.cmd as mode 644, so an
# executable-bit test rejects a perfectly working CLI. The extensionless `az`
# in the same directory is the sh wrapper and is preferred here.
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

az_() { "$AZ" "$@"; }

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# Signs in check plus subscription pinning — identical in both scripts.
require_account() {
  if ! az_ account show >/dev/null 2>&1; then
    echo "Not signed in. Run: az login" >&2
    exit 1
  fi
  if [ -n "$SUBSCRIPTION_ID" ]; then
    az_ account set --subscription "$SUBSCRIPTION_ID"
  fi
}

# The VM's public hostname, or empty if the VM does not exist yet.
vm_fqdn() {
  az_ vm list-ip-addresses -g "$RESOURCE_GROUP" -n "$VM_NAME" \
    --query "[0].virtualMachine.network.publicIpAddresses[0].fqdn" \
    -o tsv 2>/dev/null | tr -d '\r'
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
