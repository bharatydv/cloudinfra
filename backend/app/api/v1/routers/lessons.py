from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, DbSession, OptionalUser, StaffUser
from app.core.errors import NotFoundError, PermissionDeniedError
from app.repositories import course_repo, engagement_repo
from app.schemas.catalog import (
    LessonRead,
    LessonSummary,
    LessonUpdate,
    LessonWrite,
    ReorderRequest,
)
from app.schemas.common import Message
from app.schemas.engagement import LessonProgressRead, LessonProgressUpdate
from app.services import course_service, enrollment_service

router = APIRouter(tags=["Lessons"])


@router.get("/modules/{module_id}/lessons", response_model=list[LessonSummary])
async def list_module_lessons(module_id: uuid.UUID, db: DbSession) -> list[LessonSummary]:
    module = await course_repo.get_module(db, module_id)
    if module is None:
        raise NotFoundError("Module not found.")
    return [
        LessonSummary.model_validate(lesson)
        for lesson in sorted(module.lessons, key=lambda item: item.position)
    ]


@router.get("/lessons/{lesson_id}", response_model=LessonRead)
async def get_lesson(lesson_id: uuid.UUID, db: DbSession, viewer: OptionalUser) -> LessonRead:
    """Full lesson content requires enrollment unless the lesson is a preview."""
    lesson = await course_repo.get_lesson(db, lesson_id)
    if lesson is None:
        raise NotFoundError("Lesson not found.")
    if lesson.is_preview:
        return LessonRead.model_validate(lesson)
    if viewer is None:
        raise PermissionDeniedError("Sign in and enroll to view this lesson.")
    course = await course_repo.get_by_id(db, lesson.module.course_id)
    if course is None:
        raise NotFoundError("Course not found.")
    if not viewer.is_admin:
        await enrollment_service.require_enrollment(db, viewer, course)
    return LessonRead.model_validate(lesson)


@router.post("/lessons/{lesson_id}/progress", response_model=LessonProgressRead)
async def update_progress(
    lesson_id: uuid.UUID,
    payload: LessonProgressUpdate,
    user: CurrentUser,
    db: DbSession,
) -> LessonProgressRead:
    """Progress is stored per user in PostgreSQL, so it follows across devices."""
    progress = await enrollment_service.update_lesson_progress(db, user, lesson_id, payload)
    return LessonProgressRead.model_validate(progress)


@router.get("/lessons/{lesson_id}/progress", response_model=LessonProgressRead | None)
async def get_progress(
    lesson_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> LessonProgressRead | None:
    progress = await engagement_repo.get_lesson_progress(db, user.id, lesson_id)
    return LessonProgressRead.model_validate(progress) if progress else None


# --- Admin -----------------------------------------------------------------
@router.post(
    "/lessons", response_model=LessonRead, status_code=status.HTTP_201_CREATED, tags=["Admin"]
)
async def create_lesson(payload: LessonWrite, db: DbSession, _: StaffUser) -> LessonRead:
    lesson = await course_service.create_lesson(db, payload)
    return LessonRead.model_validate(lesson)


@router.put("/lessons/{lesson_id}", response_model=LessonRead, tags=["Admin"])
async def update_lesson(
    lesson_id: uuid.UUID, payload: LessonUpdate, db: DbSession, _: StaffUser
) -> LessonRead:
    lesson = await course_service.update_lesson(db, lesson_id, payload)
    return LessonRead.model_validate(lesson)


@router.delete("/lessons/{lesson_id}", response_model=Message, tags=["Admin"])
async def delete_lesson(lesson_id: uuid.UUID, db: DbSession, _: StaffUser) -> Message:
    await course_service.delete_lesson(db, lesson_id)
    return Message(message="Lesson deleted.")


@router.post(
    "/modules/{module_id}/lessons/reorder",
    response_model=list[LessonSummary],
    tags=["Admin"],
)
async def reorder_lessons(
    module_id: uuid.UUID, payload: ReorderRequest, db: DbSession, _: StaffUser
) -> list[LessonSummary]:
    lessons = await course_service.reorder_lessons(db, module_id, payload)
    return [LessonSummary.model_validate(lesson) for lesson in lessons]
