from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Literal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.pagination import PageParams
from app.models.catalog import Course, CourseCategory, CourseModule, Lesson
from app.models.engagement import CourseReview

CourseSort = Literal["popular", "newest", "rating", "price_asc", "price_desc", "title"]

_DETAIL_LOADS = (
    selectinload(Course.category),
    selectinload(Course.instructor),
    selectinload(Course.modules).selectinload(CourseModule.lessons),
    selectinload(Course.certifications),
)
_CARD_LOADS = (
    selectinload(Course.category),
    selectinload(Course.modules).selectinload(CourseModule.lessons),
)


def _apply_sort(stmt: Select, sort: CourseSort) -> Select:
    match sort:
        case "newest":
            return stmt.order_by(Course.created_at.desc())
        case "rating":
            return stmt.order_by(Course.rating_average.desc(), Course.rating_count.desc())
        case "price_asc":
            return stmt.order_by(Course.price.asc(), Course.title.asc())
        case "price_desc":
            return stmt.order_by(Course.price.desc(), Course.title.asc())
        case "title":
            return stmt.order_by(Course.title.asc())
        case _:
            return stmt.order_by(
                Course.enrollment_count.desc(),
                Course.rating_average.desc(),
                Course.created_at.desc(),
            )


async def list_courses(
    db: AsyncSession,
    params: PageParams,
    *,
    search: str | None = None,
    category_slug: str | None = None,
    category_id: uuid.UUID | None = None,
    level: str | None = None,
    max_duration_minutes: int | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    free_only: bool = False,
    min_rating: float | None = None,
    certification_id: uuid.UUID | None = None,
    is_published: bool | None = True,
    sort: CourseSort = "popular",
) -> tuple[list[Course], int]:
    stmt = select(Course)

    if is_published is not None:
        stmt = stmt.where(Course.is_published.is_(is_published))
    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Course.title).like(pattern),
                func.lower(Course.short_description).like(pattern),
            )
        )
    if category_slug:
        stmt = stmt.join(CourseCategory).where(CourseCategory.slug == category_slug)
    if category_id:
        stmt = stmt.where(Course.category_id == category_id)
    if level:
        stmt = stmt.where(Course.level == level)
    if max_duration_minutes is not None:
        stmt = stmt.where(Course.duration_minutes <= max_duration_minutes)
    if free_only:
        stmt = stmt.where(Course.price == 0)
    if min_price is not None:
        stmt = stmt.where(Course.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Course.price <= max_price)
    if min_rating is not None:
        stmt = stmt.where(Course.rating_average >= min_rating)
    if certification_id:
        stmt = stmt.where(Course.certifications.any(id=certification_id))

    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await db.scalars(
        _apply_sort(stmt, sort)
        .options(*_CARD_LOADS)
        .offset(params.offset)
        .limit(params.limit)
    )
    return list(rows.unique()), total


async def get_by_slug(
    db: AsyncSession, slug: str, *, published_only: bool = True
) -> Course | None:
    stmt = select(Course).where(Course.slug == slug).options(*_DETAIL_LOADS)
    if published_only:
        stmt = stmt.where(Course.is_published.is_(True))
    return await db.scalar(stmt)


async def get_by_id(db: AsyncSession, course_id: uuid.UUID) -> Course | None:
    return await db.scalar(
        select(Course).where(Course.id == course_id).options(*_DETAIL_LOADS)
    )


async def slug_exists(db: AsyncSession, slug: str, exclude_id: uuid.UUID | None = None) -> bool:
    stmt = select(Course.id).where(Course.slug == slug)
    if exclude_id:
        stmt = stmt.where(Course.id != exclude_id)
    return await db.scalar(stmt) is not None


async def featured_courses(db: AsyncSession, limit: int = 6) -> list[Course]:
    rows = await db.scalars(
        select(Course)
        .where(Course.is_published.is_(True))
        .order_by(
            Course.is_featured.desc(),
            Course.enrollment_count.desc(),
            Course.created_at.desc(),
        )
        .options(*_CARD_LOADS)
        .limit(limit)
    )
    return list(rows.unique())


async def related_courses(
    db: AsyncSession, course: Course, limit: int = 3
) -> list[Course]:
    stmt = (
        select(Course)
        .where(Course.is_published.is_(True), Course.id != course.id)
        .options(*_CARD_LOADS)
        .limit(limit)
    )
    if course.category_id:
        stmt = stmt.where(Course.category_id == course.category_id)
    rows = await db.scalars(stmt.order_by(Course.enrollment_count.desc()))
    found = list(rows.unique())
    if found:
        return found
    fallback = await db.scalars(
        select(Course)
        .where(Course.is_published.is_(True), Course.id != course.id)
        .order_by(Course.enrollment_count.desc())
        .options(*_CARD_LOADS)
        .limit(limit)
    )
    return list(fallback.unique())


async def courses_for_certification(
    db: AsyncSession, certification_id: uuid.UUID, limit: int = 6
) -> list[Course]:
    rows = await db.scalars(
        select(Course)
        .where(
            Course.is_published.is_(True),
            Course.certifications.any(id=certification_id),
        )
        .order_by(Course.enrollment_count.desc())
        .options(*_CARD_LOADS)
        .limit(limit)
    )
    return list(rows.unique())


async def list_categories(db: AsyncSession) -> list[tuple[CourseCategory, int]]:
    stmt = (
        select(CourseCategory, func.count(Course.id))
        .outerjoin(
            Course,
            (Course.category_id == CourseCategory.id) & Course.is_published.is_(True),
        )
        .where(CourseCategory.is_published.is_(True))
        .group_by(CourseCategory.id)
        .order_by(CourseCategory.position, CourseCategory.name)
    )
    return [(row[0], row[1]) for row in (await db.execute(stmt)).all()]


async def get_category_by_slug(db: AsyncSession, slug: str) -> CourseCategory | None:
    return await db.scalar(select(CourseCategory).where(CourseCategory.slug == slug))


async def get_module(db: AsyncSession, module_id: uuid.UUID) -> CourseModule | None:
    return await db.scalar(
        select(CourseModule)
        .where(CourseModule.id == module_id)
        .options(selectinload(CourseModule.lessons))
    )


async def get_lesson(db: AsyncSession, lesson_id: uuid.UUID) -> Lesson | None:
    return await db.scalar(
        select(Lesson).where(Lesson.id == lesson_id).options(selectinload(Lesson.module))
    )


async def next_module_position(db: AsyncSession, course_id: uuid.UUID) -> int:
    current = await db.scalar(
        select(func.max(CourseModule.position)).where(CourseModule.course_id == course_id)
    )
    return (current or 0) + 1


async def next_lesson_position(db: AsyncSession, module_id: uuid.UUID) -> int:
    current = await db.scalar(
        select(func.max(Lesson.position)).where(Lesson.module_id == module_id)
    )
    return (current or 0) + 1


async def lesson_slug_exists(
    db: AsyncSession, module_id: uuid.UUID, slug: str, exclude_id: uuid.UUID | None = None
) -> bool:
    stmt = select(Lesson.id).where(Lesson.module_id == module_id, Lesson.slug == slug)
    if exclude_id:
        stmt = stmt.where(Lesson.id != exclude_id)
    return await db.scalar(stmt) is not None


async def course_lessons_ordered(db: AsyncSession, course_id: uuid.UUID) -> list[Lesson]:
    rows = await db.scalars(
        select(Lesson)
        .join(CourseModule)
        .where(CourseModule.course_id == course_id)
        .order_by(CourseModule.position, Lesson.position)
    )
    return list(rows)


async def recalculate_rating(db: AsyncSession, course: Course) -> None:
    row = (
        await db.execute(
            select(func.avg(CourseReview.rating), func.count(CourseReview.id)).where(
                CourseReview.course_id == course.id,
                CourseReview.is_published.is_(True),
            )
        )
    ).one()
    average, count = row
    course.rating_average = round(Decimal(str(average or 0)), 2)
    course.rating_count = int(count or 0)


async def list_reviews(db: AsyncSession, course_id: uuid.UUID, limit: int = 10):
    rows = await db.scalars(
        select(CourseReview)
        .where(CourseReview.course_id == course_id, CourseReview.is_published.is_(True))
        .order_by(CourseReview.created_at.desc())
        .options(selectinload(CourseReview.user))
        .limit(limit)
    )
    return list(rows)
