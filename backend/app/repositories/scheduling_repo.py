from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.models.scheduling import ExamBooking


async def list_bookings(
    db: AsyncSession,
    params: PageParams,
    *,
    status: str | None = None,
    search: str | None = None,
    certification_id: uuid.UUID | None = None,
) -> tuple[list[ExamBooking], int]:
    stmt = select(ExamBooking)
    if status:
        stmt = stmt.where(ExamBooking.status == status)
    if certification_id:
        stmt = stmt.where(ExamBooking.certification_id == certification_id)
    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(ExamBooking.full_name).like(term),
                func.lower(ExamBooking.email).like(term),
                func.lower(ExamBooking.certification_name).like(term),
                func.lower(ExamBooking.reference_code).like(term),
            )
        )

    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await db.scalars(
        stmt.order_by(ExamBooking.created_at.desc()).offset(params.offset).limit(params.limit)
    )
    return list(rows), total


async def get_booking(db: AsyncSession, booking_id: uuid.UUID) -> ExamBooking | None:
    return await db.scalar(select(ExamBooking).where(ExamBooking.id == booking_id))


async def reference_code_exists(db: AsyncSession, code: str) -> bool:
    found = await db.scalar(
        select(ExamBooking.id).where(ExamBooking.reference_code == code).limit(1)
    )
    return found is not None
