"""Proving a guest's email and phone with one-time codes.

The challenge captures a lead from someone with no account, and then promises
them a phone call. Neither promise is worth much if the address was mistyped
or invented, so each channel gets a six-digit code that has to be typed back
before a paper is issued. Codes live briefly, allow a handful of wrong
guesses, and are stored only as hashes.
"""

from __future__ import annotations

import hmac
import re
from datetime import UTC, datetime, timedelta
from typing import Literal, NoReturn

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ValidationFailedError
from app.core.security import generate_numeric_code, hash_opaque_token
from app.models.verification import ContactVerification
from app.services import email as email_service
from app.services import sms as sms_service

Channel = Literal["email", "phone"]

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE = re.compile(r"^\+?\d{8,15}$")


def normalize_target(channel: Channel, raw: str) -> str:
    """The canonical form of an address, so a code and a later sign-up match.

    Emails are case-folded; phones keep only digits and a leading plus, so
    "+91 90000-00000" and "+919000000000" are the same number.
    """
    value = raw.strip()
    if channel == "email":
        value = value.lower()
        if not _EMAIL.match(value):
            raise ValidationFailedError(
                "Enter a valid email address.",
                details=[{"field": "email", "message": "Enter a valid email address."}],
            )
        return value

    value = re.sub(r"[^\d+]", "", value)
    if value.startswith("00"):
        value = "+" + value[2:]
    if not _PHONE.match(value):
        message = "Enter a valid phone number with its country code."
        raise ValidationFailedError(message, details=[{"field": "phone", "message": message}])
    return value


async def request_code(
    db: AsyncSession, channel: Channel, target: str, *, source_ip: str | None = None
) -> int:
    """Send a fresh code and return how many minutes it stays valid.

    Any code still pending for the same address is expired first, so only the
    latest one counts and a resend cannot widen the guessing window.
    """
    now = datetime.now(UTC)
    await db.execute(
        update(ContactVerification)
        .where(
            ContactVerification.channel == channel,
            ContactVerification.target == target,
            ContactVerification.verified_at.is_(None),
            ContactVerification.expires_at > now,
        )
        .values(expires_at=now)
    )

    code = generate_numeric_code()
    minutes = settings.contact_verification_code_expire_minutes
    db.add(
        ContactVerification(
            channel=channel,
            target=target,
            code_hash=hash_opaque_token(code),
            expires_at=now + timedelta(minutes=minutes),
            source_ip=source_ip,
        )
    )
    await db.commit()

    if channel == "email":
        subject, body = email_service.contact_code_email(code)
        await email_service.send_email(target, subject, body)
    else:
        await sms_service.send_sms(target, sms_service.verification_sms(code))
    return minutes


async def confirm_code(db: AsyncSession, channel: Channel, target: str, code: str) -> None:
    now = datetime.now(UTC)
    row = await db.scalar(
        select(ContactVerification)
        .where(
            ContactVerification.channel == channel,
            ContactVerification.target == target,
            ContactVerification.verified_at.is_(None),
        )
        .order_by(ContactVerification.created_at.desc())
        .limit(1)
    )
    if row is None or row.expires_at <= now:
        _reject("This code has expired. Request a new one.")
    if row.attempts >= settings.contact_verification_max_attempts:
        _reject("Too many wrong codes. Request a new one.")

    if not hmac.compare_digest(row.code_hash, hash_opaque_token(code)):
        row.attempts += 1
        await db.commit()
        _reject("That code is not correct.")

    row.verified_at = now
    await db.commit()


async def is_verified(db: AsyncSession, channel: Channel, target: str) -> bool:
    """Whether the address was confirmed recently enough to still count."""
    cutoff = datetime.now(UTC) - timedelta(minutes=settings.contact_verification_valid_minutes)
    row = await db.scalar(
        select(ContactVerification.id)
        .where(
            ContactVerification.channel == channel,
            ContactVerification.target == target,
            ContactVerification.verified_at >= cutoff,
        )
        .limit(1)
    )
    return row is not None


async def require_verified(db: AsyncSession, *, email: str, phone: str) -> None:
    """Refuse to go on until both addresses have been confirmed."""
    problems: list[dict[str, str]] = []
    if not await is_verified(db, "email", normalize_target("email", email)):
        problems.append({"field": "email", "message": "Please verify your email address first."})
    if not await is_verified(db, "phone", normalize_target("phone", phone)):
        problems.append({"field": "phone", "message": "Please verify your phone number first."})
    if problems:
        raise ValidationFailedError(
            "Please verify your contact details before starting.", details=problems
        )


def _reject(message: str) -> NoReturn:
    raise ValidationFailedError(message, details=[{"field": "code", "message": message}])
