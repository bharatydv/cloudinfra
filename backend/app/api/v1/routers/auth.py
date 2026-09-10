from fastapi import APIRouter, Request, status

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenPair,
    UserRead,
)
from app.schemas.common import Message
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_auth)
async def register(request: Request, payload: RegisterRequest, db: DbSession) -> AuthResponse:
    """Create a student account and return an access/refresh token pair."""
    user, tokens = await auth_service.register(db, payload, _agent(request))
    return AuthResponse(user=UserRead.model_validate(user), tokens=tokens)


@router.post("/login", response_model=AuthResponse)
@limiter.limit(settings.rate_limit_auth)
async def login(request: Request, payload: LoginRequest, db: DbSession) -> AuthResponse:
    user, tokens = await auth_service.login(db, payload, _agent(request))
    return AuthResponse(user=UserRead.model_validate(user), tokens=tokens)


@router.post("/refresh", response_model=TokenPair)
async def refresh(request: Request, payload: RefreshRequest, db: DbSession) -> TokenPair:
    """Rotate a refresh token. The presented token is single-use."""
    _, tokens = await auth_service.refresh_tokens(db, payload.refresh_token, _agent(request))
    return tokens


@router.post("/logout", response_model=Message)
async def logout(payload: RefreshRequest | None, user: CurrentUser, db: DbSession) -> Message:
    await auth_service.logout(db, payload.refresh_token if payload else None, user)
    return Message(message="Signed out.")


@router.get("/me", response_model=UserRead)
async def me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.post("/forgot-password", response_model=Message)
@limiter.limit(settings.rate_limit_auth)
async def forgot_password(
    request: Request, payload: ForgotPasswordRequest, db: DbSession
) -> Message:
    """Always reports success so accounts cannot be enumerated."""
    await auth_service.request_password_reset(db, payload.email)
    return Message(
        message="If an account exists for that email, a reset link is on its way."
    )


@router.post("/reset-password", response_model=Message)
@limiter.limit(settings.rate_limit_auth)
async def reset_password(
    request: Request, payload: ResetPasswordRequest, db: DbSession
) -> Message:
    await auth_service.reset_password(db, payload)
    return Message(message="Your password has been updated. Please sign in.")


@router.post("/change-password", response_model=Message)
async def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, db: DbSession
) -> Message:
    await auth_service.change_password(db, user, payload)
    return Message(message="Your password has been updated.")
