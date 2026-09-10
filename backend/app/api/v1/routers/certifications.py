from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import AdminUser, DbSession, OptionalUser, StaffUser
from app.core.errors import NotFoundError
from app.core.pagination import Page, PageParams, page_params
from app.models.enums import CertificationLevel
from app.repositories import certification_repo, engagement_repo
from app.schemas.certification import (
    CertificationCard,
    CertificationDetail,
    CertificationResourceCard,
    CertificationResourceRead,
    CertificationResourceUpdate,
    CertificationResourceWrite,
    CertificationUpdate,
    CertificationWrite,
    ProviderCard,
    ProviderDetail,
    ProviderUpdate,
    ProviderWrite,
)
from app.schemas.common import Message
from app.services import certification_service, serializers

router = APIRouter(tags=["Certifications"])
Params = Annotated[PageParams, Depends(page_params)]


# --------------------------------------------------------------------------
# Providers
# --------------------------------------------------------------------------
@router.get("/certification-providers", response_model=list[ProviderCard])
async def list_providers(db: DbSession) -> list[ProviderCard]:
    rows = await certification_repo.list_providers(db)
    return [serializers.provider_card(provider, count) for provider, count in rows]


@router.get("/certification-categories", response_model=list[str])
async def list_certification_categories(db: DbSession) -> list[str]:
    return await certification_repo.distinct_categories(db)


@router.get("/certifications", response_model=Page[CertificationCard])
async def list_certifications(
    db: DbSession,
    params: Params,
    viewer: OptionalUser,
    q: str | None = Query(None, description="Free-text search"),
    provider: str | None = Query(None, description="Provider slug"),
    level: CertificationLevel | None = None,
    category: str | None = None,
    sort: Literal["featured", "name", "level", "newest"] = "featured",
) -> Page[CertificationCard]:
    items, total = await certification_repo.list_certifications(
        db,
        params,
        search=q,
        provider_slug=provider,
        level=level.value if level else None,
        category=category,
        sort=sort,
    )
    saved_ids = (
        await engagement_repo.saved_certification_ids(db, viewer.id) if viewer else set()
    )
    return Page.create(
        [serializers.certification_card(item, saved_ids=saved_ids) for item in items],
        total,
        params,
    )


# Declared before the /{provider_slug}/{slug} route below: FastAPI matches in
# declaration order, so the literal "resources" segment must win first.
@router.get(
    "/certifications/{certification_id}/resources",
    response_model=list[CertificationResourceCard],
)
async def list_certification_resources(
    certification_id: uuid.UUID, db: DbSession, resource_type: str | None = None
) -> list[CertificationResourceCard]:
    resources = await certification_repo.list_resources(
        db, certification_id, resource_type=resource_type
    )
    return [serializers.resource_card(item) for item in resources]


@router.get("/certifications/{provider_slug}", response_model=ProviderDetail)
async def get_provider(provider_slug: str, db: DbSession) -> ProviderDetail:
    provider = await certification_repo.get_provider_by_slug(db, provider_slug)
    if provider is None:
        raise NotFoundError("Certification provider not found.")
    return await certification_service.build_provider_detail(db, provider)


@router.get("/certifications/{provider_slug}/{slug}", response_model=CertificationDetail)
async def get_certification(
    provider_slug: str, slug: str, db: DbSession, viewer: OptionalUser
) -> CertificationDetail:
    certification = await certification_repo.get_by_slug(db, provider_slug, slug)
    if certification is None:
        raise NotFoundError("Certification not found.")
    return await certification_service.build_certification_detail(
        db, certification, viewer.id if viewer else None
    )


@router.get(
    "/certification-resources/practice", response_model=list[CertificationResourceCard]
)
async def list_practice_resources(db: DbSession) -> list[CertificationResourceCard]:
    resources = await certification_repo.list_practice_resources(db)
    return [serializers.resource_card(item) for item in resources]


# --------------------------------------------------------------------------
# Admin
# --------------------------------------------------------------------------
@router.get("/admin/certifications", response_model=Page[CertificationCard], tags=["Admin"])
async def admin_list_certifications(
    db: DbSession,
    params: Params,
    _: StaffUser,
    q: str | None = None,
    is_published: bool | None = None,
) -> Page[CertificationCard]:
    items, total = await certification_repo.list_certifications(
        db, params, search=q, is_published=is_published, sort="newest"
    )
    return Page.create(
        [serializers.certification_card(item) for item in items], total, params
    )


@router.get(
    "/admin/certifications/{certification_id}",
    response_model=CertificationDetail,
    tags=["Admin"],
)
async def admin_get_certification(
    certification_id: uuid.UUID, db: DbSession, _: StaffUser
) -> CertificationDetail:
    certification = await certification_repo.get_by_id(db, certification_id)
    if certification is None:
        raise NotFoundError("Certification not found.")
    return await certification_service.build_certification_detail(db, certification, None)


@router.post(
    "/certifications",
    response_model=CertificationDetail,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin"],
)
async def create_certification(
    payload: CertificationWrite, db: DbSession, _: StaffUser
) -> CertificationDetail:
    certification = await certification_service.create_certification(db, payload)
    return await certification_service.build_certification_detail(db, certification, None)


@router.put(
    "/certifications/{certification_id}", response_model=CertificationDetail, tags=["Admin"]
)
async def update_certification(
    certification_id: uuid.UUID,
    payload: CertificationUpdate,
    db: DbSession,
    _: StaffUser,
) -> CertificationDetail:
    certification = await certification_service.update_certification(
        db, certification_id, payload
    )
    return await certification_service.build_certification_detail(db, certification, None)


@router.delete("/certifications/{certification_id}", response_model=Message, tags=["Admin"])
async def delete_certification(
    certification_id: uuid.UUID, db: DbSession, _: AdminUser
) -> Message:
    await certification_service.delete_certification(db, certification_id)
    return Message(message="Certification deleted.")


@router.post(
    "/certification-providers",
    response_model=ProviderCard,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin"],
)
async def create_provider(
    payload: ProviderWrite, db: DbSession, _: AdminUser
) -> ProviderCard:
    provider = await certification_service.create_provider(db, payload)
    return serializers.provider_card(provider)


@router.put("/certification-providers/{provider_id}", response_model=ProviderCard, tags=["Admin"])
async def update_provider(
    provider_id: uuid.UUID, payload: ProviderUpdate, db: DbSession, _: AdminUser
) -> ProviderCard:
    provider = await certification_service.update_provider(db, provider_id, payload)
    return serializers.provider_card(provider)


@router.delete(
    "/certification-providers/{provider_id}", response_model=Message, tags=["Admin"]
)
async def delete_provider(provider_id: uuid.UUID, db: DbSession, _: AdminUser) -> Message:
    await certification_service.delete_provider(db, provider_id)
    return Message(message="Provider deleted.")


@router.post(
    "/certification-resources",
    response_model=CertificationResourceRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin"],
)
async def create_resource(
    payload: CertificationResourceWrite, db: DbSession, _: StaffUser
) -> CertificationResourceRead:
    resource = await certification_service.create_resource(db, payload)
    return CertificationResourceRead.model_validate(resource)


@router.put(
    "/certification-resources/{resource_id}",
    response_model=CertificationResourceRead,
    tags=["Admin"],
)
async def update_resource(
    resource_id: uuid.UUID,
    payload: CertificationResourceUpdate,
    db: DbSession,
    _: StaffUser,
) -> CertificationResourceRead:
    resource = await certification_service.update_resource(db, resource_id, payload)
    return CertificationResourceRead.model_validate(resource)


@router.delete(
    "/certification-resources/{resource_id}", response_model=Message, tags=["Admin"]
)
async def delete_resource(resource_id: uuid.UUID, db: DbSession, _: StaffUser) -> Message:
    await certification_service.delete_resource(db, resource_id)
    return Message(message="Resource deleted.")
