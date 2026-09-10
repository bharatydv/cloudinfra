from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError
from app.models.catalog import Course, CourseModule
from app.models.certification import (
    Certification,
    CertificationProvider,
    CertificationResource,
)
from app.models.enums import ResourceType
from app.repositories import (
    article_repo,
    certification_repo,
    course_repo,
    engagement_repo,
    misc_repo,
)
from app.schemas.certification import (
    CertificationDetail,
    CertificationResourceUpdate,
    CertificationResourceWrite,
    CertificationUpdate,
    CertificationWrite,
    ProviderDetail,
    ProviderUpdate,
    ProviderWrite,
)
from app.schemas.common import Breadcrumb
from app.services import seo_service, serializers
from app.utils.text import slugify, unique_slug


async def build_provider_detail(
    db: AsyncSession, provider: CertificationProvider
) -> ProviderDetail:
    certifications = await db.scalars(
        select(Certification)
        .where(
            Certification.provider_id == provider.id,
            Certification.is_published.is_(True),
        )
        .options(selectinload(Certification.courses))
        .order_by(Certification.position, Certification.name)
    )
    cert_list = list(certifications.unique())
    for certification in cert_list:
        certification.provider = provider

    course_rows = await db.scalars(
        select(Course)
        .where(
            Course.is_published.is_(True),
            Course.certifications.any(Certification.provider_id == provider.id),
        )
        .options(
            selectinload(Course.category),
            selectinload(Course.modules).selectinload(CourseModule.lessons),
        )
        .limit(6)
    )
    faqs = await misc_repo.list_faqs(db, category=f"provider:{provider.slug}")
    if not faqs:
        faqs = await misc_repo.list_faqs(db, category="certifications")

    articles = await article_repo.latest(db, limit=3)

    breadcrumbs = [
        Breadcrumb(name="Home", url="/"),
        Breadcrumb(name="Certifications", url="/certifications"),
        Breadcrumb(name=provider.name, url=f"/certifications/{provider.slug}"),
    ]
    faq_dicts = [{"question": item.question, "answer": item.answer} for item in faqs]

    return ProviderDetail(
        id=provider.id,
        name=provider.name,
        slug=provider.slug,
        short_description=provider.short_description,
        logo=provider.logo,
        accent_color=provider.accent_color,
        certification_count=len(cert_list),
        description=provider.description,
        website_url=provider.website_url,
        is_official_partner=provider.is_official_partner,
        certifications=[serializers.certification_card(item) for item in cert_list],
        related_courses=[serializers.course_card(item) for item in course_rows.unique()],
        related_articles=[serializers.article_card_ref(item) for item in articles],
        faqs=serializers.faq_items(faqs),
        seo=seo_service.build_meta(
            title=provider.meta_title
            or f"{provider.name} Certification Preparation & Study Resources",
            description=provider.meta_description
            or provider.short_description
            or f"Independent preparation resources and learning paths for {provider.name} "
            "certifications.",
            path=f"/certifications/{provider.slug}",
            breadcrumbs=breadcrumbs,
            structured_data=[seo_service.faq_page_schema(faq_dicts)],
        ),
    )


async def build_certification_detail(
    db: AsyncSession, certification: Certification, viewer_id: uuid.UUID | None
) -> CertificationDetail:
    saved_ids = (
        await engagement_repo.saved_certification_ids(db, viewer_id) if viewer_id else set()
    )
    card = serializers.certification_card(certification, saved_ids=saved_ids)

    resources = await certification_repo.list_resources(db, certification.id)
    practice = [
        item for item in resources if item.resource_type == ResourceType.PRACTICE.value
    ]
    courses = await course_repo.courses_for_certification(db, certification.id)
    related = await certification_repo.related(db, certification)

    faqs = await misc_repo.list_faqs(db, category=f"certification:{certification.slug}")
    if not faqs:
        faqs = await misc_repo.list_faqs(db, category="certifications")

    provider = certification.provider
    breadcrumbs = [
        Breadcrumb(name="Home", url="/"),
        Breadcrumb(name="Certifications", url="/certifications"),
    ]
    if provider:
        breadcrumbs.append(
            Breadcrumb(name=provider.name, url=f"/certifications/{provider.slug}")
        )
    path = (
        f"/certifications/{provider.slug}/{certification.slug}"
        if provider
        else f"/certifications/{certification.slug}"
    )
    breadcrumbs.append(Breadcrumb(name=certification.name, url=path))
    faq_dicts = [{"question": item.question, "answer": item.answer} for item in faqs]

    return CertificationDetail(
        **card.model_dump(),
        description=certification.description,
        audience=certification.audience,
        recommended_experience=certification.recommended_experience,
        exam_topics=certification.exam_topics or [],
        preparation_roadmap=certification.preparation_roadmap or [],
        exam_duration_minutes=certification.exam_duration_minutes,
        exam_format=certification.exam_format,
        official_url=certification.official_url,
        created_at=certification.created_at,
        updated_at=certification.updated_at,
        provider=serializers.provider_card(provider) if provider else None,
        resources=[serializers.resource_card(item) for item in resources],
        practice_resources=[serializers.resource_card(item) for item in practice],
        related_courses=[serializers.course_card(item) for item in courses],
        related_certifications=[
            serializers.certification_card(item, saved_ids=saved_ids) for item in related
        ],
        faqs=serializers.faq_items(faqs),
        seo=seo_service.build_meta(
            title=certification.meta_title
            or f"{certification.name} Certification Preparation Guide",
            description=certification.meta_description or certification.short_description,
            path=path,
            breadcrumbs=breadcrumbs,
            structured_data=[seo_service.faq_page_schema(faq_dicts)],
        ),
    )


# --------------------------------------------------------------------------
# Providers CRUD
# --------------------------------------------------------------------------
async def create_provider(
    db: AsyncSession, payload: ProviderWrite
) -> CertificationProvider:
    slug = await unique_slug(
        payload.slug or payload.name,
        lambda value: certification_repo.provider_slug_exists(db, value),
        max_length=140,
    )
    provider = CertificationProvider(**payload.model_dump(exclude={"slug"}), slug=slug)
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


async def update_provider(
    db: AsyncSession, provider_id: uuid.UUID, payload: ProviderUpdate
) -> CertificationProvider:
    provider = await certification_repo.get_provider_by_id(db, provider_id)
    if provider is None:
        raise NotFoundError("Provider not found.")
    data = payload.model_dump(exclude_unset=True, exclude={"slug"})
    if payload.slug:
        slug = slugify(payload.slug, max_length=140)
        if await certification_repo.provider_slug_exists(db, slug, provider.id):
            raise ConflictError("That provider URL is already in use.")
        provider.slug = slug
    for field, value in data.items():
        setattr(provider, field, value)
    await db.commit()
    await db.refresh(provider)
    return provider


async def delete_provider(db: AsyncSession, provider_id: uuid.UUID) -> None:
    provider = await certification_repo.get_provider_by_id(db, provider_id)
    if provider is None:
        raise NotFoundError("Provider not found.")
    await db.delete(provider)
    await db.commit()


# --------------------------------------------------------------------------
# Certifications CRUD
# --------------------------------------------------------------------------
async def _set_courses(
    db: AsyncSession, certification: Certification, course_ids: list[uuid.UUID]
) -> None:
    await db.refresh(certification, ["courses"])
    if not course_ids:
        certification.courses = []
        return
    rows = await db.scalars(select(Course).where(Course.id.in_(course_ids)))
    certification.courses = list(rows)


async def create_certification(
    db: AsyncSession, payload: CertificationWrite
) -> Certification:
    provider = await certification_repo.get_provider_by_id(db, payload.provider_id)
    if provider is None:
        raise NotFoundError("Provider not found.")
    slug = await unique_slug(
        payload.slug or payload.name,
        lambda value: certification_repo.slug_exists(db, provider.id, value),
        max_length=220,
    )
    data = payload.model_dump(exclude={"slug", "course_ids"})
    data["exam_topics"] = [topic.model_dump() for topic in payload.exam_topics]
    data["preparation_roadmap"] = [
        step.model_dump() for step in payload.preparation_roadmap
    ]
    certification = Certification(**data, slug=slug)
    db.add(certification)
    await db.flush()
    await _set_courses(db, certification, payload.course_ids)
    await db.commit()
    created = await certification_repo.get_by_id(db, certification.id)
    assert created is not None
    return created


async def update_certification(
    db: AsyncSession, certification_id: uuid.UUID, payload: CertificationUpdate
) -> Certification:
    certification = await certification_repo.get_by_id(db, certification_id)
    if certification is None:
        raise NotFoundError("Certification not found.")

    data = payload.model_dump(exclude_unset=True, exclude={"slug", "course_ids"})
    if payload.exam_topics is not None:
        data["exam_topics"] = [topic.model_dump() for topic in payload.exam_topics]
    if payload.preparation_roadmap is not None:
        data["preparation_roadmap"] = [
            step.model_dump() for step in payload.preparation_roadmap
        ]
    if payload.slug:
        slug = slugify(payload.slug, max_length=220)
        provider_id = payload.provider_id or certification.provider_id
        if await certification_repo.slug_exists(db, provider_id, slug, certification.id):
            raise ConflictError("That certification URL is already in use.")
        certification.slug = slug
    for field, value in data.items():
        setattr(certification, field, value)
    if payload.course_ids is not None:
        await _set_courses(db, certification, payload.course_ids)

    await db.commit()
    refreshed = await certification_repo.get_by_id(db, certification.id)
    assert refreshed is not None
    return refreshed


async def delete_certification(db: AsyncSession, certification_id: uuid.UUID) -> None:
    certification = await certification_repo.get_by_id(db, certification_id)
    if certification is None:
        raise NotFoundError("Certification not found.")
    await db.delete(certification)
    await db.commit()


# --------------------------------------------------------------------------
# Certification resources CRUD
# --------------------------------------------------------------------------
async def create_resource(
    db: AsyncSession, payload: CertificationResourceWrite
) -> CertificationResource:
    certification = await certification_repo.get_by_id(db, payload.certification_id)
    if certification is None:
        raise NotFoundError("Certification not found.")
    slug = await unique_slug(
        payload.slug or payload.title,
        lambda value: certification_repo.resource_slug_exists(db, certification.id, value),
        max_length=220,
    )
    resource = CertificationResource(**payload.model_dump(exclude={"slug"}), slug=slug)
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return resource


async def update_resource(
    db: AsyncSession, resource_id: uuid.UUID, payload: CertificationResourceUpdate
) -> CertificationResource:
    resource = await certification_repo.get_resource(db, resource_id)
    if resource is None:
        raise NotFoundError("Resource not found.")
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] != resource.title:
        resource.slug = await unique_slug(
            data["title"],
            lambda value: certification_repo.resource_slug_exists(
                db, resource.certification_id, value, resource.id
            ),
            max_length=220,
        )
    for field, value in data.items():
        setattr(resource, field, value)
    await db.commit()
    await db.refresh(resource)
    return resource


async def delete_resource(db: AsyncSession, resource_id: uuid.UUID) -> None:
    resource = await certification_repo.get_resource(db, resource_id)
    if resource is None:
        raise NotFoundError("Resource not found.")
    await db.delete(resource)
    await db.commit()
