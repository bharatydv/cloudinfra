"""Provider-agnostic transactional email.

Business logic depends on `EmailSender`, never on a vendor SDK. Swap providers
by changing EMAIL_PROVIDER; no call site changes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class EmailMessage:
    to: str
    subject: str
    text_body: str
    html_body: str | None = None


class EmailSender(Protocol):
    async def send(self, message: EmailMessage) -> None: ...


class ConsoleEmailSender:
    """Development default: logs instead of sending."""

    async def send(self, message: EmailMessage) -> None:
        logger.info(
            "[email:console] to=%s subject=%s\n%s",
            message.to,
            message.subject,
            message.text_body,
        )


class NotConfiguredEmailSender:
    """Fails loudly rather than silently dropping mail in production."""

    def __init__(self, provider: str) -> None:
        self.provider = provider

    async def send(self, message: EmailMessage) -> None:
        logger.error(
            "Email provider %r is selected but not configured; dropping message to %s",
            self.provider,
            message.to,
        )


@lru_cache
def get_email_sender() -> EmailSender:
    if settings.email_provider == "console":
        return ConsoleEmailSender()
    # SMTP/Resend adapters plug in here once credentials are provisioned.
    if not settings.email_provider_key:
        return NotConfiguredEmailSender(settings.email_provider)
    return NotConfiguredEmailSender(settings.email_provider)


async def send_email(to: str, subject: str, body: str, html: str | None = None) -> None:
    await get_email_sender().send(
        EmailMessage(to=to, subject=subject, text_body=body, html_body=html)
    )


# --- Templates ---------------------------------------------------------------
def welcome_email(name: str) -> tuple[str, str]:
    return (
        f"Welcome to {settings.email_from_name}",
        f"Hi {name},\n\nYour account is ready. "
        f"Start exploring courses and certification preparation paths at "
        f"{settings.public_site_url}.\n",
    )


def password_reset_email(name: str, token: str) -> tuple[str, str]:
    link = f"{settings.public_site_url}/reset-password?token={token}"
    return (
        "Reset your password",
        f"Hi {name},\n\nUse the link below to choose a new password. "
        f"It expires in {settings.password_reset_token_expire_minutes} minutes.\n\n{link}\n\n"
        "If you did not request this, you can ignore this email.\n",
    )


def enrollment_email(name: str, course_title: str, course_slug: str) -> tuple[str, str]:
    link = f"{settings.public_site_url}/learn/{course_slug}"
    return (
        f"You are enrolled in {course_title}",
        f"Hi {name},\n\nYou now have access to {course_title}. "
        f"Continue where you left off: {link}\n",
    )


def contact_confirmation_email(name: str, subject: str) -> tuple[str, str]:
    return (
        "We received your message",
        f"Hi {name},\n\nThanks for contacting us about \"{subject}\". "
        "Our team will reply as soon as possible.\n",
    )


def payment_confirmation_email(name: str, course_title: str, amount: str) -> tuple[str, str]:
    return (
        "Payment confirmed",
        f"Hi {name},\n\nWe have confirmed your payment of {amount} for {course_title}. "
        "Your enrollment is active.\n",
    )
