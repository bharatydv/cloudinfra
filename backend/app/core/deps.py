"""Shared FastAPI dependencies: DB session, current user, role guards."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AuthenticationError, PermissionDeniedError
from app.core.security import decode_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User

# auto_error=False so we can raise our own JSON error envelope.
bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


async def _user_from_token(token: str, db: AsyncSession) -> User:
    payload = decode_token(token, expected_type="access")
    if not payload:
        raise AuthenticationError("Your session has expired. Please sign in again.")
    try:
        user_id = uuid.UUID(str(payload.get("sub")))
    except (TypeError, ValueError) as exc:
        raise AuthenticationError() from exc

    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise AuthenticationError("This account is no longer active.")
    return user


async def get_current_user(db: DbSession, credentials: Credentials) -> User:
    if credentials is None or not credentials.credentials:
        raise AuthenticationError()
    return await _user_from_token(credentials.credentials, db)


async def get_optional_user(db: DbSession, credentials: Credentials) -> User | None:
    """For endpoints that personalise output but do not require a session."""
    if credentials is None or not credentials.credentials:
        return None
    try:
        return await _user_from_token(credentials.credentials, db)
    except AuthenticationError:
        return None


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require_roles(*roles: UserRole):
    allowed = {role.value for role in roles}

    async def _guard(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise PermissionDeniedError()
        return user

    return _guard


require_admin = require_roles(UserRole.ADMIN)
require_staff = require_roles(UserRole.ADMIN, UserRole.INSTRUCTOR)

AdminUser = Annotated[User, Depends(require_admin)]
StaffUser = Annotated[User, Depends(require_staff)]


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
