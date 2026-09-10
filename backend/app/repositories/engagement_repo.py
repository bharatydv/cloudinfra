from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.pagination import PageParams
from app.models.catalog import Course, CourseModule, Lesson
from app.models.certification import Certification
from app.models.engagement import (
    Certificate,
    CourseReview,
    Enrollment,
    LessonProgress,
    SavedCertification,
)

_COURSE_CARD_LOADS = (
    selectinload(Course.category),
    selectinload(Course.modules).selectinload(CourseModule.lessons),
)


async def get_enrollment(
    db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID
) -> Enrollment | None:
    return await db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == user_id, Enrollment.course_id == course_id
        )
    )


async def list_enrollments(
    db: AsyncSession, user_id: uuid.UUID, *, status: str | None = None
) -> list[Enrollment]:
    stmt = (
        select(Enrollment)
        .where(Enrollment.user_id == user_id)
        .options(selectinload(Enrollment.course).options(*_COURSE_CARD_LOADS))
        .order_by(Enrollment.last_accessed_at.desc().nulls_last(), Enrollment.enrolled_at.desc())
    )
    if status:
        stmt = stmt.where(Enrollment.status == status)
    rows = await db.scalars(stmt)
    return list(rows.unique())


async def admin_list_enrollments(
    db: AsyncSession, params: PageParams, *, status: str | None = None
) -> tuple[list[Enrollment], int]:
    stmt = select(Enrollment)
    if status:
        stmt = stmt.where(Enrollment.status == status)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await db.scalars(
        stmt.options(
            selectinload(Enrollment.user), selectinload(Enrollment.course)
        )
        .order_by(Enrollment.enrolled_at.desc())
        .offset(params.offset)
        .limit(params.limit)
    )
    return list(rows.unique()), total


async def lesson_progress_map(
    db: AsyncSession, user_id: uuid.UUID, lesson_ids: list[uuid.UUID]
) -> dict[uuid.UUID, LessonProgress]:
    if not lesson_ids:
        return {}
    rows = await db.scalars(
        select(LessonProgress).where(
            LessonProgress.user_id == user_id, LessonProgress.lesson_id.in_(lesson_ids)
        )
    )
    return {row.lesson_id: row for row in rows}


async def get_lesson_progress(
    db: AsyncSession, user_id: uuid.UUID, lesson_id: uuid.UUID
) -> LessonProgress | None:
    return await db.scalar(
        select(LessonProgress).where(
            LessonProgress.user_id == user_id, LessonProgress.lesson_id == lesson_id
        )
    )


async def completed_lesson_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    return (
        await db.scalar(
            select(func.count(LessonProgress.id)).where(
                LessonProgress.user_id == user_id, LessonProgress.completed.is_(True)
            )
        )
        or 0
    )


async def course_lesson_ids(db: AsyncSession, course_id: uuid.UUID) -> list[uuid.UUID]:
    rows = await db.scalars(
        select(Lesson.id)
        .join(CourseModule)
        .where(CourseModule.course_id == course_id)
        .order_by(CourseModule.position, Lesson.position)
    )
    return list(rows)


# --- Saved certifications ---------------------------------------------------
async def list_saved_certifications(
    db: AsyncSession, user_id: uuid.UUID
) -> list[SavedCertification]:
    rows = await db.scalars(
        select(SavedCertification)
        .where(SavedCertification.user_id == user_id)
        .options(
            selectinload(SavedCertification.certification).options(
                selectinload(Certification.provider),
                selectinload(Certification.courses),
            )
        )
        .order_by(SavedCertification.created_at.desc())
    )
    return list(rows.unique())


async def get_saved(
    db: AsyncSession, user_id: uuid.UUID, certification_id: uuid.UUID
) -> SavedCertification | None:
    return await db.scalar(
        select(SavedCertification).where(
            SavedCertification.user_id == user_id,
            SavedCertification.certification_id == certification_id,
        )
    )


async def saved_certification_ids(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    rows = await db.scalars(
        select(SavedCertification.certification_id).where(
            SavedCertification.user_id == user_id
        )
    )
    return set(rows)


# --- Certificates -----------------------------------------------------------
async def list_certificates(db: AsyncSession, user_id: uuid.UUID) -> list[Certificate]:
    rows = await db.scalars(
        select(Certificate)
        .where(Certificate.user_id == user_id)
        .options(selectinload(Certificate.course).options(*_COURSE_CARD_LOADS))
        .order_by(Certificate.issued_at.desc())
    )
    return list(rows.unique())


async def get_certificate(
    db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID
) -> Certificate | None:
    return await db.scalar(
        select(Certificate).where(
            Certificate.user_id == user_id, Certificate.course_id == course_id
        )
    )


# --- Reviews ----------------------------------------------------------------
async def get_review(
    db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID
) -> CourseReview | None:
    return await db.scalar(
        select(CourseReview).where(
            CourseReview.user_id == user_id, CourseReview.course_id == course_id
        )
    )
