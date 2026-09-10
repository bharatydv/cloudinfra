from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError
from app.models.catalog import Course, Lesson
from app.models.engagement import (
    Certificate,
    CourseReview,
    Enrollment,
    LessonProgress,
    SavedCertification,
)
from app.models.enums import EnrollmentStatus
from app.models.user import User
from app.repositories import certification_repo, course_repo, engagement_repo
from app.schemas.catalog import CourseReviewWrite
from app.schemas.engagement import (
    CourseProgressRead,
    DashboardOverview,
    LearnCourseView,
    LearnLessonView,
    LearnModuleView,
    LessonProgressUpdate,
    SaveCertificationRequest,
)
from app.services import email as email_service


def _now() -> datetime:
    return datetime.now(UTC)


async def enroll(db: AsyncSession, user: User, course_id: uuid.UUID) -> Enrollment:
    course = await course_repo.get_by_id(db, course_id)
    if course is None or not course.is_published:
        raise NotFoundError("Course not found.")

    existing = await engagement_repo.get_enrollment(db, user.id, course.id)
    if existing is not None:
        if existing.status == EnrollmentStatus.CANCELLED.value:
            existing.status = EnrollmentStatus.ACTIVE.value
            existing.enrolled_at = _now()
            await db.commit()
            await db.refresh(existing)
            return existing
        raise ConflictError("You are already enrolled in this course.")

    if float(course.price) > 0:
        # Paid access is granted only by a verified payment webhook.
        raise PermissionDeniedError(
            "This is a paid course. Complete checkout to unlock access."
        )

    enrollment = Enrollment(user_id=user.id, course_id=course.id)
    course.enrollment_count = (course.enrollment_count or 0) + 1
    db.add(enrollment)
    await db.commit()
    await db.refresh(enrollment)

    subject, body = email_service.enrollment_email(user.name, course.title, course.slug)
    await email_service.send_email(user.email, subject, body)
    return enrollment


async def grant_enrollment(db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID) -> None:
    """Server-side enrollment grant used by the payment webhook."""
    existing = await engagement_repo.get_enrollment(db, user_id, course_id)
    if existing is not None:
        existing.status = EnrollmentStatus.ACTIVE.value
        return
    db.add(Enrollment(user_id=user_id, course_id=course_id))
    course = await db.get(Course, course_id)
    if course is not None:
        course.enrollment_count = (course.enrollment_count or 0) + 1


async def require_enrollment(
    db: AsyncSession, user: User, course: Course
) -> Enrollment:
    enrollment = await engagement_repo.get_enrollment(db, user.id, course.id)
    if enrollment is None or enrollment.status == EnrollmentStatus.CANCELLED.value:
        raise PermissionDeniedError("Enroll in this course to access its lessons.")
    return enrollment


async def _recalculate_course_progress(
    db: AsyncSession, user: User, course: Course
) -> Enrollment:
    lesson_ids = await engagement_repo.course_lesson_ids(db, course.id)
    progress_map = await engagement_repo.lesson_progress_map(db, user.id, lesson_ids)
    completed = sum(
        1 for lid in lesson_ids if progress_map.get(lid) and progress_map[lid].completed
    )
    total = len(lesson_ids)
    percentage = round(completed / total * 100) if total else 0

    enrollment = await engagement_repo.get_enrollment(db, user.id, course.id)
    if enrollment is None:
        raise PermissionDeniedError("Enroll in this course to track progress.")

    enrollment.progress_percentage = percentage
    enrollment.last_accessed_at = _now()
    if total and completed == total:
        if enrollment.status != EnrollmentStatus.COMPLETED.value:
            enrollment.status = EnrollmentStatus.COMPLETED.value
            enrollment.completed_at = _now()
        await _issue_certificate(db, user, course)
    else:
        enrollment.status = EnrollmentStatus.ACTIVE.value
        enrollment.completed_at = None
    return enrollment


async def _issue_certificate(db: AsyncSession, user: User, course: Course) -> None:
    existing = await engagement_repo.get_certificate(db, user.id, course.id)
    if existing is not None:
        return
    serial = f"CC-{datetime.now(UTC).year}-{secrets.token_hex(6).upper()}"
    db.add(Certificate(user_id=user.id, course_id=course.id, serial=serial))


async def update_lesson_progress(
    db: AsyncSession, user: User, lesson_id: uuid.UUID, payload: LessonProgressUpdate
) -> LessonProgress:
    lesson = await course_repo.get_lesson(db, lesson_id)
    if lesson is None:
        raise NotFoundError("Lesson not found.")
    course = await db.get(Course, lesson.module.course_id)
    if course is None:
        raise NotFoundError("Course not found.")
    await require_enrollment(db, user, course)

    progress = await engagement_repo.get_lesson_progress(db, user.id, lesson_id)
    if progress is None:
        progress = LessonProgress(user_id=user.id, lesson_id=lesson_id)
        db.add(progress)

    if payload.progress_percentage is not None:
        progress.progress_percentage = payload.progress_percentage
    if payload.completed is not None:
        progress.completed = payload.completed
        if payload.completed:
            progress.progress_percentage = 100
            progress.completed_at = _now()
        else:
            progress.completed_at = None
            if payload.progress_percentage is None:
                progress.progress_percentage = min(progress.progress_percentage, 99)
    progress.last_accessed_at = _now()

    await db.flush()
    await _recalculate_course_progress(db, user, course)
    await db.commit()
    await db.refresh(progress)
    return progress


async def build_learn_view(
    db: AsyncSession, user: User, course_slug: str, lesson_slug: str | None
) -> LearnCourseView:
    course = await course_repo.get_by_slug(db, course_slug, published_only=False)
    if course is None:
        raise NotFoundError("Course not found.")
    if not course.is_published and not user.is_admin:
        raise NotFoundError("Course not found.")

    enrollment = await require_enrollment(db, user, course)

    ordered_lessons: list[Lesson] = []
    modules_view: list[LearnModuleView] = []
    for module in sorted(course.modules, key=lambda item: item.position):
        lessons = sorted(module.lessons, key=lambda item: item.position)
        ordered_lessons.extend(lessons)
        modules_view.append(
            LearnModuleView(
                id=module.id,
                title=module.title,
                position=module.position,
                lessons=[
                    {
                        "id": str(lesson.id),
                        "title": lesson.title,
                        "slug": lesson.slug,
                        "duration_minutes": lesson.duration_minutes,
                        "position": lesson.position,
                    }
                    for lesson in lessons
                ],
            )
        )

    progress_map = await engagement_repo.lesson_progress_map(
        db, user.id, [lesson.id for lesson in ordered_lessons]
    )
    for module_view in modules_view:
        for entry in module_view.lessons:
            record = progress_map.get(uuid.UUID(entry["id"]))
            entry["completed"] = bool(record and record.completed)
            entry["progress_percentage"] = record.progress_percentage if record else 0

    current: LearnLessonView | None = None
    if ordered_lessons:
        index = 0
        if lesson_slug:
            index = next(
                (i for i, item in enumerate(ordered_lessons) if item.slug == lesson_slug),
                -1,
            )
            if index < 0:
                raise NotFoundError("Lesson not found.")
        else:
            # Resume at the first incomplete lesson.
            index = next(
                (
                    i
                    for i, item in enumerate(ordered_lessons)
                    if not (
                        progress_map.get(item.id) and progress_map[item.id].completed
                    )
                ),
                0,
            )
        lesson = ordered_lessons[index]
        record = progress_map.get(lesson.id)
        current = LearnLessonView(
            id=lesson.id,
            module_id=lesson.module_id,
            title=lesson.title,
            slug=lesson.slug,
            description=lesson.description,
            video_url=lesson.video_url,
            content=lesson.content,
            resources=lesson.resources or [],
            duration_minutes=lesson.duration_minutes,
            position=lesson.position,
            completed=bool(record and record.completed),
            progress_percentage=record.progress_percentage if record else 0,
            previous_lesson_slug=(
                ordered_lessons[index - 1].slug if index > 0 else None
            ),
            next_lesson_slug=(
                ordered_lessons[index + 1].slug
                if index + 1 < len(ordered_lessons)
                else None
            ),
        )

    completed_count = sum(
        1
        for lesson in ordered_lessons
        if progress_map.get(lesson.id) and progress_map[lesson.id].completed
    )
    enrollment.last_accessed_at = _now()
    await db.commit()

    return LearnCourseView(
        course_id=course.id,
        title=course.title,
        slug=course.slug,
        progress_percentage=enrollment.progress_percentage,
        total_lessons=len(ordered_lessons),
        completed_lessons=completed_count,
        modules=modules_view,
        current_lesson=current,
    )


async def course_progress_list(db: AsyncSession, user: User) -> list[CourseProgressRead]:
    enrollments = await engagement_repo.list_enrollments(db, user.id)
    results: list[CourseProgressRead] = []
    for enrollment in enrollments:
        course = enrollment.course
        if course is None:
            continue
        lesson_ids = await engagement_repo.course_lesson_ids(db, course.id)
        progress_map = await engagement_repo.lesson_progress_map(db, user.id, lesson_ids)
        completed = sum(
            1 for lid in lesson_ids if progress_map.get(lid) and progress_map[lid].completed
        )
        next_slug = None
        for lid in lesson_ids:
            record = progress_map.get(lid)
            if not (record and record.completed):
                lesson = await db.get(Lesson, lid)
                next_slug = lesson.slug if lesson else None
                break
        results.append(
            CourseProgressRead(
                course_id=course.id,
                course_slug=course.slug,
                course_title=course.title,
                total_lessons=len(lesson_ids),
                completed_lessons=completed,
                progress_percentage=enrollment.progress_percentage,
                status=enrollment.status,
                last_accessed_at=enrollment.last_accessed_at,
                next_lesson_slug=next_slug,
            )
        )
    return results


async def dashboard_overview(db: AsyncSession, user: User) -> DashboardOverview:
    progress = await course_progress_list(db, user)
    completed = [item for item in progress if item.status == EnrollmentStatus.COMPLETED]
    in_progress = [item for item in progress if item.status == EnrollmentStatus.ACTIVE]
    saved = await engagement_repo.list_saved_certifications(db, user.id)
    certificates = await engagement_repo.list_certificates(db, user.id)
    lessons_done = await engagement_repo.completed_lesson_count(db, user.id)
    overall = (
        round(sum(item.progress_percentage for item in progress) / len(progress))
        if progress
        else 0
    )

    return DashboardOverview(
        enrolled_courses=len(progress),
        completed_courses=len(completed),
        in_progress_courses=len(in_progress),
        total_lessons_completed=lessons_done,
        saved_certifications=len(saved),
        certificates_earned=len(certificates),
        overall_progress=overall,
        recent_courses=progress[:4],
    )


# --- Saved certifications ---------------------------------------------------
async def save_certification(
    db: AsyncSession, user: User, payload: SaveCertificationRequest
) -> SavedCertification:
    certification = await certification_repo.get_by_id(db, payload.certification_id)
    if certification is None:
        raise NotFoundError("Certification not found.")
    existing = await engagement_repo.get_saved(db, user.id, certification.id)
    if existing is not None:
        existing.notes = payload.notes or existing.notes
        await db.commit()
        await db.refresh(existing)
        return existing
    saved = SavedCertification(
        user_id=user.id, certification_id=certification.id, notes=payload.notes
    )
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    return saved


async def unsave_certification(
    db: AsyncSession, user: User, certification_id: uuid.UUID
) -> None:
    saved = await engagement_repo.get_saved(db, user.id, certification_id)
    if saved is None:
        raise NotFoundError("This certification is not in your saved list.")
    await db.delete(saved)
    await db.commit()


# --- Reviews ----------------------------------------------------------------
async def upsert_review(
    db: AsyncSession, user: User, course_id: uuid.UUID, payload: CourseReviewWrite
) -> CourseReview:
    course = await course_repo.get_by_id(db, course_id)
    if course is None:
        raise NotFoundError("Course not found.")
    await require_enrollment(db, user, course)

    review = await engagement_repo.get_review(db, user.id, course.id)
    if review is None:
        review = CourseReview(user_id=user.id, course_id=course.id, rating=payload.rating)
        db.add(review)
    review.rating = payload.rating
    review.comment = payload.comment
    await db.flush()
    await course_repo.recalculate_rating(db, course)
    await db.commit()
    await db.refresh(review)
    # Attach the author so the response can serialise without a lazy load.
    review.user = user
    return review
