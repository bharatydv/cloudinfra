"""Public site endpoints: homepage aggregate, FAQs, testimonials, settings, SEO."""

from __future__ import annotations

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import DbSession
from app.repositories import article_repo, certification_repo, course_repo, misc_repo
from app.schemas.catalog import CourseCard, CourseCategoryRead
from app.schemas.certification import CertificationCard, ProviderCard
from app.schemas.common import SeoMeta
from app.schemas.content import ArticleCard, FaqRead, TestimonialRead
from app.schemas.system import SiteSettingRead
from app.services import seo_service, serializers

router = APIRouter(tags=["Site"])


class HomePayload(BaseModel):
    categories: list[CourseCategoryRead]
    featured_courses: list[CourseCard]
    featured_certifications: list[CertificationCard]
    providers: list[ProviderCard]
    latest_articles: list[ArticleCard]
    testimonials: list[TestimonialRead]
    faqs: list[FaqRead]
    seo: SeoMeta


@router.get("/home", response_model=HomePayload)
async def homepage(db: DbSession) -> HomePayload:
    """Single aggregate call so the homepage renders in one round trip."""
    categories = await course_repo.list_categories(db)
    courses = await course_repo.featured_courses(db, limit=6)
    certifications = await certification_repo.featured(db, limit=6)
    providers = await certification_repo.list_providers(db)
    articles = await article_repo.latest(db, limit=3)
    testimonials = await misc_repo.list_testimonials(db, limit=6)
    faqs = await misc_repo.list_faqs(db, category="home")

    seo = seo_service.build_meta(
        title="Learn. Get Certified. Build Your Future.",
        description=(
            "Build job-ready skills and prepare for professional certifications with "
            "structured courses, practical resources and guided learning paths."
        ),
        path="/",
        structured_data=[
            seo_service.organization_schema(),
            seo_service.website_schema(),
            seo_service.faq_page_schema(
                [{"question": faq.question, "answer": faq.answer} for faq in faqs]
            ),
        ],
    )

    return HomePayload(
        categories=[
            CourseCategoryRead(
                id=category.id,
                name=category.name,
                slug=category.slug,
                description=category.description,
                icon=category.icon,
                position=category.position,
                course_count=count,
            )
            for category, count in categories
        ],
        featured_courses=[serializers.course_card(item) for item in courses],
        featured_certifications=[
            serializers.certification_card(item) for item in certifications
        ],
        providers=[
            serializers.provider_card(provider, count) for provider, count in providers
        ],
        latest_articles=[serializers.article_card(item) for item in articles],
        testimonials=[TestimonialRead.model_validate(item) for item in testimonials],
        faqs=[FaqRead.model_validate(item) for item in faqs],
        seo=seo,
    )


@router.get("/faqs", response_model=list[FaqRead])
async def list_faqs(db: DbSession, category: str | None = Query(None)) -> list[FaqRead]:
    rows = await misc_repo.list_faqs(db, category=category)
    return [FaqRead.model_validate(item) for item in rows]


@router.get("/testimonials", response_model=list[TestimonialRead])
async def list_testimonials(
    db: DbSession, limit: int = Query(12, ge=1, le=50)
) -> list[TestimonialRead]:
    rows = await misc_repo.list_testimonials(db, limit=limit)
    return [TestimonialRead.model_validate(item) for item in rows]


@router.get("/settings", response_model=list[SiteSettingRead])
async def list_public_settings(db: DbSession) -> list[SiteSettingRead]:
    """Editable site copy (brand, about page, legal pages, contact details)."""
    rows = await misc_repo.list_settings(db, public_only=True)
    return [SiteSettingRead.model_validate(item) for item in rows]


@router.get("/seo/page", response_model=SeoMeta)
async def page_seo(path: str = Query("/"), title: str | None = None) -> SeoMeta:
    """Meta for static marketing pages that have no database record."""
    known: dict[str, tuple[str, str]] = {
        "/about": (
            "About us",
            "Who we are, why we exist and how we build structured learning and "
            "certification preparation resources.",
        ),
        "/contact": (
            "Contact",
            "Get in touch with our team for support, partnerships or feedback.",
        ),
        "/courses": (
            "Online technology courses",
            "Browse structured, self-paced courses across cloud, AI, data, DevOps and "
            "digital marketing.",
        ),
        "/certifications": (
            "Professional certifications",
            "Explore certification preparation resources, learning paths and courses "
            "designed to help you build the skills you need.",
        ),
        "/resources": (
            "Learning resources, guides and roadmaps",
            "Guides, roadmaps and exam preparation resources for technology "
            "certifications and careers.",
        ),
        "/privacy": ("Privacy policy", "How we collect, use and protect your data."),
        "/terms": ("Terms of service", "The terms that govern use of this platform."),
        "/refund-policy": ("Refund policy", "When and how refunds are issued."),
        "/disclaimer": (
            "Disclaimer",
            "Important information about our independence from certification vendors.",
        ),
        "/cookie-policy": ("Cookie policy", "How we use cookies and similar technologies."),
    }
    page_title, description = known.get(path, (title or "Page", None))
    robots = (
        seo_service.NOINDEX
        if any(path.startswith(prefix) for prefix in seo_service.DISALLOWED_PATHS)
        else seo_service.INDEX
    )
    return seo_service.build_meta(
        title=page_title, description=description, path=path, robots=robots
    )


@router.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


# --------------------------------------------------------------------------
# Crawler files. Served by the API so they always reflect live content.
# --------------------------------------------------------------------------
seo_router = APIRouter(tags=["SEO"], include_in_schema=False)


@seo_router.get("/robots.txt")
async def robots_txt() -> Response:
    return Response(
        content=seo_service.build_robots_txt(),
        media_type="text/plain",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@seo_router.get("/sitemap.xml")
async def sitemap_xml(db: DbSession) -> Response:
    return Response(
        content=await seo_service.build_sitemap_xml(db),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )
