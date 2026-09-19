# Deploying Inferacloud to Azure Container Apps

```bash
bash deploy/azure/containerapps/deploy.sh      # provision and ship
bash deploy/azure/containerapps/migrate-data.sh # bring the VM's data across
```

The container variant of [DEPLOY-AZURE.md](DEPLOY-AZURE.md), which runs the same
stack on a single VM. The two are independent — different resource groups,
different regions, different hostnames — so both can run at once while a
cutover is verified.

Same three-file convention as everything else: `config.sh` holds every setting
(all overridable from the environment), `deploy.sh` provisions, `redeploy.sh`
ships code to something already provisioned.

```
Internet
   │  https://learnbase-web.<env>.centralindia.azurecontainerapps.io
   ▼                                   managed TLS, no Caddy to run
Container App "learnbase-web"          one app, two containers, shared netns
   ├── frontend  :80    React build on nginx, proxies /api → 127.0.0.1:8000
   └── backend   :8000  FastAPI, runs alembic on every start
            │                └── /app/uploads → Azure Files share
            ▼
Azure Database for PostgreSQL Flexible Server (Burstable B1ms, 32 GiB)
```

**One app, not two.** The containers share a network namespace, so the frontend
reaches the API on `localhost` — no internal ingress, no service discovery, and
one set of replicas to pay for rather than two. The cost of this is that the
two cannot scale independently; for a site whose frontend is a static bundle
served by nginx, that is not a cost worth paying to avoid.

---

## What it costs

Roughly **$50 per month** with the site kept warm, against ~$21 for the VM.
Containers are not the cheaper option here, and it is worth being clear about
why before choosing them:

| Resource | Approx. monthly |
| --- | --- |
| Container App, 0.5 vCPU / 1 GiB, always on | ~$33 |
| PostgreSQL Flexible Server, Burstable B1ms | ~$12 |
| 32 GiB database storage + 7-day backups | ~$4 |
| Azure Files share for uploads (5 GiB) | ~$0.30 |
| Container registry | $0 — reuses the Basic registry `gcpprep-rg` already pays for |
| Log Analytics | pay-per-GiB, pennies at this volume |

What the extra buys over the VM: no host to patch, no Docker to babysit,
automated database backups with point-in-time restore, TLS certificates handled
by the platform, and a rollback that is one `az containerapp update` away.

**The single biggest lever is `MIN_REPLICAS`.** Container Apps bills per
vCPU-second while a replica runs:

```bash
MIN_REPLICAS=0 bash deploy/azure/containerapps/deploy.sh
```

At zero the app sleeps when nobody is on it and the compute bill goes to
roughly nothing — total cost drops to about **$17/month**, essentially just the
database. The price is a cold start of 15–30 seconds on the first request after
a quiet spell, including the alembic run. The default is 1 because this site
runs a discount campaign, and a cold start on a landing page is a lost lead.
For a staging environment, set it to 0.

---

## First deploy

Interactive `az login` is blocked by Conditional Access on this tenant. Sign in
with the `learnbase-deploy` service principal instead; `deploy.sh` says so if it
finds no session.

```bash
bash deploy/azure/containerapps/deploy.sh
```

What happens, in order:

1. The `containerapp` CLI extension is installed if missing, and
   `Microsoft.App`, `Microsoft.DBforPostgreSQL` and
   `Microsoft.OperationalInsights` are registered if they are not already.
2. App secrets are read from `.env.production` if it exists. **`JWT_SECRET` is
   deliberately carried across from the VM deployment** — a fresh one would
   sign every existing user out the moment traffic moved.
3. The resource group, registry, database, storage account and Container Apps
   environment are created if absent. The database takes the longest, so it is
   created in the background while the images build.
4. Both images are built by **ACR Tasks**, not locally — no Docker daemon is
   needed on the machine running this, and the layers never cross the internet
   from here.
5. The app is created (or updated) from a generated YAML spec.
6. Generated secrets are written to `.env.containerapps`, which is gitignored.
   Keep it: it holds the database password.

Everything is idempotent. Re-running ships new images without touching the
database, the uploads share or the hostname.

### The hostname comes before the build

`VITE_SITE_URL` is compiled into the frontend bundle, so the site's own URL has
to be known before the image is built. It is: a Container App's FQDN is
`<app-name>.<environment default domain>`, and the environment is created first.
That is why the environment is provisioned before the images are built rather
than alongside them.

---

## Migrating the data

`migrate-data.sh` copies the live database off the VM. Postgres is not published
from the VM, so the dump is taken by running `pg_dump` inside the VM's own
container over SSH.

The order is deliberate, and not the obvious one:

1. `deploy.sh` starts the app, whose alembic creates an **empty schema at head**.
2. `migrate-data.sh` replaces that schema wholesale with the VM's, which sits at
   whatever revision the VM was last deployed at.
3. Restarting the app runs alembic again, carrying the restored data forward
   through any migrations the VM never saw.

Restoring over a newer schema is exactly why the dump is taken with `--clean
--if-exists`: without it the restore collides with the tables alembic has
already created.

The script opens the database firewall to the machine it runs on, restores,
prints row counts, and closes the firewall again on exit. Set
`KEEP_FIREWALL_RULE=1` to leave it open for repeated runs.

---

## Shipping a change

```bash
bash deploy/azure/containerapps/redeploy.sh
```

Rebuilds both images at a fresh tag and points the app at them. Container Apps
creates a new revision and shifts traffic once it is healthy, so a bad build
fails to take over rather than taking the site down.

To roll back, deploy an older tag:

```bash
IMAGE_TAG=20260918-233816 bash deploy/azure/containerapps/redeploy.sh
```

Tags are timestamps, and `az acr repository show-tags -n <registry> --repository learnbase-backend`
lists them.

---

## Cutting over from the VM

The container deployment gets its own hostname, so nothing about the VM changes
when it goes up. Once it looks right:

```bash
# Stop paying for the VM, keeping the disk so it can be restarted.
az vm deallocate -g learnbase-rg -n learnbase-vm

# Or tear it down for good, once you are sure.
az group delete -n learnbase-rg --yes
```

Deallocating leaves the ~$2/month disk and is reversible with `az vm start`.
Deleting the group removes the VM, its disk, its public IP and the hostname
that points at it — including the Let's Encrypt certificate, which is rate
limited to re-issue, so do not delete and then change your mind in the same
week.

---

## Operating it

```bash
# Logs, live.
az containerapp logs show -g learnbase-aca-rg -n learnbase-web --container backend --follow

# What revisions exist and which is taking traffic.
az containerapp revision list -g learnbase-aca-rg -n learnbase-web -o table

# Restart, which also re-runs alembic.
az containerapp revision restart -g learnbase-aca-rg -n learnbase-web --revision <name>

# Connect to the database (add your address to the firewall first).
az postgres flexible-server firewall-rule create -g learnbase-aca-rg \
  -n <server> --rule-name me --start-ip-address <ip> --end-ip-address <ip>
```

### Things worth knowing

**The backend runs `alembic upgrade head` on every start.** Convenient, but it
means a bad migration takes the app down rather than failing a deploy step. With
`MIN_REPLICAS=1` the failure is contained: the old revision keeps serving until
the new one reports healthy.

**Uploads live on an Azure Files share**, because a container's filesystem does
not survive a restart. Anything written to `/app/uploads` outside that mount is
lost on the next revision.

**Seeding is not wired up.** `database/seed` sits outside the backend's build
context, so it is not in the image. The catalogue arrives by migrating the VM's
database instead. If you ever need to seed a genuinely empty environment, either
add the seed directory to the backend image or run the seeder locally against
the managed server with its firewall briefly open.

**The registry is shared with another project.** `gcpprep6db0f523d451` belongs to
`gcpprep-rg`; this deployment reuses it to avoid paying twice for a Basic
registry. Deleting that resource group would take these images with it. Set
`ACR_NAME` to a name that does not exist to get a dedicated registry instead.
