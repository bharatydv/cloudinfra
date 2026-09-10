"""SEO helpers: meta tags, breadcrumbs, JSON-LD, robots.txt and sitemap.xml.

Structured data here only ever describes content that is actually rendered on
the page. Ratings are emitted only when real reviews exist -- never fabricated.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from xml.sax.saxutils import escape

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.catalog import Course, CourseCategory
from app.models.certification import Certification, CertificationProvider
from app.models.content import Article, ArticleCategory
from app.repositories.article_repo import published_filter
from app.schemas.common import Breadcrumb, SeoMeta

NOINDEX = "noindex,nofollow"
INDEX = "index,follow"

# Routes that must never be indexed.
DISALLOWED_PATHS = (
    "/admin",
    "/dashboard",
    "/learn",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/checkout",
    "/search",
    "/api/",
)


def absolute_url(path: str) -> str:
    base = settings.public_site_url.rstrip("/")
    return f"{base}{path if path.startswith('/') else '/' + path}"


def _truncate(value: str | None, limit: int = 160) -> str | None:
    if not value:
        return None
    text = " ".join(value.split())
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "..."


def breadcrumb_list(items: list[Breadcrumb]) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index + 1,
                "name": item.name,
                "item": absolute_url(item.url),
            }
            for index, item in enumerate(items)
        ],
    }


def faq_page_schema(faqs: list[dict[str, str]]) -> dict[str, Any] | None:
    if not faqs:
        return None
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": faq["question"],
                "acceptedAnswer": {"@type": "Answer", "text": faq["answer"]},
            }
            for faq in faqs
        ],
    }


def course_schema(course: Course) -> dict[str, Any]:
    data: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "Course",
        "name": course.title,
        "description": course.short_description,
        "url": absolute_url(f"/courses/{course.slug}"),
        "provider": {
            "@type": "Organization",
            "name": settings.email_from_name,
            "url": settings.public_site_url,
        },
        "educationalLevel": course.level,
        "inLanguage": course.language,
        "hasCourseInstance": {
            "@type": "CourseInstance",
            "courseMode": "online",
            "courseWorkload": f"PT{max(course.duration_minutes, 1)}M",
        },
    }
    # Only emit aggregateRating when genuine reviews back it up.
    if course.rating_count > 0 and course.rating_average > 0:
        data["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": float(course.rating_average),
            "reviewCount": course.rating_count,
            "bestRating": 5,
            "worstRating": 1,
        }
    if course.price is not None:
        data["offers"] = {
            "@type": "Offer",
            "price": str(course.price),
            "priceCurrency": course.currency,
            "category": "Free" if float(course.price) == 0 else "Paid",
            "availability": "https://schema.org/InStock",
            "url": absolute_url(f"/courses/{course.slug}"),
        }
    return data


def article_schema(article: Article) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": article.title,
        "description": article.excerpt,
        "url": absolute_url(f"/resources/{article.slug}"),
        "datePublished": article.published_at.isoformat() if article.published_at else None,
        "dateModified": article.updated_at.isoformat(),
        "image": article.featured_image or article.og_image,
        "author": {
            "@type": "Person",
            "name": article.author.name if article.author else settings.email_from_name,
        },
        "publisher": {
            "@type": "Organization",
            "name": settings.email_from_name,
            "url": settings.public_site_url,
        },
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": absolute_url(f"/resources/{article.slug}"),
        },
    }


def organization_schema() -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": settings.email_from_name,
        "url": settings.public_site_url,
        "email": settings.email_from_address,
    }


def website_schema() -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": settings.email_from_name,
        "url": settings.public_site_url,
        "potentialAction": {
            "@type": "SearchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": absolute_url("/search?q={search_term_string}"),
            },
            "query-input": "required name=search_term_string",
        },
    }


def build_meta(
    *,
    title: str,
    description: str | None,
    path: str,
    canonical_url: str | None = None,
    og_image: str | None = None,
    breadcrumbs: list[Breadcrumb] | None = None,
    structured_data: list[dict[str, Any] | None] | None = None,
    robots: str = INDEX,
) -> SeoMeta:
    crumbs = breadcrumbs or []
    data = [item for item in (structured_data or []) if item]
    if crumbs:
        data.insert(0, breadcrumb_list(crumbs))
    return SeoMeta(
        title=title,
        description=_truncate(description),
        canonical_url=canonical_url or absolute_url(path),
        og_image=og_image,
        robots=robots,
        breadcrumbs=crumbs,
        structured_data=data,
    )


# --------------------------------------------------------------------------
# robots.txt / sitemap.xml
# --------------------------------------------------------------------------
def build_robots_txt() -> str:
    lines = ["User-agent: *"]
    lines += [f"Disallow: {path}" for path in DISALLOWED_PATHS]
    lines.append("Allow: /")
    lines.append("")
    lines.append(f"Sitemap: {absolute_url('/sitemap.xml')}")
    return "\n".join(lines) + "\n"


def _url_entry(
    loc: str, lastmod: datetime | None, changefreq: str, priority: str
) -> str:
    parts = ["  <url>", f"    <loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"    <lastmod>{lastmod.astimezone(UTC).date().isoformat()}</lastmod>")
    parts.append(f"    <changefreq>{changefreq}</changefreq>")
    parts.append(f"    <priority>{priority}</priority>")
    parts.append("  </url>")
    return "\n".join(parts)


async def build_sitemap_xml(db: AsyncSession) -> str:
    now = datetime.now(UTC)
    entries: list[str] = [
        _url_entry(absolute_url("/"), now, "daily", "1.0"),
        _url_entry(absolute_url("/certifications"), now, "daily", "0.9"),
        _url_entry(absolute_url("/courses"), now, "daily", "0.9"),
        _url_entry(absolute_url("/resources"), now, "daily", "0.9"),
        _url_entry(absolute_url("/about"), now, "monthly", "0.5"),
        _url_entry(absolute_url("/contact"), now, "monthly", "0.5"),
        _url_entry(absolute_url("/privacy"), now, "yearly", "0.3"),
        _url_entry(absolute_url("/terms"), now, "yearly", "0.3"),
        _url_entry(absolute_url("/refund-policy"), now, "yearly", "0.3"),
        _url_entry(absolute_url("/disclaimer"), now, "yearly", "0.3"),
        _url_entry(absolute_url("/cookie-policy"), now, "yearly", "0.3"),
    ]

    categories = await db.scalars(
        select(CourseCategory).where(CourseCategory.is_published.is_(True))
    )
    for category in categories:
        entries.append(
            _url_entry(
                absolute_url(f"/courses?category={category.slug}"),
                category.updated_at,
                "weekly",
                "0.6",
            )
        )

    courses = await db.scalars(select(Course).where(Course.is_published.is_(True)))
    for course in courses:
        entries.append(
            _url_entry(
                absolute_url(f"/courses/{course.slug}"), course.updated_at, "weekly", "0.8"
            )
        )

    providers = await db.scalars(
        select(CertificationProvider).where(CertificationProvider.is_published.is_(True))
    )
    for provider in providers:
        entries.append(
            _url_entry(
                absolute_url(f"/certifications/{provider.slug}"),
                provider.updated_at,
                "weekly",
                "0.8",
            )
        )

    rows = await db.execute(
        select(Certification, CertificationProvider.slug)
        .join(CertificationProvider, Certification.provider_id == CertificationProvider.id)
        .where(Certification.is_published.is_(True))
    )
    for certification, provider_slug in rows.all():
        entries.append(
            _url_entry(
                absolute_url(f"/certifications/{provider_slug}/{certification.slug}"),
                certification.updated_at,
                "weekly",
                "0.8",
            )
        )

    article_categories = await db.scalars(select(ArticleCategory))
    for category in article_categories:
        entries.append(
            _url_entry(
                absolute_url(f"/resources?category={category.slug}"),
                category.updated_at,
                "weekly",
                "0.6",
            )
        )

    articles = await db.scalars(select(Article).where(published_filter()))
    for article in articles:
        entries.append(
            _url_entry(
                absolute_url(f"/resources/{article.slug}"),
                article.updated_at,
                "weekly",
                "0.7",
            )
        )

    body = "\n".join(entries)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n"
        "</urlset>\n"
    )
