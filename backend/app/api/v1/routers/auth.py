from fastapi import APIRouter, Request, status

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.schemas.auth import (
    AuthProviders,
    AuthResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    GoogleProviderConfig,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenPair,
    UserRead,
    VerifyEmailRequest,
)
from app.schemas.common import Message
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_auth)
async def register(request: Request, payload: RegisterRequest, db: DbSession) -> AuthResponse:
    """Create a student account and return a session for it.

    Sign-up confirms nothing by email: the account is usable immediately.
    /auth/verify-email and /auth/resend-verification remain for accounts
    created under the older flow that never had their code entered.
    """
    user, tokens = await auth_service.register(db, payload, _agent(request))
    return AuthResponse(user=UserRead.model_validate(user), tokens=tokens)


@router.post("/verify-email", response_model=AuthResponse)
@limiter.limit(settings.rate_limit_auth)
async def verify_email(request: Request, payload: VerifyEmailRequest, db: DbSession) -> AuthResponse:
    """Confirm the signup code and return an access/refresh token pair."""
    user, tokens = await auth_service.verify_email(db, payload, _agent(request))
    return AuthResponse(user=UserRead.model_validate(user), tokens=tokens)


@router.post("/resend-verification", response_model=Message)
@limiter.limit(settings.rate_limit_auth)
async def resend_verification(
    request: Request, payload: ResendVerificationRequest, db: DbSession
) -> Message:
    """Always reports success so accounts cannot be enumerated."""
    await auth_service.resend_verification(db, payload.email)
    return Message(message="If that account needs verifying, a new code is on its way.")


@router.post("/login", response_model=AuthResponse)
@limiter.limit(settings.rate_limit_auth)
async def login(request: Request, payload: LoginRequest, db: DbSession) -> AuthResponse:
    user, tokens = await auth_service.login(db, payload, _agent(request))
    return AuthResponse(user=UserRead.model_validate(user), tokens=tokens)


@router.get("/providers", response_model=AuthProviders)
async def providers() -> AuthProviders:
    """Which third-party sign-ins this deployment has configured.

    Served rather than baked into the frontend bundle, so switching Google
    sign-in on is an environment change and not a rebuild.
    """
    return AuthProviders(
        google=GoogleProviderConfig(
            enabled=settings.google_sign_in_enabled,
            client_id=settings.google_client_id,
        )
    )


@router.post("/google", response_model=AuthResponse)
@limiter.limit(settings.rate_limit_auth)
async def google_sign_in(
    request: Request, payload: GoogleAuthRequest, db: DbSession
) -> AuthResponse:
    """Sign in, or sign up, with a Google ID token from the browser.

    Both halves share this endpoint: an address Google has verified either
    matches an account or creates one, and either way a token pair comes back
    exactly as it does from /auth/login.
    """
    user, tokens = await auth_service.login_with_google(
        db, payload.credential, _agent(request)
    )
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
