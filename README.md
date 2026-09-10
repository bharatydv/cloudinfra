# LearnBase — Course & Certification Preparation Platform

A production-oriented foundation for an online learning and professional
certification preparation platform.

**React + TypeScript → FastAPI → SQLAlchemy → PostgreSQL.** The browser never
talks to the database directly; every read and write goes through the REST API.

---

## Contents

- [What works today](#what-works-today)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Quick start (Docker)](#quick-start-docker)
- [Local development](#local-development)
- [Database migrations](#database-migrations)
- [Seed data](#seed-data)
- [Testing](#testing)
- [API documentation](#api-documentation)
- [SEO](#seo)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Security](#security)
- [Future integrations](#future-integrations)
- [Production deployment](#production-deployment)
- [Trust and legal position](#trust-and-legal-position)

---

## What works today

This is a working full-stack application, not a UI prototype.

| Area | Status |
| --- | --- |
| Registration, login, JWT access + rotating refresh tokens | Working |
| Password reset flow (token issued, hashed, single-use) | Working |
| Role-based access (`student`, `instructor`, `admin`) | Working |
| Course catalogue with search, filters, sorting, pagination | Working, from PostgreSQL |
| Course detail with curriculum, reviews, related content | Working |
| Certification providers, certifications, study resources | Working |
| Resource hub (articles) with categories, tags, TOC | Working |
| Cross-entity search (PostgreSQL full-text) | Working |
| Enrollment and lesson-level progress tracking | Working |
| Course-player learning experience | Working |
| Completion certificates issued on 100% progress | Working |
| Contact form → database → admin inbox | Working |
| Admin dashboard and CRUD for all content types | Working |
| Article CMS (draft/publish, Markdown, SEO fields) | Working |
| Dynamic `sitemap.xml` and `robots.txt` | Working |
| Structured data (Organization, WebSite, Course, Article, FAQPage, BreadcrumbList) | Working |
| Alembic migrations and idempotent seed script | Working |
| Docker Compose (postgres + backend + frontend + nginx) | Working |
| Payments, email, object storage, analytics | Architected, adapters pluggable — see [Future integrations](#future-integrations) |

---

## Architecture

```
                        Browser
                           │
                           ▼
                  React SPA (Vite build)
                     served by Nginx
                           │  REST / JSON
                           ▼
                    FastAPI application
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
        SQLAlchemy 2.x              Redis
        (async, asyncpg)          (optional)
              │
              ▼
         PostgreSQL 16
              │
              ▼
   External services (pluggable adapters)
   Payments · Email · Object storage · Analytics
```

Layering inside the backend:

```
api/routers  →  services  →  repositories  →  models  →  PostgreSQL
   HTTP          business       queries        ORM
                  rules
```

Routers stay thin. Business rules live in `services/`. All SQL lives in
`repositories/`. This is why the payment webhook — not the browser — is the only
thing that can grant paid access.

---

## Technology stack

**Frontend** — React 18, TypeScript (strict), Vite, Tailwind CSS, React Router 6,
TanStack Query, React Hook Form, Zod, Lucide icons.

**Backend** — Python 3.12, FastAPI, SQLAlchemy 2.x (async), Pydantic v2, Alembic,
JWT (python-jose), Argon2 password hashing (bcrypt fallback), SlowAPI rate limiting.

**Database** — PostgreSQL 16.

**Infrastructure** — Docker, Docker Compose, Nginx.

---

## Quick start (Docker)

Requirements: Docker Desktop (or Docker Engine + Compose v2).

```bash
git clone <your-repo> learnbase && cd learnbase

# 1. Configure
cp .env.example .env
#    Generate a real secret:
python -c "import secrets; print(secrets.token_urlsafe(64))"
#    Paste it into JWT_SECRET, and change POSTGRES_PASSWORD.

# 2. Start everything (migrations run automatically on backend startup)
docker compose up -d --build

# 3. Load demo content
docker compose exec backend python -m app.seed.run
```

| Service | URL |
| --- | --- |
| Website | http://localhost:8080 |
| API docs (Swagger) | http://localhost:8000/docs |
| API docs (ReDoc) | http://localhost:8000/redoc |
| PostgreSQL | localhost:5433 |

Demo accounts created by the seed script (development only — remove before
production):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `Admin123!change` |
| Instructor | `instructor@example.com` | `Instructor123!` |
| Student | `student@example.com` | `Student123!` |

### Port conflicts

Host ports are configurable in `.env`, because a machine may already be running
PostgreSQL or another service:

```bash
POSTGRES_HOST_PORT=5433   # container always listens on 5432 internally
BACKEND_HOST_PORT=8000
FRONTEND_HOST_PORT=8080
```

### Optional services

```bash
docker compose --profile cache up -d      # adds Redis
docker compose --profile proxy up -d      # adds a front Nginx on :80
```

---

## Local development

Run PostgreSQL in Docker and the app on the host for fast reloads.

```bash
docker compose up -d postgres
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

alembic upgrade head
python -m app.seed.run

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

The dev server proxies `/api`, `/sitemap.xml` and `/robots.txt` to the backend,
so the browser and API share an origin and CORS is not involved. If the API runs
on a different port:

```bash
VITE_DEV_API_TARGET=http://127.0.0.1:8100 npm run dev
```

Frontend scripts:

```bash
npm run dev         # dev server
npm run build       # typecheck + production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint, zero warnings allowed
```

---

## Database migrations

Alembic runs through the same async engine as the application.

```bash
cd backend

alembic upgrade head                                  # apply all migrations
alembic revision --autogenerate -m "add x to y"       # create a migration
alembic downgrade -1                                  # roll back one
alembic downgrade base                                # roll back everything
alembic current                                       # show applied revision
alembic history --verbose                             # list migrations
```

**Always read a generated migration before applying it.** Autogenerate detects
most changes but not renames, and it will happily propose a drop-and-recreate on
a column that only needed a type change.

In Docker, `alembic upgrade head` runs automatically when the backend container
starts (see the `command` in `docker-compose.yml`).

---

## Seed data

Seed content lives as JSON under `database/seed/` and is loaded by
`backend/app/seed/run.py`. The script is idempotent — rows are matched on their
natural key (slug, question, setting key) and updated in place, so it is safe to
re-run.

```bash
cd backend
python -m app.seed.run              # create or update seed content
python -m app.seed.run --reset      # delete seeded content first
```

It creates: 6 course categories · 10 resource categories · 15 tags ·
3 certification providers · 9 certifications with exam topics, roadmaps and
study resources · 6 courses with 18 modules and 53 lessons of real written
content · 8 long-form articles · 18 FAQs · 3 clearly-labelled demo testimonials ·
5 site-settings records (brand, contact, about, legal, learning path).

To change the seed content, edit the JSON in `database/seed/` and re-run.

> Seeded testimonials are stored with `is_demo = true` and are labelled
> **Demo content** wherever they render. Delete them before launch.

---

## Testing

Tests run against a real PostgreSQL database — the schema uses JSONB and
full-text search, so SQLite is not a valid substitute. The test database is
created and dropped around each session.

```bash
docker compose up -d postgres

cd backend
pytest                       # 53 tests
pytest -v                    # verbose
pytest tests/test_auth.py    # one file
pytest --cov=app             # with coverage (pip install pytest-cov)
```

In Docker:

```bash
docker compose exec backend pytest
```

Coverage spans authentication (registration, login, token rotation, account
enumeration), the course and certification catalogue, enrollment and progress,
certificate issuance, the article CMS publish flow, search, the contact form,
admin authorisation, admin CRUD round trips, and the SEO surfaces
(`sitemap.xml`, `robots.txt`, structured data).

Two behaviours worth calling out, because both are asserted:

- A course with no reviews emits **no** `aggregateRating` in its structured data.
- `robots.txt` disallows `/admin`, `/dashboard`, `/learn` and the auth routes.

---

## API documentation

FastAPI generates OpenAPI documentation from the route signatures and Pydantic
models:

- Swagger UI — http://localhost:8000/docs
- ReDoc — http://localhost:8000/redoc
- OpenAPI JSON — http://localhost:8000/openapi.json

### Endpoint summary

**Auth** — `POST /api/auth/register` · `login` · `refresh` · `logout` ·
`forgot-password` · `reset-password` · `change-password` · `GET /api/auth/me`

**Courses** — `GET /api/courses` · `GET /api/courses/{slug}` ·
`GET /api/course-categories` · `POST|PUT|DELETE /api/courses` (staff) ·
`POST /api/courses/{id}/publish` · `POST /api/courses/{id}/reviews`

**Modules & lessons** — `GET /api/courses/{id}/modules` ·
`GET /api/modules/{id}/lessons` · `GET /api/lessons/{id}` ·
`POST|PUT|DELETE /api/modules` and `/api/lessons` (staff) ·
reorder endpoints for both

**Certifications** — `GET /api/certifications` ·
`GET /api/certifications/{provider}` · `GET /api/certifications/{provider}/{slug}` ·
`GET /api/certification-providers` · `GET /api/certifications/{id}/resources` ·
full CRUD for certifications, providers and resources (staff)

**Articles** — `GET /api/articles` · `GET /api/articles/{slug}` ·
`GET /api/articles/featured` · `/popular` · `GET /api/article-categories` ·
`GET /api/tags` · full CRUD (staff)

**Learning** — `POST /api/enrollments` · `GET /api/users/me/enrollments` ·
`/progress` · `/dashboard` · `/certificates` · `/saved-certifications` ·
`POST /api/lessons/{id}/progress` · `GET /api/learn/{courseSlug}[/{lessonSlug}]`

**Search** — `GET /api/search?q=`

**Contact & analytics** — `POST /api/contact` · `POST /api/events`

**Payments** — `POST /api/payments/create` · `GET /api/payments/{id}` ·
`POST /api/payments/webhook` (signature-verified)

**Site** — `GET /api/home` (homepage aggregate) · `/faqs` · `/testimonials` ·
`/settings` · `/seo/page`

**Admin** — `GET /api/admin/dashboard` · `/users` · `/enrollments` · `/payments` ·
`/messages` · `/faqs` · `/testimonials` · `/settings`

**Crawlers** — `GET /robots.txt` · `GET /sitemap.xml` (site root, not under `/api`)

---

## SEO

SEO is a first-class feature rather than an afterthought.

- **Per-page metadata** is built server-side (`app/services/seo_service.py`) and
  applied to the document head by the client (`src/lib/seo.ts`): unique title,
  meta description, canonical URL, Open Graph and Twitter tags.
- **Structured data** — Organization and WebSite on the homepage, Course on
  course pages, Article on resource pages, FAQPage wherever FAQs render, and
  BreadcrumbList on every page with a trail. Only ever describing content that
  is actually visible.
- **`sitemap.xml`** is generated from the database on request, so it always
  reflects published courses, certifications, providers, articles and category
  pages. It never lists drafts.
- **`robots.txt`** disallows `/admin`, `/dashboard`, `/learn`, `/checkout`,
  `/search` and the auth routes.
- **Filtered listing URLs** (`?category=`, `?level=`, …) are served
  `noindex,follow`, so facet permutations do not compete with the canonical
  listing page.
- **Clean URLs** — `/certifications/google-cloud/professional-cloud-architect`,
  `/courses/cloud-computing-fundamentals`, `/resources/cloud-certification-roadmap`.
- **Internal linking** is built into the content model: articles link to related
  courses and certifications, certifications link to preparing courses, providers
  link to their certifications and related guides.

> The frontend is a client-rendered SPA. Modern crawlers execute JavaScript, but
> if organic search is the primary acquisition channel, adding server-side
> rendering or prerendering for the marketing and content routes is the highest
> value next step. The API already returns everything a renderer needs.

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/v1/routers/     HTTP layer, one module per resource
│   │   ├── core/               config, security, deps, errors, pagination
│   │   ├── db/                 declarative base, async session
│   │   ├── models/             SQLAlchemy models
│   │   ├── schemas/            Pydantic request/response models
│   │   ├── repositories/       all queries live here
│   │   ├── services/           business rules + pluggable integrations
│   │   ├── seed/               seed loader
│   │   ├── utils/              slugs, reading time, excerpts
│   │   └── main.py             app factory, middleware, error handlers
│   ├── migrations/             Alembic environment and versions
│   ├── tests/                  pytest suite
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/                fetch client + typed endpoints
│   │   ├── components/         ui, layout, cards, marketing, forms, admin
│   │   ├── config/             brand configuration (single source of truth)
│   │   ├── hooks/              auth, site settings, toast, SEO, debounce
│   │   ├── layouts/            public, dashboard, admin, route guards
│   │   ├── lib/                query client, SEO, analytics, markdown
│   │   ├── pages/              public, auth, dashboard, learn, admin
│   │   └── types/              API types mirroring the backend schemas
│   ├── nginx.conf              SPA serving + API proxy
│   └── Dockerfile              multi-stage build → nginx
│
├── database/seed/              seed content as JSON
├── nginx/                      optional front proxy config
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Environment variables

Copy `.env.example` to `.env`. **`.env` is gitignored and must never be
committed.**

### Required

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/db` |
| `JWT_SECRET` | Signing secret. Generate with `secrets.token_urlsafe(64)` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose database credentials |

### Core settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `development` \| `test` \| `staging` \| `production` |
| `DEBUG` | `false` | Adds exception detail to 500 responses. Never enable in production |
| `JWT_ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `14` | |
| `PASSWORD_HASH_SCHEME` | `argon2` | `argon2` \| `bcrypt` |
| `FRONTEND_URL` / `PUBLIC_SITE_URL` | localhost | Used in emails, canonical URLs and the sitemap |
| `BACKEND_CORS_ORIGINS` | localhost | Comma-separated allowed origins |
| `RATE_LIMIT_ENABLED` | `true` | |
| `RATE_LIMIT_DEFAULT` / `RATE_LIMIT_AUTH` | `120/minute` / `10/minute` | |

### Optional integrations

| Variable | Notes |
| --- | --- |
| `REDIS_URL` | Shares rate-limit buckets across workers when set |
| `PAYMENT_PROVIDER` / `_KEY` / `_SECRET` / `PAYMENT_WEBHOOK_SECRET` | `noop` until configured |
| `EMAIL_PROVIDER` / `EMAIL_PROVIDER_KEY` / `EMAIL_FROM_*` | `console` logs instead of sending |
| `STORAGE_PROVIDER` / `STORAGE_*` | `local` in development, `s3` in production |
| `ANALYTICS_PROVIDER` / `ANALYTICS_SITE_ID` | Events are always stored first-party |

### Frontend (build-time)

Vite inlines `VITE_*` variables at build time — they are **not** runtime config
and must never hold secrets.

| Variable | Default |
| --- | --- |
| `VITE_API_BASE_URL` | `/api` |
| `VITE_SITE_URL` | `http://localhost:8080` |
| `VITE_DEV_API_TARGET` | `http://localhost:8000` (dev proxy only) |

---

## Security

Implemented:

- **Password hashing** with Argon2 (bcrypt fallback), automatic rehash on login
  when parameters change. Plaintext passwords are never stored or logged.
- **Short-lived JWT access tokens** plus **rotating refresh tokens**. Refresh
  tokens are stored only as SHA-256 digests and are single-use: presenting one
  revokes it and issues a new pair. Changing a password revokes every session.
- **No account enumeration** — `forgot-password` returns an identical response
  whether or not the account exists, and login failures do not distinguish
  between a wrong email and a wrong password.
- **Role-based authorisation** enforced server-side on every protected route.
  Frontend guards are a usability layer only. An admin cannot remove their own
  admin role or deactivate their own account.
- **Input validation** through Pydantic on every request body and query
  parameter.
- **SQL injection protection** — all queries go through SQLAlchemy Core/ORM with
  bound parameters. No string-built SQL.
- **Rate limiting** on auth (10/min), the contact form (5/min) and globally
  (120/min).
- **Error responses never leak internals.** Stack traces are logged
  server-side; clients get a stable `{"error": {"code", "message"}}` envelope.
- **Contact form honeypot** plus rate limiting.
- **Upload validation** — type allowlist and a 10 MB ceiling.
- **Security headers** at the Nginx layer: `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`.
- **Payments cannot be self-granted.** The browser can create a pending payment;
  only a signature-verified provider webhook can mark it successful, and only
  that transition grants enrollment. Webhook handling is idempotent, so replays
  cannot double-grant. Raw card data never reaches this system.
- **Markdown is rendered to React elements**, not `dangerouslySetInnerHTML`, so
  stored content cannot inject script.

Before going to production:

1. Generate a fresh `JWT_SECRET` and a strong `POSTGRES_PASSWORD`.
2. Set `ENVIRONMENT=production` and `DEBUG=false`.
3. Restrict `BACKEND_CORS_ORIGINS` to your real domain.
4. Terminate TLS at the proxy and force HTTPS.
5. Delete the seeded demo accounts and demo testimonials.
6. Point `REDIS_URL` at a real Redis so rate limits are shared across workers.
7. Configure database backups.

---

## Future integrations

Each integration sits behind a small interface, so adding a provider means
writing one adapter — not touching business logic.

| Concern | Interface | Current default | To enable |
| --- | --- | --- | --- |
| Email | `services/email.py` → `EmailSender` | `console` (logs) | Implement `send()` for your provider, set `EMAIL_PROVIDER` |
| Payments | `services/payments.py` → `PaymentProvider` | `noop` | Implement `create_checkout` + `parse_webhook`, set `PAYMENT_PROVIDER` |
| Storage | `services/storage.py` → `StorageBackend` | `local` | Implement `S3Storage.save`, set `STORAGE_PROVIDER=s3` |
| Analytics | `services/analytics.py` → `AnalyticsSink` | `noop` | Implement `emit()`; events are persisted first-party regardless |
| Search | `repositories/search_repo.py` → `search_all` | PostgreSQL FTS | Swap the implementation behind `search_all` for Elasticsearch/OpenSearch |
| Cache | `REDIS_URL` | in-memory | Set `REDIS_URL` |

### Payment flow

```
user → POST /api/payments/create → provider checkout → user pays
                                                          │
                     provider webhook (signed) ───────────┘
                                │
              POST /api/payments/webhook  (signature verified)
                                │
                    payment → successful  +  enrollment granted
```

The browser is never trusted to report success.

---

## Production deployment

> **Deploying to Azure?** [DEPLOY-AZURE.md](DEPLOY-AZURE.md) — one small VM
> (~$20-25/month) with automatic HTTPS:
> `SUBSCRIPTION_ID=<id> bash deploy/azure/deploy.sh`.

```
Internet
   │
   ▼
Nginx / load balancer  ── TLS termination
   │
   ├── /            → React static build (or CDN)
   ├── /api/        → FastAPI (uvicorn workers)
   ├── /robots.txt  → FastAPI
   └── /sitemap.xml → FastAPI
                        │
                        ├── PostgreSQL (managed, with backups)
                        ├── Redis (rate limits, cache)
                        └── S3-compatible storage / CDN (media)
```

Checklist:

- [ ] Real `JWT_SECRET` and database password
- [ ] `ENVIRONMENT=production`, `DEBUG=false`
- [ ] `BACKEND_CORS_ORIGINS` restricted to your domain
- [ ] `PUBLIC_SITE_URL` set — canonical URLs and the sitemap depend on it
- [ ] TLS enabled, HTTP redirected to HTTPS
- [ ] `alembic upgrade head` run as a deploy step
- [ ] Demo accounts and demo testimonials deleted
- [ ] Managed PostgreSQL with automated backups
- [ ] Redis provisioned
- [ ] Object storage + CDN for media
- [ ] Log aggregation and error reporting wired up
- [ ] Uptime monitoring on `/api/health`

Run more uvicorn workers behind the proxy for throughput:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 --proxy-headers
```

---

## Trust and legal position

This platform is **independent**. It is not affiliated with, endorsed by,
sponsored by, or an authorised training partner of any certification provider,
and it does not issue vendor certifications.

That position is enforced in the product, not just documented:

- `CertificationProvider.is_official_partner` defaults to `false`, and provider
  pages render an explicit independence notice unless an operator sets it and
  can document the relationship. A test asserts the default.
- Vendor names are used only to describe what the preparation material covers.
  Copy says *certification preparation*, *study resources*, *exam preparation*.
- Every certification page links to the vendor's own page as the authoritative
  source for exam cost, format and scheduling.
- Completion certificates are labelled as platform completion records, not
  vendor certifications, in the UI and in the model docstring.
- Practice resources are labelled as study aids built from published objectives,
  not real exam questions.
- Structured data omits `aggregateRating` entirely when a course has no reviews.
  There are no fabricated ratings anywhere.
- Seeded testimonials are flagged `is_demo` and render a **Demo content** badge.
- The About page shows no invented team members, awards or statistics; those
  sections state their own status until real data is supplied through the CMS.
- No claims of guaranteed jobs, salaries or exam success appear anywhere.

Legal pages (`/privacy`, `/terms`, `/refund-policy`, `/disclaimer`,
`/cookie-policy`) render copy from the `legal` site setting, so wording can be
reviewed and updated without a deploy. **Have a qualified professional review
that copy before launch** — the seeded text is a starting point, not legal
advice.

---

## License

Add your license before publishing.
