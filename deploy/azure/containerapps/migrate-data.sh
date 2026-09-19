#!/usr/bin/env bash
#
# Copy the live database off the VM and into the managed server.
#
#   bash deploy/azure/containerapps/migrate-data.sh
#
# Run it after deploy.sh. The order matters and is not the obvious one:
#
#   1. deploy.sh starts the app, whose alembic creates an empty schema at head;
#   2. this script replaces that schema wholesale with the VM's, which is at
#      whatever revision the VM was last deployed at;
#   3. restarting the app runs alembic again, which carries the restored data
#      forward through any migrations the VM never saw.
#
# Step 2 drops and recreates the `public` schema itself immediately before
# restoring, rather than relying on the dump's own --clean DROP statements:
# those have no CASCADE, so they fail against a newer schema whose tables (the
# challenge feature's, for instance) hold foreign keys into the VM's older
# ones. Dropping the schema first restores into a genuinely empty database.
#
# Postgres is not published from the VM, so the dump is taken by running
# pg_dump inside the VM's own container over SSH.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# shellcheck source=config.sh
. "$SCRIPT_DIR/config.sh"

cd "$REPO_ROOT"

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
VM_USER="${VM_USER:-azureuser}"
PG_CONTAINER="${PG_CONTAINER:-learnbase-postgres-1}"
VM_PG_USER="${VM_PG_USER:-learnbase}"
VM_PG_DB="${VM_PG_DB:-learnbase}"
DUMP_FILE="${DUMP_FILE:-$(mktemp --suffix=.sql)}"
KEEP_FIREWALL_RULE="${KEEP_FIREWALL_RULE:-0}"

require_account
resolve_names

if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE not found. Run deploy.sh first." >&2
  exit 1
fi
load_env_file "$ENV_FILE"

# Resolve a psql client. The Windows installer does not put it on PATH.
PSQL=""
if command -v psql >/dev/null 2>&1; then
  PSQL="psql"
else
  for _candidate in /c/Program\ Files/PostgreSQL/*/bin/psql.exe; do
    [ -f "$_candidate" ] && PSQL="$_candidate" && break
  done
fi
if [ -z "$PSQL" ]; then
  echo "psql not found. Install the PostgreSQL client tools." >&2
  exit 1
fi

# psql.exe is a native Windows binary. config.sh sets MSYS_NO_PATHCONV so Git
# Bash does not mangle arguments meant for `az` (see its comment), but that
# same setting stops psql's own file arguments from being translated -- a
# POSIX /tmp/... path reaches it unconverted and it reports "No such file or
# directory" on a file that plainly exists. Convert by hand wherever a path is
# passed to psql specifically.
win_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s' "$1"
  fi
}

VM_IP="$(az_ vm show -d -g "$VM_RESOURCE_GROUP" -n "$VM_NAME" \
  --query publicIps -o tsv | tr -d '\r')"
if [ -z "$VM_IP" ]; then
  echo "Could not find the VM's public address." >&2
  exit 1
fi

# --- Dump -------------------------------------------------------------------
say "Dumping $VM_PG_DB from $VM_NAME ($VM_IP)"
ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  "${VM_USER}@${VM_IP}" \
  "sudo docker exec ${PG_CONTAINER} pg_dump -U ${VM_PG_USER} -d ${VM_PG_DB} \
     --clean --if-exists --no-owner --no-privileges" > "$DUMP_FILE"

DUMP_LINES="$(wc -l < "$DUMP_FILE" | tr -d ' ')"
if [ "$DUMP_LINES" -lt 50 ]; then
  echo "The dump looks empty ($DUMP_LINES lines). Refusing to restore it." >&2
  exit 1
fi
note "$(du -h "$DUMP_FILE" | cut -f1), ${DUMP_LINES} lines"

# --- Open the firewall for this machine -------------------------------------
# The managed server only accepts connections from addresses it has a rule for,
# and the restore runs from here rather than inside Azure.
MY_IP="$(curl -fsS --max-time 20 https://api.ipify.org || true)"
if [ -z "$MY_IP" ]; then
  echo "Could not determine this machine's public address." >&2
  exit 1
fi
RULE_NAME="migrate-$(date +%s)"
say "Allowing $MY_IP through the database firewall (rule $RULE_NAME)"
az_ postgres flexible-server firewall-rule create -g "$RESOURCE_GROUP" -s "$PG_NAME" \
  --name "$RULE_NAME" --start-ip-address "$MY_IP" --end-ip-address "$MY_IP" \
  --only-show-errors -o none

cleanup() {
  if [ "$KEEP_FIREWALL_RULE" != "1" ]; then
    az_ postgres flexible-server firewall-rule delete -g "$RESOURCE_GROUP" -s "$PG_NAME" \
      --name "$RULE_NAME" --yes --only-show-errors -o none 2>/dev/null || true
  fi
  [ -n "${DUMP_FILE:-}" ] && rm -f "$DUMP_FILE"
}
trap cleanup EXIT

# --- Restore ----------------------------------------------------------------
# The target already has an empty schema at *head* (deploy.sh's alembic run
# creates it), which is a newer schema than the VM's dump: it carries tables
# such as challenge_questions/challenge_attempts with foreign keys into
# certifications and users. pg_dump's own --clean emits a plain `DROP TABLE`
# with no CASCADE, so it cannot drop a table something else now references --
# that failed silently under the old /dev/null-swallowed restore, leaving an
# empty database that looked successful.
#
# The fix is to not rely on the dump's DROPs at all: wipe the schema ourselves
# immediately before restoring, so the dump is loaded into a genuinely empty
# database rather than one it has to clear out from under a newer structure.
say "Clearing the target schema before restoring"
PGPASSWORD="$PG_ADMIN_PASSWORD" "$PSQL" \
  "host=${PG_HOST} port=5432 dbname=${PG_DATABASE} user=${PG_ADMIN_USER} sslmode=require" \
  -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

say "Restoring into $PG_HOST"
# ON_ERROR_STOP is deliberately off: --if-exists still emits a few IF EXISTS
# guards that are fine to no-op against the schema just wiped above, and real
# failures are what the check below looks for. The output goes to a log file
# rather than /dev/null, because a real failure (auth, a type mismatch, a
# constraint violation) looks identical to that noise from the exit code
# alone, and silently discarding it once already produced a "successful"
# restore of zero rows.
RESTORE_LOG="$(mktemp --suffix=.log)"
PGPASSWORD="$PG_ADMIN_PASSWORD" "$PSQL" \
  "host=${PG_HOST} port=5432 dbname=${PG_DATABASE} user=${PG_ADMIN_USER} sslmode=require" \
  -v ON_ERROR_STOP=0 -f "$(win_path "$DUMP_FILE")" > "$RESTORE_LOG" 2>&1 || true

REAL_ERRORS="$(grep -Ec 'ERROR:' "$RESTORE_LOG" || true)"
BENIGN_ERRORS="$(grep -Ec 'ERROR:.*(does not exist|already exists)' "$RESTORE_LOG" || true)"
if [ "$REAL_ERRORS" -gt "$BENIGN_ERRORS" ]; then
  echo "Restore reported errors beyond the expected --clean --if-exists noise:" >&2
  grep -E 'ERROR:' "$RESTORE_LOG" | grep -Ev 'does not exist|already exists' >&2
  echo "Full log: $RESTORE_LOG" >&2
  exit 1
fi
note "Restore log: $RESTORE_LOG ($REAL_ERRORS expected notices)"

say "Verifying"
PGPASSWORD="$PG_ADMIN_PASSWORD" "$PSQL" \
  "host=${PG_HOST} port=5432 dbname=${PG_DATABASE} user=${PG_ADMIN_USER} sslmode=require" \
  -At -c "select 'users='||count(*) from users
          union all select 'certifications='||count(*) from certifications
          union all select 'courses='||count(*) from courses
          union all select 'articles='||count(*) from articles
          union all select 'exam_bookings='||count(*) from exam_bookings
          union all select 'revision='||version_num from alembic_version;"

# --- Bring the schema forward -----------------------------------------------
# The restored schema is at the VM's revision. Restarting the app re-runs
# alembic, which applies anything newer -- the challenge tables, for instance.
say "Restarting the app so alembic brings the schema to head"
REVISION="$(az_ containerapp revision list -g "$RESOURCE_GROUP" -n "$APP_NAME" \
  --query "[?properties.active].name | [0]" -o tsv | tr -d '\r')"
if [ -n "$REVISION" ] && [ "$REVISION" != "None" ]; then
  az_ containerapp revision restart -g "$RESOURCE_GROUP" -n "$APP_NAME" \
    --revision "$REVISION" --only-show-errors -o none
  note "Restarted $REVISION"
fi

say "Done"
note "Give it a minute, then check: https://$(az_ containerapp show -g "$RESOURCE_GROUP" \
  -n "$APP_NAME" --query properties.configuration.ingress.fqdn -o tsv | tr -d '\r')"
