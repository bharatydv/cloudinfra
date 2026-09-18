from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.models.campaign import ChallengeAttempt, ChallengeQuestion


async def pool_for(
    db: AsyncSession, *, provider_slug: str, certification_id: uuid.UUID
) -> list[ChallengeQuestion]:
    """Active questions a paper for this certification may be drawn from.

    Exam-specific questions and the provider-wide pool come back together; the
    service decides how many of each to serve.
    """
    rows = await db.scalars(
        select(ChallengeQuestion).where(
            ChallengeQuestion.is_active.is_(True),
            ChallengeQuestion.provider_slug == provider_slug,
            or_(
                ChallengeQuestion.certification_id == certification_id,
                ChallengeQuestion.certification_id.is_(None),
            ),
        )
    )
    return list(rows)


async def pool_sizes(
    db: AsyncSession, *, provider_slug: str
) -> tuple[dict[uuid.UUID, int], int]:
    """Per-certification question counts, plus the size of the shared pool.

    One grouped query so the landing screen can show every certification's
    availability without a request each.
    """
    rows = await db.execute(
        select(ChallengeQuestion.certification_id, func.count())
        .where(
            ChallengeQuestion.is_active.is_(True),
            ChallengeQuestion.provider_slug == provider_slug,
        )
        .group_by(ChallengeQuestion.certification_id)
    )
    per_certification: dict[uuid.UUID, int] = {}
    shared = 0
    for certification_id, count in rows:
        if certification_id is None:
            shared = count
        else:
            per_certification[certification_id] = count
    return per_certification, shared


async def questions_by_ids(
    db: AsyncSession, ids: list[uuid.UUID]
) -> dict[uuid.UUID, ChallengeQuestion]:
    if not ids:
        return {}
    rows = await db.scalars(
        select(ChallengeQuestion).where(ChallengeQuestion.id.in_(ids))
    )
    return {row.id: row for row in rows}


async def get_attempt(
    db: AsyncSession, attempt_id: uuid.UUID
) -> ChallengeAttempt | None:
    return await db.scalar(
        select(ChallengeAttempt).where(ChallengeAttempt.id == attempt_id)
    )


async def reference_code_exists(db: AsyncSession, code: str) -> bool:
    found = await db.scalar(
        select(ChallengeAttempt.id)
        .where(ChallengeAttempt.reference_code == code)
        .limit(1)
    )
    return found is not None


async def last_submission_for(db: AsyncSession, email: str) -> datetime | None:
    """When this address last finished a paper, for the retake cooldown."""
    return await db.scalar(
        select(func.max(ChallengeAttempt.submitted_at)).where(
            ChallengeAttempt.email == email
        )
    )


async def list_attempts(
    db: AsyncSession,
    params: PageParams,
    *,
    lead_status: str | None = None,
    passed: bool | None = None,
    certification_id: uuid.UUID | None = None,
    search: str | None = None,
) -> tuple[list[ChallengeAttempt], int]:
    stmt = select(ChallengeAttempt)
    if lead_status:
        stmt = stmt.where(ChallengeAttempt.lead_status == lead_status)
    if passed is not None:
        stmt = stmt.where(ChallengeAttempt.passed.is_(passed))
    if certification_id:
        stmt = stmt.where(ChallengeAttempt.certification_id == certification_id)
    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(ChallengeAttempt.full_name).like(term),
                func.lower(ChallengeAttempt.email).like(term),
                func.lower(ChallengeAttempt.certification_name).like(term),
                func.lower(ChallengeAttempt.reference_code).like(term),
            )
        )

    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await db.scalars(
        stmt.order_by(ChallengeAttempt.created_at.desc())
        .offset(params.offset)
        .limit(params.limit)
    )
    return list(rows), total
