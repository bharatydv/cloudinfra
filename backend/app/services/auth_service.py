from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import (
    AuthenticationError,
    ConflictError,
    EmailNotVerifiedError,
    ValidationFailedError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_numeric_code,
    generate_opaque_token,
    hash_opaque_token,
    hash_password,
    needs_rehash,
    verify_password,
)
from app.models.enums import UserRole
from app.models.user import User
from app.repositories import user_repo
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenPair,
    VerifyEmailRequest,
)
from app.services import email as email_service
from app.services import google_oauth


def _issue_tokens_payload(user: User) -> tuple[str, str]:
    return (
        create_access_token(str(user.id), user.role),
        create_refresh_token(str(user.id)),
    )


async def _persist_refresh(
    db: AsyncSession, user: User, refresh_token: str, user_agent: str | None
) -> None:
    payload = decode_token(refresh_token, expected_type="refresh")
    assert payload is not None  # freshly minted by us
    await user_repo.store_refresh_token(
        db,
        user.id,
        hash_opaque_token(refresh_token),
        datetime.fromtimestamp(payload["exp"], tz=UTC),
        user_agent,
    )


async def issue_token_pair(
    db: AsyncSession, user: User, user_agent: str | None = None
) -> TokenPair:
    access_token, refresh_token = _issue_tokens_payload(user)
    await _persist_refresh(db, user, refresh_token, user_agent)
    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


async def _send_verification_code(db: AsyncSession, user: User) -> None:
    now = datetime.now(UTC)
    await user_repo.invalidate_verification_codes(db, user.id, now)

    code = generate_numeric_code()
    expires_at = now + timedelta(minutes=settings.email_verification_code_expire_minutes)
    await user_repo.store_verification_code(db, user.id, hash_opaque_token(code), expires_at)
    await db.commit()

    subject, body = email_service.verification_email(user.name, code)
    await email_service.send_email(user.email, subject, body)


async def register(
    db: AsyncSession, payload: RegisterRequest, user_agent: str | None = None
) -> tuple[User, TokenPair]:
    """Create a student account and sign it straight in.

    Sign-up no longer emails a code to type back: nothing in the product
    depends on the address having been proven, so the step was friction with
    little to show for it. The address is taken on trust here; Google sign-in
    is the one path that actually proves one.
    """
    email = payload.email.strip().lower()
    if await user_repo.email_exists(db, email):
        raise ConflictError("An account with that email already exists.")

    user = User(
        name=payload.name.strip(),
        email=email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=UserRole.STUDENT.value,
        is_email_verified=True,
    )
    db.add(user)
    await db.flush()

    user.last_login_at = datetime.now(UTC)
    tokens = await issue_token_pair(db, user, user_agent)
    await db.commit()
    await db.refresh(user)

    subject, body = email_service.welcome_email(user.name)
    await email_service.send_email(user.email, subject, body)
    return user, tokens


async def verify_email(
    db: AsyncSession, payload: VerifyEmailRequest, user_agent: str | None = None
) -> tuple[User, TokenPair]:
    user = await user_repo.get_by_email(db, payload.email)
    if user is None:
        raise ValidationFailedError("This code is invalid or has expired.")
    if user.is_email_verified:
        raise ValidationFailedError("This account is already verified. Please sign in.")

    stored = await user_repo.get_verification_code(db, user.id, hash_opaque_token(payload.code))
    now = datetime.now(UTC)
    if stored is None or stored.used_at is not None or stored.expires_at <= now:
        raise ValidationFailedError("This code is invalid or has expired.")

    stored.used_at = now
    user.is_email_verified = True
    user.last_login_at = now
    tokens = await issue_token_pair(db, user, user_agent)
    await db.commit()
    await db.refresh(user)

    subject, body = email_service.welcome_email(user.name)
    await email_service.send_email(user.email, subject, body)
    return user, tokens


async def resend_verification(db: AsyncSession, email: str) -> None:
    """Always succeeds from the caller's point of view (no account enumeration)."""
    user = await user_repo.get_by_email(db, email)
    if user is None or user.is_email_verified:
        return
    await _send_verification_code(db, user)


async def login(
    db: AsyncSession, payload: LoginRequest, user_agent: str | None = None
) -> tuple[User, TokenPair]:
    user = await user_repo.get_by_email(db, payload.email)
    # Constant-ish response regardless of which half failed. A Google-only
    # account has no hash, so no password can ever match it.
    if (
        user is None
        or user.password_hash is None
        or not verify_password(payload.password, user.password_hash)
    ):
        raise AuthenticationError("Incorrect email or password.")
    if not user.is_active:
        raise AuthenticationError("This account has been deactivated.")
    if not user.is_email_verified:
        raise EmailNotVerifiedError()

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)

    user.last_login_at = datetime.now(UTC)
    tokens = await issue_token_pair(db, user, user_agent)
    await db.commit()
    await db.refresh(user)
    return user, tokens


async def login_with_google(
    db: AsyncSession, credential: str, user_agent: str | None = None
) -> tuple[User, TokenPair]:
    """Sign in with a verified Google ID token, creating the account if needed.

    One path covers both halves of the flow, because the browser cannot tell us
    which it is: Google returns the same credential whether the person has an
    account here or not.
    """
    identity = await google_oauth.verify_id_token(credential)

    # Match on the Google subject first -- it survives a Google-side email
    # change, which the address does not.
    user = await user_repo.get_by_google_sub(db, identity.sub)
    if user is None:
        user = await user_repo.get_by_email(db, identity.email)

    created = user is None
    if user is None:
        # Google has already proved the address, so there is no code to email
        # and no password to set. Phone is left blank: the profile page is
        # where it gets filled in, and blocking sign-up on it would defeat the
        # point of a one-click sign-in.
        user = User(
            name=identity.name,
            email=identity.email,
            phone="",
            password_hash=None,
            google_sub=identity.sub,
            role=UserRole.STUDENT.value,
            is_email_verified=True,
            profile_image=identity.picture,
        )
        db.add(user)
        await db.flush()
    else:
        if not user.is_active:
            raise AuthenticationError("This account has been deactivated.")
        # Linking an existing account to the Google profile on first use is
        # safe because the address came back verified by Google itself.
        if user.google_sub is None:
            user.google_sub = identity.sub
        user.is_email_verified = True
        if not user.profile_image and identity.picture:
            user.profile_image = identity.picture

    user.last_login_at = datetime.now(UTC)
    tokens = await issue_token_pair(db, user, user_agent)
    await db.commit()
    await db.refresh(user)

    if created:
        subject, body = email_service.welcome_email(user.name)
        await email_service.send_email(user.email, subject, body)
    return user, tokens


async def refresh_tokens(
    db: AsyncSession, refresh_token: str, user_agent: str | None = None
) -> tuple[User, TokenPair]:
    payload = decode_token(refresh_token, expected_type="refresh")
    if not payload:
        raise AuthenticationError("Your session has expired. Please sign in again.")

    token_hash = hash_opaque_token(refresh_token)
    stored = await user_repo.get_refresh_token(db, token_hash)
    now = datetime.now(UTC)
    if stored is None or stored.revoked_at is not None or stored.expires_at <= now:
        raise AuthenticationError("Your session has expired. Please sign in again.")

    user = await user_repo.get_by_id(db, stored.user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("This account is no longer active.")

    # Rotate: the presented token is single-use.
    await user_repo.revoke_refresh_token(db, stored, now)
    tokens = await issue_token_pair(db, user, user_agent)
    await db.commit()
    return user, tokens


async def logout(db: AsyncSession, refresh_token: str | None, user: User) -> None:
    now = datetime.now(UTC)
    if refresh_token:
        stored = await user_repo.get_refresh_token(db, hash_opaque_token(refresh_token))
        if stored is not None and stored.user_id == user.id:
            await user_repo.revoke_refresh_token(db, stored, now)
        else:
            await user_repo.revoke_all_refresh_tokens(db, user.id, now)
    else:
        await user_repo.revoke_all_refresh_tokens(db, user.id, now)
    await db.commit()


async def request_password_reset(db: AsyncSession, email: str) -> None:
    """Always succeeds from the caller's point of view (no account enumeration)."""
    user = await user_repo.get_by_email(db, email)
    if user is None or not user.is_active:
        return

    raw_token = generate_opaque_token()
    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.password_reset_token_expire_minutes
    )
    await user_repo.store_reset_token(db, user.id, hash_opaque_token(raw_token), expires_at)
    await db.commit()

    subject, body = email_service.password_reset_email(user.name, raw_token)
    await email_service.send_email(user.email, subject, body)


async def reset_password(db: AsyncSession, payload: ResetPasswordRequest) -> None:
    stored = await user_repo.get_reset_token(db, hash_opaque_token(payload.token))
    now = datetime.now(UTC)
    if stored is None or stored.used_at is not None or stored.expires_at <= now:
        raise ValidationFailedError("This reset link is invalid or has expired.")

    user = await user_repo.get_by_id(db, stored.user_id)
    if user is None:
        raise ValidationFailedError("This reset link is invalid or has expired.")

    user.password_hash = hash_password(payload.password)
    stored.used_at = now
    # A password change invalidates every existing session.
    await user_repo.revoke_all_refresh_tokens(db, user.id, now)
    await db.commit()


async def change_password(
    db: AsyncSession, user: User, payload: ChangePasswordRequest
) -> None:
    if user.password_hash is None:
        raise ValidationFailedError(
            "This account signs in with Google. Use the forgot-password link to "
            "set a password for it."
        )
    if not verify_password(payload.current_password, user.password_hash):
        raise ValidationFailedError("Your current password is incorrect.")
    user.password_hash = hash_password(payload.new_password)
    await user_repo.revoke_all_refresh_tokens(db, user.id, datetime.now(UTC))
    await db.commit()
