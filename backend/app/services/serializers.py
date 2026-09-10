"""ORM -> API schema mapping.

Kept in one place so every endpoint returns identically shaped cards, which is
what lets the frontend reuse a single component per entity.
"""

from __future__ import annotations

import uuid

from app.models.catalog import Course
from app.models.certification import (
    Certification,
    CertificationProvider,
    CertificationResource,
)
from app.models.content import Article, Faq
from app.models.engagement import CourseReview
from app.schemas.catalog import (
    CertificationCardRef,
    CourseCard,
    CourseCardCategory,
    CourseModuleRead,
    CourseReviewRead,
    LessonSummary,
)
from app.schemas.certification import (
    ArticleCardRef,
    CertificationCard,
    CertificationResourceCard,
    ProviderCard,
)
from app.schemas.common import FaqItem
from app.schemas.content import ArticleCard


def course_card(course: Course) -> CourseCard:
    return CourseCard(
        id=course.id,
        title=course.title,
        slug=course.slug,
        short_description=course.short_description,
        thumbnail=course.thumbnail,
        icon=course.icon,
        level=course.level,
        duration_minutes=course.duration_minutes,
        price=course.price,
        currency=course.currency,
        rating_average=course.rating_average,
        rating_count=course.rating_count,
        enrollment_count=course.enrollment_count,
        lesson_count=course.lesson_count,
        is_published=course.is_published,
        category=(
            CourseCardCategory(
                id=course.category.id, name=course.category.name, slug=course.category.slug
            )
            if course.category
            else None
        ),
    )


def course_modules(course: Course) -> list[CourseModuleRead]:
    return [
        CourseModuleRead(
            id=module.id,
            course_id=module.course_id,
            title=module.title,
            description=module.description,
            position=module.position,
            lessons=[
                LessonSummary(
                    id=lesson.id,
                    title=lesson.title,
                    slug=lesson.slug,
                    duration_minutes=lesson.duration_minutes,
                    position=lesson.position,
                    is_preview=lesson.is_preview,
                )
                for lesson in sorted(module.lessons, key=lambda item: item.position)
            ],
        )
        for module in sorted(course.modules, key=lambda item: item.position)
    ]


def course_review(review: CourseReview) -> CourseReviewRead:
    return CourseReviewRead.model_validate(review)


def certification_card(
    certification: Certification, *, saved_ids: set[uuid.UUID] | None = None
) -> CertificationCard:
    provider = certification.provider
    return CertificationCard(
        id=certification.id,
        name=certification.name,
        slug=certification.slug,
        short_description=certification.short_description,
        exam_code=certification.exam_code,
        level=certification.level,
        category=certification.category,
        skills=certification.skills or [],
        provider_id=certification.provider_id,
        provider_name=provider.name if provider else "",
        provider_slug=provider.slug if provider else "",
        provider_logo=provider.logo if provider else None,
        course_count=len(certification.courses) if certification.courses is not None else 0,
        is_saved=bool(saved_ids and certification.id in saved_ids),
    )


def certification_card_ref(certification: Certification) -> CertificationCardRef:
    provider = certification.provider
    return CertificationCardRef(
        id=certification.id,
        name=certification.name,
        slug=certification.slug,
        provider_slug=provider.slug if provider else "",
        provider_name=provider.name if provider else "",
        level=certification.level,
        exam_code=certification.exam_code,
    )


def provider_card(provider: CertificationProvider, count: int = 0) -> ProviderCard:
    return ProviderCard(
        id=provider.id,
        name=provider.name,
        slug=provider.slug,
        short_description=provider.short_description,
        logo=provider.logo,
        accent_color=provider.accent_color,
        certification_count=count,
    )


def resource_card(resource: CertificationResource) -> CertificationResourceCard:
    return CertificationResourceCard.model_validate(resource)


def article_card(article: Article) -> ArticleCard:
    return ArticleCard.model_validate(article)


def article_card_ref(article: Article) -> ArticleCardRef:
    return ArticleCardRef(
        id=article.id,
        title=article.title,
        slug=article.slug,
        excerpt=article.excerpt,
        reading_minutes=article.reading_minutes,
        published_at=article.published_at,
    )


def faq_items(faqs: list[Faq]) -> list[FaqItem]:
    return [FaqItem(question=faq.question, answer=faq.answer) for faq in faqs]
