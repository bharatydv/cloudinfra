from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import AdminUser, CurrentUser, DbSession, OptionalUser, StaffUser
from app.core.errors import NotFoundError
from app.core.pagination import Page, PageParams, page_params
from app.models.enums import CourseLevel
from app.repositories import course_repo
from app.schemas.catalog import (
    CourseCard,
    CourseCategoryRead,
    CourseCategoryWrite,
    CourseDetail,
    CourseModuleRead,
    CourseModuleUpdate,
    CourseModuleWrite,
    CourseReviewRead,
    CourseReviewWrite,
    CourseUpdate,
    CourseWrite,
    ReorderRequest,
)
from app.schemas.common import Message
from app.services import course_service, enrollment_service, serializers

router = APIRouter(tags=["Courses"])
Params = Annotated[PageParams, Depends(page_params)]


# --------------------------------------------------------------------------
# Public
# --------------------------------------------------------------------------
@router.get("/course-categories", response_model=list[CourseCategoryRead])
async def list_course_categories(db: DbSession) -> list[CourseCategoryRead]:
    rows = await course_repo.list_categories(db)
    return [
        CourseCategoryRead(
            id=category.id,
            name=category.name,
            slug=category.slug,
            description=category.description,
            icon=category.icon,
            position=category.position,
            course_count=count,
        )
        for category, count in rows
    ]


@router.get("/courses", response_model=Page[CourseCard])
async def list_courses(
    db: DbSession,
    params: Params,
    q: str | None = Query(None, description="Free-text search"),
    category: str | None = Query(None, description="Category slug"),
    level: CourseLevel | None = None,
    max_duration_minutes: int | None = Query(None, ge=0),
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    free_only: bool = False,
    min_rating: float | None = Query(None, ge=0, le=5),
    sort: Literal["popular", "newest", "rating", "price_asc", "price_desc", "title"] = "popular",
) -> Page[CourseCard]:
    """Paginated course catalogue. Everything is served from PostgreSQL."""
    items, total = await course_repo.list_courses(
        db,
        params,
        search=q,
        category_slug=category,
        level=level.value if level else None,
        max_duration_minutes=max_duration_minutes,
        min_price=min_price,
        max_price=max_price,
        free_only=free_only,
        min_rating=min_rating,
        sort=sort,
    )
    return Page.create([serializers.course_card(item) for item in items], total, params)


@router.get("/courses/{slug}", response_model=CourseDetail)
async def get_course(slug: str, db: DbSession, viewer: OptionalUser) -> CourseDetail:
    course = await course_repo.get_by_slug(db, slug)
    if course is None:
        raise NotFoundError("Course not found.")
    return await course_service.build_course_detail(db, course, viewer)


@router.get("/courses/{course_id}/modules", response_model=list[CourseModuleRead])
async def list_course_modules(
    course_id: uuid.UUID, db: DbSession
) -> list[CourseModuleRead]:
    course = await course_repo.get_by_id(db, course_id)
    if course is None:
        raise NotFoundError("Course not found.")
    return serializers.course_modules(course)


@router.post(
    "/courses/{course_id}/reviews",
    response_model=CourseReviewRead,
    status_code=status.HTTP_201_CREATED,
)
async def review_course(
    course_id: uuid.UUID, payload: CourseReviewWrite, user: CurrentUser, db: DbSession
) -> CourseReviewRead:
    """Only enrolled learners may review, which keeps ratings honest."""
    review = await enrollment_service.upsert_review(db, user, course_id, payload)
    return CourseReviewRead.model_validate(review)


# --------------------------------------------------------------------------
# Admin / instructor
# --------------------------------------------------------------------------
@router.get("/admin/courses", response_model=Page[CourseCard], tags=["Admin"])
async def admin_list_courses(
    db: DbSession,
    params: Params,
    _: StaffUser,
    q: str | None = None,
    is_published: bool | None = None,
) -> Page[CourseCard]:
    items, total = await course_repo.list_courses(
        db, params, search=q, is_published=is_published, sort="newest"
    )
    return Page.create([serializers.course_card(item) for item in items], total, params)


@router.get("/admin/courses/{course_id}", response_model=CourseDetail, tags=["Admin"])
async def admin_get_course(
    course_id: uuid.UUID, db: DbSession, user: StaffUser
) -> CourseDetail:
    course = await course_repo.get_by_id(db, course_id)
    if course is None:
        raise NotFoundError("Course not found.")
    return await course_service.build_course_detail(db, course, user)


@router.post(
    "/courses", response_model=CourseDetail, status_code=status.HTTP_201_CREATED, tags=["Admin"]
)
async def create_course(payload: CourseWrite, db: DbSession, user: StaffUser) -> CourseDetail:
    course = await course_service.create_course(db, payload)
    return await course_service.build_course_detail(db, course, user)


@router.put("/courses/{course_id}", response_model=CourseDetail, tags=["Admin"])
async def update_course(
    course_id: uuid.UUID, payload: CourseUpdate, db: DbSession, user: StaffUser
) -> CourseDetail:
    course = await course_service.update_course(db, course_id, payload)
    return await course_service.build_course_detail(db, course, user)


@router.post("/courses/{course_id}/publish", response_model=CourseDetail, tags=["Admin"])
async def publish_course(
    course_id: uuid.UUID, db: DbSession, user: StaffUser, published: bool = True
) -> CourseDetail:
    course = await course_service.set_published(db, course_id, published)
    return await course_service.build_course_detail(db, course, user)


@router.delete("/courses/{course_id}", response_model=Message, tags=["Admin"])
async def delete_course(course_id: uuid.UUID, db: DbSession, _: AdminUser) -> Message:
    await course_service.delete_course(db, course_id)
    return Message(message="Course deleted.")


# --- Modules ---------------------------------------------------------------
@router.post(
    "/modules",
    response_model=CourseModuleRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin"],
)
async def create_module(
    payload: CourseModuleWrite, db: DbSession, _: StaffUser
) -> CourseModuleRead:
    module = await course_service.create_module(db, payload)
    return CourseModuleRead.model_validate(module)


@router.put("/modules/{module_id}", response_model=CourseModuleRead, tags=["Admin"])
async def update_module(
    module_id: uuid.UUID, payload: CourseModuleUpdate, db: DbSession, _: StaffUser
) -> CourseModuleRead:
    module = await course_service.update_module(db, module_id, payload)
    return CourseModuleRead.model_validate(module)


@router.delete("/modules/{module_id}", response_model=Message, tags=["Admin"])
async def delete_module(module_id: uuid.UUID, db: DbSession, _: StaffUser) -> Message:
    await course_service.delete_module(db, module_id)
    return Message(message="Module deleted.")


@router.post(
    "/courses/{course_id}/modules/reorder",
    response_model=list[CourseModuleRead],
    tags=["Admin"],
)
async def reorder_modules(
    course_id: uuid.UUID, payload: ReorderRequest, db: DbSession, _: StaffUser
) -> list[CourseModuleRead]:
    modules = await course_service.reorder_modules(db, course_id, payload)
    return [CourseModuleRead.model_validate(module) for module in modules]


# --- Categories ------------------------------------------------------------
@router.post(
    "/course-categories",
    response_model=CourseCategoryRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin"],
)
async def create_course_category(
    payload: CourseCategoryWrite, db: DbSession, _: AdminUser
) -> CourseCategoryRead:
    category = await course_service.create_category(db, payload)
    return CourseCategoryRead.model_validate(category)


@router.put(
    "/course-categories/{category_id}", response_model=CourseCategoryRead, tags=["Admin"]
)
async def update_course_category(
    category_id: uuid.UUID, payload: CourseCategoryWrite, db: DbSession, _: AdminUser
) -> CourseCategoryRead:
    category = await course_service.update_category(db, category_id, payload)
    return CourseCategoryRead.model_validate(category)


@router.delete("/course-categories/{category_id}", response_model=Message, tags=["Admin"])
async def delete_course_category(
    category_id: uuid.UUID, db: DbSession, _: AdminUser
) -> Message:
    await course_service.delete_category(db, category_id)
    return Message(message="Category deleted.")
