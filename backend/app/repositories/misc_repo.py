from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.models.content import Faq, Testimonial
from app.models.system import ContactMessage, SiteSetting


# --- FAQs -------------------------------------------------------------------
async def list_faqs(
    db: AsyncSession, *, category: str | None = None, published_only: bool = True
) -> list[Faq]:
    stmt = select(Faq)
    if published_only:
        stmt = stmt.where(Faq.is_published.is_(True))
    if category:
        stmt = stmt.where(Faq.category == category)
    rows = await db.scalars(stmt.order_by(Faq.position, Faq.created_at))
    return list(rows)


async def get_faq(db: AsyncSession, faq_id: uuid.UUID) -> Faq | None:
    return await db.scalar(select(Faq).where(Faq.id == faq_id))


async def faq_categories(db: AsyncSession) -> list[str]:
    rows = await db.scalars(select(Faq.category).distinct().order_by(Faq.category))
    return list(rows)


# --- Testimonials -----------------------------------------------------------
async def list_testimonials(
    db: AsyncSession, *, published_only: bool = True, limit: int | None = None
) -> list[Testimonial]:
    stmt = select(Testimonial)
    if published_only:
        stmt = stmt.where(Testimonial.is_published.is_(True))
    stmt = stmt.order_by(Testimonial.position, Testimonial.created_at)
    if limit:
        stmt = stmt.limit(limit)
    rows = await db.scalars(stmt)
    return list(rows)


async def get_testimonial(db: AsyncSession, testimonial_id: uuid.UUID) -> Testimonial | None:
    return await db.scalar(select(Testimonial).where(Testimonial.id == testimonial_id))


# --- Contact messages -------------------------------------------------------
async def list_contact_messages(
    db: AsyncSession, params: PageParams, *, status: str | None = None
) -> tuple[list[ContactMessage], int]:
    stmt = select(ContactMessage)
    if status:
        stmt = stmt.where(ContactMessage.status == status)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await db.scalars(
        stmt.order_by(ContactMessage.created_at.desc())
        .offset(params.offset)
        .limit(params.limit)
    )
    return list(rows), total


async def get_contact_message(
    db: AsyncSession, message_id: uuid.UUID
) -> ContactMessage | None:
    return await db.scalar(select(ContactMessage).where(ContactMessage.id == message_id))


# --- Site settings ----------------------------------------------------------
async def get_setting(db: AsyncSession, key: str) -> SiteSetting | None:
    return await db.scalar(select(SiteSetting).where(SiteSetting.key == key))


async def list_settings(db: AsyncSession, *, public_only: bool = True) -> list[SiteSetting]:
    stmt = select(SiteSetting)
    if public_only:
        stmt = stmt.where(SiteSetting.is_public.is_(True))
    rows = await db.scalars(stmt.order_by(SiteSetting.key))
    return list(rows)


async def upsert_setting(
    db: AsyncSession,
    key: str,
    value: dict[str, Any],
    *,
    description: str | None = None,
    is_public: bool = True,
) -> SiteSetting:
    setting = await get_setting(db, key)
    if setting is None:
        setting = SiteSetting(
            key=key, value=value, description=description, is_public=is_public
        )
        db.add(setting)
    else:
        setting.value = value
        if description is not None:
            setting.description = description
        setting.is_public = is_public
    await db.flush()
    return setting
