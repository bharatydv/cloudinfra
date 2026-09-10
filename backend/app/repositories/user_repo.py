from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.models.user import PasswordResetToken, RefreshToken, User


async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.scalar(select(User).where(User.id == user_id))


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


async def email_exists(db: AsyncSession, email: str) -> bool:
    return await get_by_email(db, email) is not None


async def list_users(
    db: AsyncSession,
    params: PageParams,
    *,
    search: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
) -> tuple[list[User], int]:
    stmt = select(User)
    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            func.lower(User.name).like(pattern) | func.lower(User.email).like(pattern)
        )
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))

    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await db.scalars(
        stmt.order_by(User.created_at.desc()).offset(params.offset).limit(params.limit)
    )
    return list(rows), total


# --- Refresh tokens ---------------------------------------------------------
async def store_refresh_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    token_hash: str,
    expires_at: datetime,
    user_agent: str | None = None,
) -> RefreshToken:
    token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=(user_agent or "")[:255] or None,
    )
    db.add(token)
    await db.flush()
    return token


async def get_refresh_token(db: AsyncSession, token_hash: str) -> RefreshToken | None:
    return await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))


async def revoke_refresh_token(db: AsyncSession, token: RefreshToken, now: datetime) -> None:
    token.revoked_at = now


async def revoke_all_refresh_tokens(
    db: AsyncSession, user_id: uuid.UUID, now: datetime
) -> None:
    rows = await db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
        )
    )
    for row in rows:
        row.revoked_at = now


# --- Password reset ---------------------------------------------------------
async def store_reset_token(
    db: AsyncSession, user_id: uuid.UUID, token_hash: str, expires_at: datetime
) -> PasswordResetToken:
    token = PasswordResetToken(
        user_id=user_id, token_hash=token_hash, expires_at=expires_at
    )
    db.add(token)
    await db.flush()
    return token


async def get_reset_token(db: AsyncSession, token_hash: str) -> PasswordResetToken | None:
    return await db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
