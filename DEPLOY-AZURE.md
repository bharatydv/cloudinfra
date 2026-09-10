# Deploying LearnBase to Azure

```bash
az login
SUBSCRIPTION_ID=<id> bash deploy/azure/deploy.sh
```

Same three-file convention as the other projects: `config.sh` holds every
setting (all overridable from the environment), `deploy.sh` provisions, and
`redeploy.sh` ships code to something already provisioned.

Unlike the Container Apps projects, this one runs on **a single VM**, because
LearnBase is stateful. It needs PostgreSQL, and a managed Postgres instance
costs more per month than the entire VM — while a Postgres container on the VM
costs nothing beyond the disk it already has. Media uploads want a persistent
filesystem for the same reason.

```
Internet
   │  https://learnbase-<suffix>.centralindia.cloudapp.azure.com
   ▼
Azure VM (Standard_B1ms, Ubuntu 24.04)
   └── docker compose -f docker-compose.prod.yml
        ├── caddy      :80/:443   TLS, auto-renewing Let's Encrypt certificate
        ├── frontend   :80        React build + nginx, proxies /api → backend
        ├── backend    :8000      FastAPI, runs alembic on every start
        └── postgres   :5432      internal only, data in a docker volume
```

Only Caddy is exposed. Postgres and the API are reachable only from inside the
compose network.

---

## What it costs

Roughly **$20–25 per month**, pay-as-you-go:

| Resource | Approx. monthly |
| --- | --- |
| `Standard_B1ms` VM (1 vCPU, 2 GiB), Linux | ~$15 |
| 30 GiB Standard SSD OS disk | ~$2.40 |
| Standard static public IP | ~$3.60 |
| Egress bandwidth | first 100 GB free |

Prices vary by region — check the
[Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/) for
your own numbers. No managed database, no container registry, no load balancer
and no domain purchase, which is where the savings are.

**Ways to pay less:** a 1-year reserved instance cuts the VM by roughly 40%;
for a staging box, `az vm auto-shutdown` so it only runs during the day.

**Ways to pay more, if you need to:** `VM_SIZE=Standard_B2ls_v2` (2 vCPU,
4 GiB) roughly doubles the VM cost and makes builds substantially faster.

---

## First deploy

The Azure CLI is already installed at
`/c/Program Files/Microsoft SDKs/Azure/CLI2/wbin/az`. It is not on PATH for
non-login shells, which is why `config.sh` resolves it explicitly — you do not
need to install anything.

```bash
az login                     # needs a browser, so you run this
TLS_EMAIL=you@example.com SUBSCRIPTION_ID=<id> bash deploy/azure/deploy.sh
```

`TLS_EMAIL` is only needed the first time — it goes to Let's Encrypt for
certificate expiry notices and is then stored in `.env.production`. Omit it and
the script prompts. Every run after that needs only `SUBSCRIPTION_ID`.

What happens:

1. Resource group, VM, and inbound rules for 80/443 are created if absent.
   The hostname suffix is derived from the subscription id, so re-running picks
   the same name rather than stranding the old one.
2. `.env.production` is generated with fresh secrets — database password,
   `JWT_SECRET`, seed admin password. **This is the only copy. Back it up.**
   It is never regenerated once it exists.
3. cloud-init installs Docker, adds a 4 GiB swapfile, caps container log growth
   and enables unattended security upgrades — **3 to 6 minutes**, since it runs
   a full `apt upgrade` first.
4. `redeploy.sh` takes over: package, upload, build, migrate, start, verify.

**The first deploy takes 10–15 minutes** on a B1ms — the Vite build is the slow
part, and it leans on that swapfile. Later deploys are faster thanks to Docker
layer caching.

Add `SEED=1` to load the demo catalogue.

Everything is safe to re-run: each step checks for existing resources first.

---

## Deploying changes

```bash
SUBSCRIPTION_ID=<id> bash deploy/azure/redeploy.sh
```

Migrations run automatically — the backend's start command is
`alembic upgrade head && uvicorn ...`, so every rollout applies pending
migrations before serving traffic. The script fails loudly if
`/api/health` does not return 200 afterwards.

---

## Settings

Everything in [deploy/azure/config.sh](deploy/azure/config.sh) can be
overridden from the environment:

```bash
LOCATION=westeurope VM_SIZE=Standard_B2ls_v2 SUBSCRIPTION_ID=<id> \
  bash deploy/azure/deploy.sh
```

| Variable | Default | Notes |
| --- | --- | --- |
| `LOCATION` | `centralindia` | Matches the other projects |
| `SUBSCRIPTION_ID` | *(active one)* | Pin it — this account has two subscriptions with the same name |
| `RESOURCE_GROUP` | `learnbase-rg` | Teardown unit |
| `VM_NAME` | `learnbase-vm` | |
| `VM_SIZE` | `Standard_B1ms` | Smallest that can build the frontend |
| `OS_DISK_SKU` | `StandardSSD_LRS` | Premium is ~2× for no benefit here |
| `DNS_LABEL` | derived from subscription | Set to pin your own hostname |
| `TLS_EMAIL` | *(prompted)* | First run only |
| `SEED` | `0` | `1` loads the demo catalogue |

---

## Right after the first deploy

**Handled by the scripts**

- Real `JWT_SECRET` and database password
- `ENVIRONMENT=production`, `DEBUG=false`
- `BACKEND_CORS_ORIGINS` restricted to your domain
- `PUBLIC_SITE_URL` set to the real HTTPS URL
- TLS with automatic renewal; Caddy redirects HTTP to HTTPS
- `alembic upgrade head` as a deploy step
- Postgres not exposed to the internet
- Unattended security upgrades on the VM
- Docker log rotation, so logs can't fill the disk
- Nightly `pg_dump` with 14-day retention

**Still yours**

- **Delete the demo accounts and demo testimonials** if you used `SEED=1`, and
  change the seed admin password after first login
- Copy the nightly dumps **off the VM** — they are automatic, but they sit on
  the same disk as the database
- Log aggregation and error reporting
- Uptime monitoring on `/api/health`
- Review the seeded legal copy, as the README warns

---

## Database backups

Postgres runs as a container on this VM, so Azure does not back it up for you.
`redeploy.sh` installs a **nightly dump at 03:30**
([deploy/azure/backup.sh](deploy/azure/backup.sh)) — no setup needed.

- Dumps go to `/opt/learnbase/backups/learnbase-<date>.sql.gz`
- 14 days are kept; older ones are pruned
- A dump is verified complete **before** anything is pruned, so a run of
  failures can never leave you with no backups
- A truncated dump is renamed `.suspect` and the job exits non-zero
- The log is `/opt/learnbase/backups/backup.log`

```bash
FQDN=learnbase-<suffix>.centralindia.cloudapp.azure.com

ssh azureuser@$FQDN "crontab -l; tail -20 /opt/learnbase/backups/backup.log"
ssh azureuser@$FQDN "/opt/learnbase/deploy/azure/backup.sh"   # run one now
ssh azureuser@$FQDN "ls -lh /opt/learnbase/backups"
scp azureuser@$FQDN:/opt/learnbase/backups/learnbase-2026-09-10-0330.sql.gz .
```

Restore into a running stack:

```bash
cd /opt/learnbase
gzip -dc backups/learnbase-2026-09-10-0330.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U learnbase learnbase
```

**These dumps live on the VM's own disk.** They survive a container rebuild or
a dropped volume, but not losing the VM. Before this holds data you would miss,
add whole-VM snapshots — which also cover the uploaded media volume:

```bash
az backup vault create -g learnbase-rg -n learnbase-vault -l centralindia
az backup protection enable-for-vm -g learnbase-rg --vault-name learnbase-vault \
  --vm learnbase-vm --policy-name DefaultPolicy
```

Azure Backup adds a few dollars a month.

---

## Using your own domain

1. Add a `CNAME` pointing `www` at the `cloudapp.azure.com` hostname.
2. In `.env.production`, change `SITE_DOMAIN`, `FRONTEND_URL`,
   `PUBLIC_SITE_URL` and `BACKEND_CORS_ORIGINS` to the new domain.
3. Re-run `redeploy.sh`.

Caddy requests a certificate for the new name on startup. Nothing else changes.
An apex record cannot be a CNAME — use Azure DNS with an alias record, or
redirect apex → www at your registrar.

---

## Operating the VM

```bash
FQDN=learnbase-<suffix>.centralindia.cloudapp.azure.com
C="cd /opt/learnbase && docker compose -f docker-compose.prod.yml"

ssh azureuser@$FQDN "$C logs -f"              # follow all logs
ssh azureuser@$FQDN "$C logs -f backend"      # just the backend
ssh azureuser@$FQDN "$C ps"                   # what's running
ssh azureuser@$FQDN "$C restart backend"      # restart one service
ssh azureuser@$FQDN "$C exec postgres psql -U learnbase learnbase"

# Stop paying for compute without destroying anything
az vm deallocate -g learnbase-rg -n learnbase-vm
az vm start      -g learnbase-rg -n learnbase-vm

# Tear it all down
az group delete -n learnbase-rg --yes
```

---

## Troubleshooting

**`Azure CLI not found`** — `config.sh` checks PATH then the two standard
install directories. If you installed somewhere else, set `AZ` or add it to
PATH.

**Certificate error on the site** — Caddy needs port 80 reachable for the ACME
challenge. `deploy.sh` opens it, but verify with
`az network nsg rule list -g learnbase-rg --nsg-name learnbase-vmNSG -o table`,
then check `docker compose -f docker-compose.prod.yml logs caddy`.

**Frontend build killed during deploy** — the VM ran out of memory. Check swap
with `ssh azureuser@$FQDN 'swapon --show'`; if missing, re-run
`sudo /usr/local/sbin/learnbase-bootstrap.sh`. Or resize:
`az vm resize -g learnbase-rg -n learnbase-vm --size Standard_B2ls_v2`.

**Backend restarting in a loop** — almost always a failed migration.
`docker compose -f docker-compose.prod.yml logs backend` shows the Alembic error.

**Disk filling up** — `docker system prune -af` reclaims space. Do **not** add
`--volumes`: that deletes your database.

---

## What to change as you grow

This layout is deliberately the cheap one, and it has real limits:

- **Media uploads live on the VM's disk** (`STORAGE_PROVIDER=local`). The
  backend already supports S3-compatible storage — set the `STORAGE_*` vars and
  point them at Azure Blob Storage when you want a CDN or more than one app
  server.
- **Postgres runs as a container on the same box.** Moving to Azure Database
  for PostgreSQL Flexible Server means changing `DATABASE_URL` and deleting the
  `postgres` service — it buys managed backups and point-in-time restore for
  roughly $15–20 more per month.
- **No Redis.** `REDIS_URL` is empty, so rate limiting is in-process. Correct
  while there is one backend container; add Redis before scaling out.
- **Deploys have a brief gap** while containers restart. Zero-downtime wants
  two app instances behind a proxy — which is where Container Apps, like the
  other projects use, starts being worth its price.
