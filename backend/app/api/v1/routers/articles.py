from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import AdminUser, DbSession, StaffUser
from app.core.errors import NotFoundError
from app.core.pagination import Page, PageParams, page_params
from app.models.enums import ContentStatus
from app.repositories import article_repo
from app.schemas.common import Message
from app.schemas.content import (
    ArticleCard,
    ArticleCategoryRead,
    ArticleCategoryWrite,
    ArticleDetail,
    ArticleUpdate,
    ArticleWrite,
    TagRead,
)
from app.services import article_service, serializers

router = APIRouter(tags=["Articles"])
Params = Annotated[PageParams, Depends(page_params)]


@router.get("/article-categories", response_model=list[ArticleCategoryRead])
async def list_article_categories(db: DbSession) -> list[ArticleCategoryRead]:
    rows = await article_repo.list_categories(db)
    return [
        ArticleCategoryRead(
            id=category.id,
            name=category.name,
            slug=category.slug,
            description=category.description,
            icon=category.icon,
            position=category.position,
            article_count=count,
        )
        for category, count in rows
    ]


@router.get("/tags", response_model=list[TagRead])
async def list_tags(db: DbSession) -> list[TagRead]:
    return [TagRead.model_validate(tag) for tag in await article_repo.list_tags(db)]


@router.get("/articles", response_model=Page[ArticleCard])
async def list_articles(
    db: DbSession,
    params: Params,
    q: str | None = Query(None, description="Free-text search"),
    category: str | None = Query(None, description="Category slug"),
    tag: str | None = Query(None, description="Tag slug"),
    featured: bool = False,
    sort: Literal["latest", "popular", "oldest", "title"] = "latest",
) -> Page[ArticleCard]:
    items, total = await article_repo.list_articles(
        db,
        params,
        search=q,
        category_slug=category,
        tag_slug=tag,
        featured_only=featured,
        sort=sort,
    )
    return Page.create([serializers.article_card(item) for item in items], total, params)


@router.get("/articles/featured", response_model=list[ArticleCard])
async def featured_articles(db: DbSession, limit: int = Query(3, ge=1, le=12)):
    return [serializers.article_card(item) for item in await article_repo.featured(db, limit)]


@router.get("/articles/popular", response_model=list[ArticleCard])
async def popular_articles(db: DbSession, limit: int = Query(5, ge=1, le=12)):
    return [serializers.article_card(item) for item in await article_repo.popular(db, limit)]


@router.get("/articles/{slug}", response_model=ArticleDetail)
async def get_article(slug: str, db: DbSession) -> ArticleDetail:
    article = await article_repo.get_by_slug(db, slug)
    if article is None:
        raise NotFoundError("Article not found.")
    detail = await article_service.build_article_detail(db, article)
    await article_repo.increment_views(db, article)
    return detail


# --------------------------------------------------------------------------
# Admin CMS
# --------------------------------------------------------------------------
@router.get("/admin/articles", response_model=Page[ArticleCard], tags=["Admin"])
async def admin_list_articles(
    db: DbSession,
    params: Params,
    _: StaffUser,
    q: str | None = None,
    article_status: ContentStatus | None = Query(None, alias="status"),
) -> Page[ArticleCard]:
    items, total = await article_repo.list_articles(
        db,
        params,
        search=q,
        public_only=False,
        status=article_status.value if article_status else None,
    )
    return Page.create([serializers.article_card(item) for item in items], total, params)


@router.get("/admin/articles/{article_id}", response_model=ArticleDetail, tags=["Admin"])
async def admin_get_article(
    article_id: uuid.UUID, db: DbSession, _: StaffUser
) -> ArticleDetail:
    article = await article_repo.get_by_id(db, article_id)
    if article is None:
        raise NotFoundError("Article not found.")
    return await article_service.build_article_detail(db, article)


@router.post(
    "/articles",
    response_model=ArticleDetail,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin"],
)
async def create_article(
    payload: ArticleWrite, db: DbSession, user: StaffUser
) -> ArticleDetail:
    article = await article_service.create_article(db, payload, user)
    return await article_service.build_article_detail(db, article)


@router.put("/articles/{article_id}", response_model=ArticleDetail, tags=["Admin"])
async def update_article(
    article_id: uuid.UUID, payload: ArticleUpdate, db: DbSession, _: StaffUser
) -> ArticleDetail:
    article = await article_service.update_article(db, article_id, payload)
    return await article_service.build_article_detail(db, article)


@router.delete("/articles/{article_id}", response_model=Message, tags=["Admin"])
async def delete_article(article_id: uuid.UUID, db: DbSession, _: AdminUser) -> Message:
    await article_service.delete_article(db, article_id)
    return Message(message="Article deleted.")


@router.post(
    "/article-categories",
    response_model=ArticleCategoryRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin"],
)
async def create_article_category(
    payload: ArticleCategoryWrite, db: DbSession, _: AdminUser
) -> ArticleCategoryRead:
    category = await article_service.create_article_category(db, payload)
    return ArticleCategoryRead.model_validate(category)


@router.put(
    "/article-categories/{category_id}", response_model=ArticleCategoryRead, tags=["Admin"]
)
async def update_article_category(
    category_id: uuid.UUID, payload: ArticleCategoryWrite, db: DbSession, _: AdminUser
) -> ArticleCategoryRead:
    category = await article_service.update_article_category(db, category_id, payload)
    return ArticleCategoryRead.model_validate(category)


@router.delete("/article-categories/{category_id}", response_model=Message, tags=["Admin"])
async def delete_article_category(
    category_id: uuid.UUID, db: DbSession, _: AdminUser
) -> Message:
    await article_service.delete_article_category(db, category_id)
    return Message(message="Category deleted.")
