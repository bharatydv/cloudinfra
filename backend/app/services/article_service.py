from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.models.content import Article, ArticleCategory
from app.models.enums import ContentStatus
from app.models.user import User
from app.repositories import article_repo, certification_repo, course_repo
from app.schemas.common import Breadcrumb, FaqItem, TocEntry
from app.schemas.content import (
    ArticleCategoryWrite,
    ArticleDetail,
    ArticleUpdate,
    ArticleWrite,
)
from app.services import seo_service, serializers
from app.utils.text import build_excerpt, extract_headings, reading_minutes, slugify, unique_slug


async def build_article_detail(db: AsyncSession, article: Article) -> ArticleDetail:
    card = serializers.article_card(article)
    related_articles = await article_repo.related(db, article)
    related_courses = await course_repo.featured_courses(db, limit=3)
    related_certifications = await certification_repo.featured(db, limit=3)

    breadcrumbs = [
        Breadcrumb(name="Home", url="/"),
        Breadcrumb(name="Resources", url="/resources"),
    ]
    if article.category:
        breadcrumbs.append(
            Breadcrumb(
                name=article.category.name, url=f"/resources?category={article.category.slug}"
            )
        )
    breadcrumbs.append(Breadcrumb(name=article.title, url=f"/resources/{article.slug}"))

    faq = [FaqItem(**item) for item in (article.faq or [])]
    faq_dicts = [item.model_dump() for item in faq]

    return ArticleDetail(
        **card.model_dump(),
        content=article.content,
        view_count=article.view_count,
        status=article.status,
        created_at=article.created_at,
        canonical_url=article.canonical_url,
        table_of_contents=[TocEntry(**entry) for entry in extract_headings(article.content)],
        faq=faq,
        related_articles=[serializers.article_card(item) for item in related_articles],
        related_courses=[serializers.course_card(item) for item in related_courses],
        related_certifications=[
            serializers.certification_card(item) for item in related_certifications
        ],
        seo=seo_service.build_meta(
            title=article.meta_title or article.title,
            description=article.meta_description or article.excerpt,
            path=f"/resources/{article.slug}",
            canonical_url=article.canonical_url,
            og_image=article.og_image or article.featured_image,
            breadcrumbs=breadcrumbs,
            structured_data=[
                seo_service.article_schema(article),
                seo_service.faq_page_schema(faq_dicts),
            ],
        ),
    )


def _derive_fields(data: dict, content: str, excerpt: str | None) -> dict:
    data["reading_minutes"] = reading_minutes(content)
    if not excerpt:
        data["excerpt"] = build_excerpt(content)
    return data


async def create_article(
    db: AsyncSession, payload: ArticleWrite, author: User
) -> Article:
    slug = await unique_slug(
        payload.slug or payload.title,
        lambda value: article_repo.slug_exists(db, value),
        max_length=240,
    )
    data = payload.model_dump(exclude={"slug", "tag_ids", "tag_names", "faq"})
    data["faq"] = [item.model_dump() for item in payload.faq]
    data = _derive_fields(data, payload.content, payload.excerpt)
    data["author_id"] = payload.author_id or author.id

    if payload.status == ContentStatus.PUBLISHED and not payload.published_at:
        data["published_at"] = datetime.now(UTC)

    article = Article(**data, slug=slug)
    tags = await article_repo.tags_by_ids(db, payload.tag_ids)
    tags += await article_repo.get_or_create_tags(db, payload.tag_names)
    article.tags = tags

    db.add(article)
    await db.commit()
    created = await article_repo.get_by_id(db, article.id)
    assert created is not None
    return created


async def update_article(
    db: AsyncSession, article_id: uuid.UUID, payload: ArticleUpdate
) -> Article:
    article = await article_repo.get_by_id(db, article_id)
    if article is None:
        raise NotFoundError("Article not found.")

    data = payload.model_dump(
        exclude_unset=True, exclude={"slug", "tag_ids", "tag_names", "faq"}
    )
    if payload.faq is not None:
        data["faq"] = [item.model_dump() for item in payload.faq]
    if payload.slug:
        slug = slugify(payload.slug, max_length=240)
        if await article_repo.slug_exists(db, slug, article.id):
            raise ConflictError("That article URL is already in use.")
        article.slug = slug
    if payload.content is not None:
        data = _derive_fields(data, payload.content, payload.excerpt or article.excerpt)

    # Publishing for the first time stamps published_at automatically.
    if (
        payload.status == ContentStatus.PUBLISHED
        and article.published_at is None
        and payload.published_at is None
    ):
        data["published_at"] = datetime.now(UTC)

    for field, value in data.items():
        setattr(article, field, value)

    if payload.tag_ids is not None or payload.tag_names is not None:
        tags = await article_repo.tags_by_ids(db, payload.tag_ids or [])
        tags += await article_repo.get_or_create_tags(db, payload.tag_names or [])
        article.tags = tags

    await db.commit()
    refreshed = await article_repo.get_by_id(db, article.id)
    assert refreshed is not None
    return refreshed


async def delete_article(db: AsyncSession, article_id: uuid.UUID) -> None:
    article = await article_repo.get_by_id(db, article_id)
    if article is None:
        raise NotFoundError("Article not found.")
    await db.delete(article)
    await db.commit()


# --- Categories ------------------------------------------------------------
async def create_article_category(
    db: AsyncSession, payload: ArticleCategoryWrite
) -> ArticleCategory:
    slug = slugify(payload.slug or payload.name, max_length=140)
    if await article_repo.category_slug_exists(db, slug):
        raise ConflictError("That category URL is already in use.")
    category = ArticleCategory(**payload.model_dump(exclude={"slug"}), slug=slug)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def update_article_category(
    db: AsyncSession, category_id: uuid.UUID, payload: ArticleCategoryWrite
) -> ArticleCategory:
    category = await db.get(ArticleCategory, category_id)
    if category is None:
        raise NotFoundError("Category not found.")
    data = payload.model_dump(exclude_unset=True, exclude={"slug"})
    if payload.slug:
        slug = slugify(payload.slug, max_length=140)
        if await article_repo.category_slug_exists(db, slug, category.id):
            raise ConflictError("That category URL is already in use.")
        category.slug = slug
    for field, value in data.items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return category


async def delete_article_category(db: AsyncSession, category_id: uuid.UUID) -> None:
    category = await db.get(ArticleCategory, category_id)
    if category is None:
        raise NotFoundError("Category not found.")
    await db.delete(category)
    await db.commit()
