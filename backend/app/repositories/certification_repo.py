from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Literal

from sqlalchemy import Select, case, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.pagination import PageParams
from app.models.certification import (
    Certification,
    CertificationProvider,
    CertificationResource,
)
from app.models.enums import ContentStatus, ResourceType

CertificationSort = Literal["featured", "name", "level", "newest", "discount", "price"]

_DETAIL_LOADS = (
    selectinload(Certification.provider),
    selectinload(Certification.resources),
    selectinload(Certification.courses),
)
_CARD_LOADS = (selectinload(Certification.provider), selectinload(Certification.courses))


def _effective_discount(default_discount: Decimal):
    """The percentage actually applied to one exam.

    A NULL override inherits the site-wide default, and an exam with no quoted
    fee has no discount at all -- mirroring pricing.compute, so a sort or a
    filter can never disagree with the figure printed on the card.
    """
    return case(
        (
            or_(Certification.exam_fee_amount.is_(None), Certification.exam_fee_amount <= 0),
            literal(Decimal(0)),
        ),
        else_=func.coalesce(
            Certification.discount_percentage, literal(default_discount)
        ),
    )


def _total_price(default_discount: Decimal, tax_rate: Decimal):
    """What a visitor actually pays, tax included.

    Filtering on the pre-tax figure would quietly admit exams that are shown on
    the card above the stated ceiling, so the whole chain is rebuilt here.
    Unpriced exams evaluate to NULL and sort last.
    """
    net = Certification.exam_fee_amount * (100 - _effective_discount(default_discount)) / 100
    return net * (100 + tax_rate) / 100


def _apply_sort(
    stmt: Select, sort: CertificationSort, default_discount: Decimal, tax_rate: Decimal
) -> Select:
    match sort:
        case "name":
            return stmt.order_by(Certification.name.asc())
        case "newest":
            return stmt.order_by(Certification.created_at.desc())
        case "level":
            return stmt.order_by(Certification.level.asc(), Certification.name.asc())
        case "discount":
            return stmt.order_by(
                _effective_discount(default_discount).desc(), Certification.name.asc()
            )
        case "price":
            return stmt.order_by(
                _total_price(default_discount, tax_rate).asc().nulls_last(),
                Certification.name.asc(),
            )
        case _:
            return stmt.order_by(
                Certification.is_featured.desc(),
                Certification.position.asc(),
                Certification.name.asc(),
            )


async def list_certifications(
    db: AsyncSession,
    params: PageParams,
    *,
    search: str | None = None,
    provider_slug: str | None = None,
    provider_id: uuid.UUID | None = None,
    level: str | None = None,
    category: str | None = None,
    min_discount: int | None = None,
    max_price: Decimal | None = None,
    is_published: bool | None = True,
    sort: CertificationSort = "featured",
    default_discount: Decimal = Decimal(0),
    tax_rate: Decimal = Decimal(0),
) -> tuple[list[Certification], int]:
    stmt = select(Certification)
    if is_published is not None:
        stmt = stmt.where(Certification.is_published.is_(is_published))
    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Certification.name).like(pattern),
                func.lower(Certification.short_description).like(pattern),
                func.lower(func.coalesce(Certification.exam_code, "")).like(pattern),
            )
        )
    if provider_slug:
        stmt = stmt.join(CertificationProvider).where(
            CertificationProvider.slug == provider_slug
        )
    if provider_id:
        stmt = stmt.where(Certification.provider_id == provider_id)
    if level:
        stmt = stmt.where(Certification.level == level)
    if category:
        stmt = stmt.where(Certification.category == category)
    if min_discount:
        stmt = stmt.where(_effective_discount(default_discount) >= min_discount)
    if max_price is not None:
        stmt = stmt.where(_total_price(default_discount, tax_rate) <= max_price)

    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await db.scalars(
        _apply_sort(stmt, sort, default_discount, tax_rate)
        .options(*_CARD_LOADS)
        .offset(params.offset)
        .limit(params.limit)
    )
    return list(rows.unique()), total


async def priced(db: AsyncSession) -> list[Certification]:
    """Every published certification carrying a quoted vendor fee.

    Whether each one is actually discounted depends on the site-wide default,
    which is not a column, so that decision is left to the caller rather than
    guessed at in SQL.
    """
    rows = await db.scalars(
        select(Certification)
        .where(
            Certification.is_published.is_(True),
            Certification.exam_fee_amount.is_not(None),
            Certification.exam_fee_amount > 0,
        )
        .options(*_CARD_LOADS)
    )
    return list(rows.unique())


async def get_by_slug(
    db: AsyncSession,
    provider_slug: str,
    slug: str,
    *,
    published_only: bool = True,
) -> Certification | None:
    stmt = (
        select(Certification)
        .join(CertificationProvider)
        .where(CertificationProvider.slug == provider_slug, Certification.slug == slug)
        .options(*_DETAIL_LOADS)
    )
    if published_only:
        stmt = stmt.where(Certification.is_published.is_(True))
    return await db.scalar(stmt)


async def get_by_id(db: AsyncSession, certification_id: uuid.UUID) -> Certification | None:
    return await db.scalar(
        select(Certification)
        .where(Certification.id == certification_id)
        .options(*_DETAIL_LOADS)
    )


async def slug_exists(
    db: AsyncSession,
    provider_id: uuid.UUID,
    slug: str,
    exclude_id: uuid.UUID | None = None,
) -> bool:
    stmt = select(Certification.id).where(
        Certification.provider_id == provider_id, Certification.slug == slug
    )
    if exclude_id:
        stmt = stmt.where(Certification.id != exclude_id)
    return await db.scalar(stmt) is not None


async def featured(db: AsyncSession, limit: int = 6) -> list[Certification]:
    rows = await db.scalars(
        select(Certification)
        .where(Certification.is_published.is_(True))
        .order_by(
            Certification.is_featured.desc(),
            Certification.position.asc(),
            Certification.name.asc(),
        )
        .options(*_CARD_LOADS)
        .limit(limit)
    )
    return list(rows.unique())


async def related(db: AsyncSession, certification: Certification, limit: int = 4):
    rows = await db.scalars(
        select(Certification)
        .where(
            Certification.is_published.is_(True),
            Certification.id != certification.id,
            Certification.provider_id == certification.provider_id,
        )
        .order_by(Certification.position.asc())
        .options(*_CARD_LOADS)
        .limit(limit)
    )
    found = list(rows.unique())
    if len(found) >= limit:
        return found
    extra = await db.scalars(
        select(Certification)
        .where(
            Certification.is_published.is_(True),
            Certification.id != certification.id,
            Certification.provider_id != certification.provider_id,
        )
        .order_by(Certification.is_featured.desc())
        .options(*_CARD_LOADS)
        .limit(limit - len(found))
    )
    return found + list(extra.unique())


async def certifications_for_course(db: AsyncSession, course_id: uuid.UUID):
    rows = await db.scalars(
        select(Certification)
        .where(
            Certification.is_published.is_(True),
            Certification.courses.any(id=course_id),
        )
        .options(selectinload(Certification.provider))
    )
    return list(rows.unique())


async def distinct_categories(db: AsyncSession) -> list[str]:
    rows = await db.scalars(
        select(Certification.category)
        .where(
            Certification.is_published.is_(True), Certification.category.is_not(None)
        )
        .distinct()
        .order_by(Certification.category)
    )
    return [row for row in rows if row]


# --- Providers --------------------------------------------------------------
async def list_providers(
    db: AsyncSession, *, published_only: bool = True
) -> list[tuple[CertificationProvider, int]]:
    cert_filter = Certification.provider_id == CertificationProvider.id
    if published_only:
        cert_filter = cert_filter & Certification.is_published.is_(True)
    stmt = (
        select(CertificationProvider, func.count(Certification.id))
        .outerjoin(Certification, cert_filter)
        .group_by(CertificationProvider.id)
        .order_by(CertificationProvider.position, CertificationProvider.name)
    )
    if published_only:
        stmt = stmt.where(CertificationProvider.is_published.is_(True))
    return [(row[0], row[1]) for row in (await db.execute(stmt)).all()]


async def get_provider_by_slug(
    db: AsyncSession, slug: str, *, published_only: bool = True
) -> CertificationProvider | None:
    stmt = select(CertificationProvider).where(CertificationProvider.slug == slug)
    if published_only:
        stmt = stmt.where(CertificationProvider.is_published.is_(True))
    return await db.scalar(stmt)


async def get_provider_by_id(
    db: AsyncSession, provider_id: uuid.UUID
) -> CertificationProvider | None:
    return await db.scalar(
        select(CertificationProvider).where(CertificationProvider.id == provider_id)
    )


async def provider_slug_exists(
    db: AsyncSession, slug: str, exclude_id: uuid.UUID | None = None
) -> bool:
    stmt = select(CertificationProvider.id).where(CertificationProvider.slug == slug)
    if exclude_id:
        stmt = stmt.where(CertificationProvider.id != exclude_id)
    return await db.scalar(stmt) is not None


# --- Resources --------------------------------------------------------------
async def list_resources(
    db: AsyncSession,
    certification_id: uuid.UUID,
    *,
    resource_type: str | None = None,
    published_only: bool = True,
) -> list[CertificationResource]:
    stmt = select(CertificationResource).where(
        CertificationResource.certification_id == certification_id
    )
    if published_only:
        stmt = stmt.where(CertificationResource.status == ContentStatus.PUBLISHED.value)
    if resource_type:
        stmt = stmt.where(CertificationResource.resource_type == resource_type)
    rows = await db.scalars(stmt.order_by(CertificationResource.position))
    return list(rows)


async def list_practice_resources(
    db: AsyncSession, limit: int = 24
) -> list[CertificationResource]:
    rows = await db.scalars(
        select(CertificationResource)
        .join(Certification)
        .where(
            CertificationResource.resource_type == ResourceType.PRACTICE.value,
            CertificationResource.status == ContentStatus.PUBLISHED.value,
            Certification.is_published.is_(True),
        )
        .order_by(CertificationResource.position)
        .limit(limit)
    )
    return list(rows)


async def get_resource(
    db: AsyncSession, resource_id: uuid.UUID
) -> CertificationResource | None:
    return await db.scalar(
        select(CertificationResource).where(CertificationResource.id == resource_id)
    )


async def resource_slug_exists(
    db: AsyncSession,
    certification_id: uuid.UUID,
    slug: str,
    exclude_id: uuid.UUID | None = None,
) -> bool:
    stmt = select(CertificationResource.id).where(
        CertificationResource.certification_id == certification_id,
        CertificationResource.slug == slug,
    )
    if exclude_id:
        stmt = stmt.where(CertificationResource.id != exclude_id)
    return await db.scalar(stmt) is not None
