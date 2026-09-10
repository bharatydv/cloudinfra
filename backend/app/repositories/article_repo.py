from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.pagination import PageParams
from app.models.content import Article, ArticleCategory, Tag
from app.models.enums import ContentStatus

ArticleSort = Literal["latest", "popular", "oldest", "title"]

_LOADS = (
    selectinload(Article.author),
    selectinload(Article.category),
    selectinload(Article.tags),
)


def published_filter():
    """Scheduled posts become visible automatically once their time passes."""
    now = datetime.now(UTC)
    return (
        Article.status.in_([ContentStatus.PUBLISHED.value, ContentStatus.SCHEDULED.value])
        & Article.published_at.is_not(None)
        & (Article.published_at <= now)
    )


def _apply_sort(stmt: Select, sort: ArticleSort) -> Select:
    match sort:
        case "popular":
            return stmt.order_by(Article.view_count.desc(), Article.published_at.desc())
        case "oldest":
            return stmt.order_by(Article.published_at.asc())
        case "title":
            return stmt.order_by(Article.title.asc())
        case _:
            return stmt.order_by(
                Article.published_at.desc().nulls_last(), Article.created_at.desc()
            )


async def list_articles(
    db: AsyncSession,
    params: PageParams,
    *,
    search: str | None = None,
    category_slug: str | None = None,
    tag_slug: str | None = None,
    featured_only: bool = False,
    status: str | None = None,
    public_only: bool = True,
    sort: ArticleSort = "latest",
) -> tuple[list[Article], int]:
    stmt = select(Article)
    if public_only:
        stmt = stmt.where(published_filter())
    elif status:
        stmt = stmt.where(Article.status == status)

    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Article.title).like(pattern),
                func.lower(Article.excerpt).like(pattern),
            )
        )
    if category_slug:
        stmt = stmt.join(ArticleCategory).where(ArticleCategory.slug == category_slug)
    if tag_slug:
        stmt = stmt.where(Article.tags.any(Tag.slug == tag_slug))
    if featured_only:
        stmt = stmt.where(Article.is_featured.is_(True))

    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await db.scalars(
        _apply_sort(stmt, sort).options(*_LOADS).offset(params.offset).limit(params.limit)
    )
    return list(rows.unique()), total


async def get_by_slug(
    db: AsyncSession, slug: str, *, public_only: bool = True
) -> Article | None:
    stmt = select(Article).where(Article.slug == slug).options(*_LOADS)
    if public_only:
        stmt = stmt.where(published_filter())
    return await db.scalar(stmt)


async def get_by_id(db: AsyncSession, article_id: uuid.UUID) -> Article | None:
    return await db.scalar(
        select(Article).where(Article.id == article_id).options(*_LOADS)
    )


async def slug_exists(db: AsyncSession, slug: str, exclude_id: uuid.UUID | None = None) -> bool:
    stmt = select(Article.id).where(Article.slug == slug)
    if exclude_id:
        stmt = stmt.where(Article.id != exclude_id)
    return await db.scalar(stmt) is not None


async def featured(db: AsyncSession, limit: int = 3) -> list[Article]:
    rows = await db.scalars(
        select(Article)
        .where(published_filter(), Article.is_featured.is_(True))
        .order_by(Article.published_at.desc())
        .options(*_LOADS)
        .limit(limit)
    )
    return list(rows.unique())


async def latest(db: AsyncSession, limit: int = 6) -> list[Article]:
    rows = await db.scalars(
        select(Article)
        .where(published_filter())
        .order_by(Article.published_at.desc())
        .options(*_LOADS)
        .limit(limit)
    )
    return list(rows.unique())


async def popular(db: AsyncSession, limit: int = 5) -> list[Article]:
    rows = await db.scalars(
        select(Article)
        .where(published_filter())
        .order_by(Article.view_count.desc(), Article.published_at.desc())
        .options(*_LOADS)
        .limit(limit)
    )
    return list(rows.unique())


async def related(db: AsyncSession, article: Article, limit: int = 3) -> list[Article]:
    stmt = (
        select(Article)
        .where(published_filter(), Article.id != article.id)
        .options(*_LOADS)
        .limit(limit)
    )
    if article.category_id:
        stmt = stmt.where(Article.category_id == article.category_id)
    rows = await db.scalars(stmt.order_by(Article.published_at.desc()))
    found = list(rows.unique())
    if found:
        return found
    fallback = await db.scalars(
        select(Article)
        .where(published_filter(), Article.id != article.id)
        .order_by(Article.published_at.desc())
        .options(*_LOADS)
        .limit(limit)
    )
    return list(fallback.unique())


async def increment_views(db: AsyncSession, article: Article) -> None:
    article.view_count = (article.view_count or 0) + 1
    await db.commit()


# --- Categories & tags ------------------------------------------------------
async def list_categories(db: AsyncSession) -> list[tuple[ArticleCategory, int]]:
    stmt = (
        select(ArticleCategory, func.count(Article.id))
        .outerjoin(Article, (Article.category_id == ArticleCategory.id) & published_filter())
        .group_by(ArticleCategory.id)
        .order_by(ArticleCategory.position, ArticleCategory.name)
    )
    return [(row[0], row[1]) for row in (await db.execute(stmt)).all()]


async def get_category_by_slug(db: AsyncSession, slug: str) -> ArticleCategory | None:
    return await db.scalar(select(ArticleCategory).where(ArticleCategory.slug == slug))


async def category_slug_exists(
    db: AsyncSession, slug: str, exclude_id: uuid.UUID | None = None
) -> bool:
    stmt = select(ArticleCategory.id).where(ArticleCategory.slug == slug)
    if exclude_id:
        stmt = stmt.where(ArticleCategory.id != exclude_id)
    return await db.scalar(stmt) is not None


async def list_tags(db: AsyncSession, limit: int = 40) -> list[Tag]:
    rows = await db.scalars(select(Tag).order_by(Tag.name).limit(limit))
    return list(rows)


async def get_or_create_tags(db: AsyncSession, names: list[str]) -> list[Tag]:
    from app.utils.text import slugify

    tags: list[Tag] = []
    for raw in names:
        name = raw.strip()
        if not name:
            continue
        slug = slugify(name, max_length=100)
        tag = await db.scalar(select(Tag).where(Tag.slug == slug))
        if tag is None:
            tag = Tag(name=name, slug=slug)
            db.add(tag)
            await db.flush()
        tags.append(tag)
    return tags


async def tags_by_ids(db: AsyncSession, ids: list[uuid.UUID]) -> list[Tag]:
    if not ids:
        return []
    rows = await db.scalars(select(Tag).where(Tag.id.in_(ids)))
    return list(rows)
