"""Search over courses, certifications, articles and certification resources.

Implemented with PostgreSQL full-text search (`to_tsvector` / `plainto_tsquery`
+ `ts_rank`), with a trigram-free ILIKE fallback so short or partial queries
still match. Each entity is queried through a small, uniform helper so a
dedicated engine (Elasticsearch/OpenSearch) can be swapped in behind
`search_all` without touching the API layer.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import String, cast, func, literal, or_, select
from sqlalchemy.dialects.postgresql import REGCONFIG
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Course, CourseCategory
from app.models.certification import (
    Certification,
    CertificationProvider,
    CertificationResource,
)
from app.models.content import Article, ArticleCategory
from app.models.enums import ContentStatus, SearchEntity
from app.repositories.article_repo import published_filter

LANG = "english"


def _config():
    """The text-search config must be typed as regconfig, not varchar."""
    return literal(LANG, type_=REGCONFIG)


def _tsvector(*columns):
    joined = func.concat_ws(" ", *columns)
    return func.to_tsvector(_config(), joined)


def _tsquery(query: str):
    return func.plainto_tsquery(_config(), query)


def _like_pattern(query: str) -> str:
    return f"%{query.strip().lower()}%"


async def search_courses(
    db: AsyncSession, query: str, limit: int
) -> list[dict[str, Any]]:
    vector = _tsvector(Course.title, Course.short_description, Course.description)
    tsq = _tsquery(query)
    pattern = _like_pattern(query)
    rank = func.ts_rank(vector, tsq)

    stmt = (
        select(
            Course.id,
            Course.title,
            Course.short_description,
            Course.slug,
            Course.level,
            Course.duration_minutes,
            Course.price,
            Course.currency,
            CourseCategory.name.label("category_name"),
            rank.label("rank"),
        )
        .outerjoin(CourseCategory, Course.category_id == CourseCategory.id)
        .where(
            Course.is_published.is_(True),
            or_(vector.op("@@")(tsq), func.lower(Course.title).like(pattern)),
        )
        .order_by(rank.desc(), Course.enrollment_count.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return [
        {
            "type": SearchEntity.COURSE,
            "id": row["id"],
            "title": row["title"],
            "description": row["short_description"],
            "url": f"/courses/{row['slug']}",
            "category": row["category_name"],
            "rank": float(row["rank"] or 0) + 0.05,
            "metadata": {
                "level": row["level"],
                "duration_minutes": row["duration_minutes"],
                "price": str(row["price"]),
                "currency": row["currency"],
            },
        }
        for row in rows
    ]


async def search_certifications(
    db: AsyncSession, query: str, limit: int
) -> list[dict[str, Any]]:
    vector = _tsvector(
        Certification.name,
        Certification.short_description,
        func.coalesce(Certification.exam_code, ""),
        cast(Certification.skills, String),
    )
    tsq = _tsquery(query)
    pattern = _like_pattern(query)
    rank = func.ts_rank(vector, tsq)

    stmt = (
        select(
            Certification.id,
            Certification.name,
            Certification.short_description,
            Certification.slug,
            Certification.level,
            Certification.exam_code,
            CertificationProvider.name.label("provider_name"),
            CertificationProvider.slug.label("provider_slug"),
            rank.label("rank"),
        )
        .join(CertificationProvider, Certification.provider_id == CertificationProvider.id)
        .where(
            Certification.is_published.is_(True),
            or_(
                vector.op("@@")(tsq),
                func.lower(Certification.name).like(pattern),
                func.lower(func.coalesce(Certification.exam_code, "")).like(pattern),
            ),
        )
        .order_by(rank.desc(), Certification.position.asc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return [
        {
            "type": SearchEntity.CERTIFICATION,
            "id": row["id"],
            "title": row["name"],
            "description": row["short_description"],
            "url": f"/certifications/{row['provider_slug']}/{row['slug']}",
            "category": row["provider_name"],
            "rank": float(row["rank"] or 0) + 0.05,
            "metadata": {"level": row["level"], "exam_code": row["exam_code"]},
        }
        for row in rows
    ]


async def search_articles(
    db: AsyncSession, query: str, limit: int
) -> list[dict[str, Any]]:
    vector = _tsvector(Article.title, Article.excerpt, Article.content)
    tsq = _tsquery(query)
    pattern = _like_pattern(query)
    rank = func.ts_rank(vector, tsq)

    stmt = (
        select(
            Article.id,
            Article.title,
            Article.excerpt,
            Article.slug,
            Article.reading_minutes,
            Article.published_at,
            ArticleCategory.name.label("category_name"),
            rank.label("rank"),
        )
        .outerjoin(ArticleCategory, Article.category_id == ArticleCategory.id)
        .where(
            published_filter(),
            or_(vector.op("@@")(tsq), func.lower(Article.title).like(pattern)),
        )
        .order_by(rank.desc(), Article.published_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return [
        {
            "type": SearchEntity.ARTICLE,
            "id": row["id"],
            "title": row["title"],
            "description": row["excerpt"],
            "url": f"/resources/{row['slug']}",
            "category": row["category_name"],
            "rank": float(row["rank"] or 0),
            "metadata": {
                "reading_minutes": row["reading_minutes"],
                "published_at": (
                    row["published_at"].isoformat() if row["published_at"] else None
                ),
            },
        }
        for row in rows
    ]


async def search_resources(
    db: AsyncSession, query: str, limit: int
) -> list[dict[str, Any]]:
    vector = _tsvector(
        CertificationResource.title, func.coalesce(CertificationResource.description, "")
    )
    tsq = _tsquery(query)
    pattern = _like_pattern(query)
    rank = func.ts_rank(vector, tsq)

    stmt = (
        select(
            CertificationResource.id,
            CertificationResource.title,
            CertificationResource.description,
            CertificationResource.resource_type,
            Certification.slug.label("certification_slug"),
            CertificationProvider.slug.label("provider_slug"),
            rank.label("rank"),
        )
        .join(Certification, CertificationResource.certification_id == Certification.id)
        .join(CertificationProvider, Certification.provider_id == CertificationProvider.id)
        .where(
            CertificationResource.status == ContentStatus.PUBLISHED.value,
            Certification.is_published.is_(True),
            or_(vector.op("@@")(tsq), func.lower(CertificationResource.title).like(pattern)),
        )
        .order_by(rank.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return [
        {
            "type": SearchEntity.RESOURCE,
            "id": row["id"],
            "title": row["title"],
            "description": row["description"] or "",
            "url": (
                f"/certifications/{row['provider_slug']}/{row['certification_slug']}"
                f"#resource-{row['id']}"
            ),
            "category": row["resource_type"].replace("_", " ").title(),
            "rank": float(row["rank"] or 0),
            "metadata": {"resource_type": row["resource_type"]},
        }
        for row in rows
    ]


async def search_all(
    db: AsyncSession, query: str, *, types: list[str] | None = None, limit: int = 20
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    query = query.strip()
    if not query:
        return [], {}

    wanted = set(types) if types else {e.value for e in SearchEntity}
    per_type_limit = max(limit, 10)

    results: list[dict[str, Any]] = []
    counts: dict[str, int] = {}

    runners = {
        SearchEntity.COURSE.value: search_courses,
        SearchEntity.CERTIFICATION.value: search_certifications,
        SearchEntity.ARTICLE.value: search_articles,
        SearchEntity.RESOURCE.value: search_resources,
    }
    for key, runner in runners.items():
        if key not in wanted:
            continue
        found = await runner(db, query, per_type_limit)
        counts[key] = len(found)
        results.extend(found)

    results.sort(key=lambda item: item["rank"], reverse=True)
    return results[:limit], counts
