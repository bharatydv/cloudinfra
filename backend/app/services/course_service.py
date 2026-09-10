from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.models.catalog import Course, CourseCategory, CourseModule, Lesson
from app.models.certification import Certification
from app.models.user import User
from app.repositories import certification_repo, course_repo, engagement_repo, misc_repo
from app.schemas.catalog import (
    CourseCategoryWrite,
    CourseDetail,
    CourseModuleUpdate,
    CourseModuleWrite,
    CourseUpdate,
    CourseWrite,
    LessonRead,
    LessonUpdate,
    LessonWrite,
    ReorderRequest,
)
from app.schemas.common import Breadcrumb
from app.services import seo_service, serializers
from app.utils.text import slugify, unique_slug


async def _resolve_slug(
    db: AsyncSession, title: str, provided: str | None, exclude_id: uuid.UUID | None = None
) -> str:
    if provided:
        candidate = slugify(provided, max_length=220)
        if await course_repo.slug_exists(db, candidate, exclude_id):
            raise ConflictError("That course URL is already in use.")
        return candidate
    return await unique_slug(
        title,
        lambda value: course_repo.slug_exists(db, value, exclude_id),
        max_length=220,
    )


async def _set_certifications(
    db: AsyncSession, course: Course, certification_ids: list[uuid.UUID]
) -> None:
    # Assigning to a relationship collection reads the current one first, which
    # would lazy-load under asyncio. Load it explicitly.
    await db.refresh(course, ["certifications"])
    if not certification_ids:
        course.certifications = []
        return
    rows = await db.scalars(
        select(Certification).where(Certification.id.in_(certification_ids))
    )
    course.certifications = list(rows)


async def build_course_detail(
    db: AsyncSession, course: Course, viewer: User | None
) -> CourseDetail:
    card = serializers.course_card(course)
    faqs = await misc_repo.list_faqs(db, category=f"course:{course.slug}")
    if not faqs:
        faqs = await misc_repo.list_faqs(db, category="courses")
    reviews = await course_repo.list_reviews(db, course.id)
    related = await course_repo.related_courses(db, course)
    certifications = await certification_repo.certifications_for_course(db, course.id)

    is_enrolled = False
    progress = 0
    if viewer is not None:
        enrollment = await engagement_repo.get_enrollment(db, viewer.id, course.id)
        if enrollment is not None:
            is_enrolled = enrollment.status != "cancelled"
            progress = enrollment.progress_percentage

    breadcrumbs = [Breadcrumb(name="Home", url="/"), Breadcrumb(name="Courses", url="/courses")]
    if course.category:
        breadcrumbs.append(
            Breadcrumb(
                name=course.category.name, url=f"/courses?category={course.category.slug}"
            )
        )
    breadcrumbs.append(Breadcrumb(name=course.title, url=f"/courses/{course.slug}"))

    faq_dicts = [{"question": item.question, "answer": item.answer} for item in faqs]
    seo = seo_service.build_meta(
        title=course.meta_title or f"{course.title} | Online Course",
        description=course.meta_description or course.short_description,
        path=f"/courses/{course.slug}",
        canonical_url=course.canonical_url,
        og_image=course.thumbnail,
        breadcrumbs=breadcrumbs,
        structured_data=[
            seo_service.course_schema(course),
            seo_service.faq_page_schema(faq_dicts),
        ],
    )

    return CourseDetail(
        **card.model_dump(exclude={"is_free"}),
        description=course.description,
        language=course.language,
        learning_outcomes=course.learning_outcomes or [],
        requirements=course.requirements or [],
        is_featured=course.is_featured,
        created_at=course.created_at,
        updated_at=course.updated_at,
        instructor=course.instructor,
        modules=serializers.course_modules(course),
        faqs=serializers.faq_items(faqs),
        reviews=[serializers.course_review(review) for review in reviews],
        related_certifications=[
            serializers.certification_card_ref(item) for item in certifications
        ],
        related_courses=[serializers.course_card(item) for item in related],
        seo=seo,
        is_enrolled=is_enrolled,
        progress_percentage=progress,
    )


# --------------------------------------------------------------------------
# Admin CRUD
# --------------------------------------------------------------------------
async def create_course(db: AsyncSession, payload: CourseWrite) -> Course:
    slug = await _resolve_slug(db, payload.title, payload.slug)
    data = payload.model_dump(exclude={"slug", "certification_ids"})
    course = Course(**data, slug=slug)
    db.add(course)
    await db.flush()
    await _set_certifications(db, course, payload.certification_ids)
    await db.commit()
    refreshed = await course_repo.get_by_id(db, course.id)
    assert refreshed is not None
    return refreshed


async def update_course(
    db: AsyncSession, course_id: uuid.UUID, payload: CourseUpdate
) -> Course:
    course = await course_repo.get_by_id(db, course_id)
    if course is None:
        raise NotFoundError("Course not found.")

    data = payload.model_dump(exclude_unset=True, exclude={"slug", "certification_ids"})
    if payload.slug is not None or ("title" in data and not course.slug):
        course.slug = await _resolve_slug(
            db, data.get("title", course.title), payload.slug, course.id
        )
    for field, value in data.items():
        setattr(course, field, value)
    if payload.certification_ids is not None:
        await _set_certifications(db, course, payload.certification_ids)

    await db.commit()
    refreshed = await course_repo.get_by_id(db, course.id)
    assert refreshed is not None
    return refreshed


async def delete_course(db: AsyncSession, course_id: uuid.UUID) -> None:
    course = await course_repo.get_by_id(db, course_id)
    if course is None:
        raise NotFoundError("Course not found.")
    await db.delete(course)
    await db.commit()


async def set_published(db: AsyncSession, course_id: uuid.UUID, published: bool) -> Course:
    course = await course_repo.get_by_id(db, course_id)
    if course is None:
        raise NotFoundError("Course not found.")
    if published and not course.modules:
        raise ValidationFailedError("Add at least one module before publishing.")
    course.is_published = published
    await db.commit()
    refreshed = await course_repo.get_by_id(db, course.id)
    assert refreshed is not None
    return refreshed


# --- Modules ---------------------------------------------------------------
async def create_module(db: AsyncSession, payload: CourseModuleWrite) -> CourseModule:
    course = await course_repo.get_by_id(db, payload.course_id)
    if course is None:
        raise NotFoundError("Course not found.")
    position = payload.position or await course_repo.next_module_position(db, course.id)
    module = CourseModule(
        course_id=course.id,
        title=payload.title,
        description=payload.description,
        position=position,
    )
    db.add(module)
    await db.commit()
    created = await course_repo.get_module(db, module.id)
    assert created is not None
    return created


async def update_module(
    db: AsyncSession, module_id: uuid.UUID, payload: CourseModuleUpdate
) -> CourseModule:
    module = await course_repo.get_module(db, module_id)
    if module is None:
        raise NotFoundError("Module not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(module, field, value)
    await db.commit()
    refreshed = await course_repo.get_module(db, module_id)
    assert refreshed is not None
    return refreshed


async def delete_module(db: AsyncSession, module_id: uuid.UUID) -> None:
    module = await course_repo.get_module(db, module_id)
    if module is None:
        raise NotFoundError("Module not found.")
    await db.delete(module)
    await db.commit()


async def reorder_modules(
    db: AsyncSession, course_id: uuid.UUID, payload: ReorderRequest
) -> list[CourseModule]:
    course = await course_repo.get_by_id(db, course_id)
    if course is None:
        raise NotFoundError("Course not found.")
    positions = {item.id: item.position for item in payload.items}
    # Two-phase write: the (course_id, position) unique constraint would trip
    # on intermediate states otherwise.
    for module in course.modules:
        if module.id in positions:
            module.position = -(positions[module.id] + 1)
    await db.flush()
    for module in course.modules:
        if module.id in positions:
            module.position = positions[module.id]
    await db.commit()
    refreshed = await course_repo.get_by_id(db, course_id)
    assert refreshed is not None
    return sorted(refreshed.modules, key=lambda item: item.position)


# --- Lessons ---------------------------------------------------------------
async def create_lesson(db: AsyncSession, payload: LessonWrite) -> Lesson:
    module = await course_repo.get_module(db, payload.module_id)
    if module is None:
        raise NotFoundError("Module not found.")
    slug = await unique_slug(
        payload.slug or payload.title,
        lambda value: course_repo.lesson_slug_exists(db, module.id, value),
        max_length=220,
    )
    position = payload.position or await course_repo.next_lesson_position(db, module.id)
    lesson = Lesson(
        **payload.model_dump(exclude={"slug", "position", "module_id"}),
        module_id=module.id,
        slug=slug,
        position=position,
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


async def update_lesson(
    db: AsyncSession, lesson_id: uuid.UUID, payload: LessonUpdate
) -> Lesson:
    lesson = await course_repo.get_lesson(db, lesson_id)
    if lesson is None:
        raise NotFoundError("Lesson not found.")
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] != lesson.title:
        lesson.slug = await unique_slug(
            data["title"],
            lambda value: course_repo.lesson_slug_exists(
                db, lesson.module_id, value, lesson.id
            ),
            max_length=220,
        )
    for field, value in data.items():
        setattr(lesson, field, value)
    await db.commit()
    await db.refresh(lesson)
    return lesson


async def delete_lesson(db: AsyncSession, lesson_id: uuid.UUID) -> None:
    lesson = await course_repo.get_lesson(db, lesson_id)
    if lesson is None:
        raise NotFoundError("Lesson not found.")
    await db.delete(lesson)
    await db.commit()


async def reorder_lessons(
    db: AsyncSession, module_id: uuid.UUID, payload: ReorderRequest
) -> list[Lesson]:
    module = await course_repo.get_module(db, module_id)
    if module is None:
        raise NotFoundError("Module not found.")
    positions = {item.id: item.position for item in payload.items}
    for lesson in module.lessons:
        if lesson.id in positions:
            lesson.position = positions[lesson.id]
    await db.commit()
    refreshed = await course_repo.get_module(db, module_id)
    assert refreshed is not None
    return sorted(refreshed.lessons, key=lambda item: item.position)


def lesson_read(lesson: Lesson) -> LessonRead:
    return LessonRead.model_validate(lesson)


# --- Categories ------------------------------------------------------------
async def create_category(
    db: AsyncSession, payload: CourseCategoryWrite
) -> CourseCategory:
    slug = slugify(payload.slug or payload.name, max_length=140)
    if await course_repo.get_category_by_slug(db, slug) is not None:
        raise ConflictError("That category URL is already in use.")
    category = CourseCategory(**payload.model_dump(exclude={"slug"}), slug=slug)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def update_category(
    db: AsyncSession, category_id: uuid.UUID, payload: CourseCategoryWrite
) -> CourseCategory:
    category = await db.get(CourseCategory, category_id)
    if category is None:
        raise NotFoundError("Category not found.")
    data = payload.model_dump(exclude_unset=True, exclude={"slug"})
    if payload.slug:
        slug = slugify(payload.slug, max_length=140)
        existing = await course_repo.get_category_by_slug(db, slug)
        if existing is not None and existing.id != category.id:
            raise ConflictError("That category URL is already in use.")
        category.slug = slug
    for field, value in data.items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, category_id: uuid.UUID) -> None:
    category = await db.get(CourseCategory, category_id)
    if category is None:
        raise NotFoundError("Category not found.")
    await db.delete(category)
    await db.commit()
