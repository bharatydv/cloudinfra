"""Authenticated learner endpoints: enrollment, progress, dashboard, saves."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, DbSession
from app.models.enums import EnrollmentStatus
from app.repositories import engagement_repo
from app.schemas.certification import SavedCertificationRead
from app.schemas.common import Message
from app.schemas.engagement import (
    CertificateRead,
    CourseProgressRead,
    DashboardOverview,
    EnrollmentCreate,
    EnrollmentRead,
    LearnCourseView,
    SaveCertificationRequest,
)
from app.services import enrollment_service, serializers

router = APIRouter(tags=["Learning"])


@router.post(
    "/enrollments", response_model=EnrollmentRead, status_code=status.HTTP_201_CREATED
)
async def create_enrollment(
    payload: EnrollmentCreate, user: CurrentUser, db: DbSession
) -> EnrollmentRead:
    """Enroll in a free course. Paid courses require a confirmed payment."""
    enrollment = await enrollment_service.enroll(db, user, payload.course_id)
    return EnrollmentRead(
        id=enrollment.id,
        course_id=enrollment.course_id,
        status=enrollment.status,
        progress_percentage=enrollment.progress_percentage,
        enrolled_at=enrollment.enrolled_at,
        completed_at=enrollment.completed_at,
        last_accessed_at=enrollment.last_accessed_at,
    )


@router.get("/users/me/enrollments", response_model=list[EnrollmentRead])
async def my_enrollments(
    user: CurrentUser, db: DbSession, enrollment_status: EnrollmentStatus | None = None
) -> list[EnrollmentRead]:
    rows = await engagement_repo.list_enrollments(
        db, user.id, status=enrollment_status.value if enrollment_status else None
    )
    return [
        EnrollmentRead(
            id=row.id,
            course_id=row.course_id,
            status=row.status,
            progress_percentage=row.progress_percentage,
            enrolled_at=row.enrolled_at,
            completed_at=row.completed_at,
            last_accessed_at=row.last_accessed_at,
            course=serializers.course_card(row.course) if row.course else None,
        )
        for row in rows
    ]


@router.get("/users/me/progress", response_model=list[CourseProgressRead])
async def my_progress(user: CurrentUser, db: DbSession) -> list[CourseProgressRead]:
    return await enrollment_service.course_progress_list(db, user)


@router.get("/users/me/dashboard", response_model=DashboardOverview)
async def my_dashboard(user: CurrentUser, db: DbSession) -> DashboardOverview:
    return await enrollment_service.dashboard_overview(db, user)


@router.get("/users/me/certificates", response_model=list[CertificateRead])
async def my_certificates(user: CurrentUser, db: DbSession) -> list[CertificateRead]:
    rows = await engagement_repo.list_certificates(db, user.id)
    return [
        CertificateRead(
            id=row.id,
            serial=row.serial,
            issued_at=row.issued_at,
            course=serializers.course_card(row.course) if row.course else None,
        )
        for row in rows
    ]


@router.get("/users/me/saved-certifications", response_model=list[SavedCertificationRead])
async def my_saved_certifications(
    user: CurrentUser, db: DbSession
) -> list[SavedCertificationRead]:
    rows = await engagement_repo.list_saved_certifications(db, user.id)
    return [
        SavedCertificationRead(
            id=row.id,
            created_at=row.created_at,
            notes=row.notes,
            certification=serializers.certification_card(
                row.certification, saved_ids={row.certification_id}
            ),
        )
        for row in rows
    ]


@router.post(
    "/users/me/saved-certifications",
    response_model=Message,
    status_code=status.HTTP_201_CREATED,
)
async def save_certification(
    payload: SaveCertificationRequest, user: CurrentUser, db: DbSession
) -> Message:
    await enrollment_service.save_certification(db, user, payload)
    return Message(message="Saved to your dashboard.")


@router.delete("/users/me/saved-certifications/{certification_id}", response_model=Message)
async def unsave_certification(
    certification_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> Message:
    await enrollment_service.unsave_certification(db, user, certification_id)
    return Message(message="Removed from your saved list.")


@router.get("/learn/{course_slug}", response_model=LearnCourseView)
async def learn_course(
    course_slug: str, user: CurrentUser, db: DbSession
) -> LearnCourseView:
    """Course player payload, resuming at the first incomplete lesson."""
    return await enrollment_service.build_learn_view(db, user, course_slug, None)


@router.get("/learn/{course_slug}/{lesson_slug}", response_model=LearnCourseView)
async def learn_lesson(
    course_slug: str, lesson_slug: str, user: CurrentUser, db: DbSession
) -> LearnCourseView:
    return await enrollment_service.build_learn_view(db, user, course_slug, lesson_slug)
