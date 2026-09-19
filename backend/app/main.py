from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router, seo_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.rate_limit import register_rate_limiting
from app.db.session import engine

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DESCRIPTION = """
REST API for the courses and certification preparation platform.

**Architecture:** React -> FastAPI -> SQLAlchemy -> PostgreSQL. The browser never
talks to the database directly.

**Auth:** JWT bearer access tokens (short lived) plus rotating refresh tokens.
Roles: `student`, `instructor`, `admin`.
"""

TAGS_METADATA = [
    {"name": "Authentication", "description": "Register, sign in, refresh, reset password."},
    {"name": "Users", "description": "Profile management and media uploads."},
    {"name": "Courses", "description": "Course catalogue, detail pages and reviews."},
    {"name": "Lessons", "description": "Lesson content and per-user progress."},
    {"name": "Certifications", "description": "Providers, certifications and study resources."},
    {"name": "Articles", "description": "Resource hub content managed through the CMS."},
    {"name": "Learning", "description": "Enrollment, progress tracking and the dashboard."},
    {"name": "Search", "description": "Cross-entity search."},
    {"name": "Contact", "description": "Contact form and analytics events."},
    {"name": "Payments", "description": "Checkout and provider webhooks."},
    {"name": "Site", "description": "Homepage aggregate, FAQs, testimonials, settings, SEO."},
    {"name": "Admin", "description": "Administration endpoints. Requires role=admin."},
]


# Hostnames that are fine in development but must never reach production:
# every canonical, og:url and sitemap entry is built from public_site_url, so
# shipping a placeholder hands search engines the wrong site as canonical.
_PLACEHOLDER_SITE_HOSTS = ("localhost", "127.0.0.1", ".cloudapp.azure.com", "example.com")


def _warn_on_placeholder_site_url() -> None:
    if not settings.is_production:
        return
    url = settings.public_site_url
    if any(host in url for host in _PLACEHOLDER_SITE_HOSTS):
        logger.warning(
            "PUBLIC_SITE_URL is still %s in production. Canonical URLs, og:url "
            "and sitemap.xml will all point there. Set it to the real domain.",
            url,
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting %s in %s mode", settings.project_name, settings.environment)
    _warn_on_placeholder_site_url()
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.project_name,
    description=DESCRIPTION,
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

register_rate_limiting(app)
register_exception_handlers(app)

app.include_router(api_router, prefix=settings.api_v1_prefix)
app.include_router(seo_router)

# Local media is served by the app only in development; in production Nginx or
# the CDN serves the object-storage bucket directly.
if settings.storage_provider == "local":
    upload_dir = Path("uploads/media")
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=str(upload_dir)), name="media")


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "name": settings.project_name,
        "docs": "/docs",
        "health": f"{settings.api_v1_prefix}/health",
    }
