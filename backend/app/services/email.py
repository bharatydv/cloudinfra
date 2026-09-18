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


def exam_booking_email(
    name: str, certification_name: str, reference_code: str, preferred_date: str
) -> tuple[str, str]:
    return (
        f"We received your exam request ({reference_code})",
        f"Hi {name},\n\nWe have your request to schedule the {certification_name} exam "
        f"for {preferred_date}. Your reference is {reference_code}.\n\n"
        "Our team will confirm the slot by email. Seats are booked with the certification "
        "provider, so the final date and time are subject to their availability.\n",
    )


def exam_payment_confirmation_email(
    name: str, certification_name: str, amount: str, reference_code: str
) -> tuple[str, str]:
    return (
        f"Payment received for your {certification_name} exam ({reference_code})",
        f"Hi {name},\n\nWe have received your payment of {amount} for the "
        f"{certification_name} exam. Your reference is {reference_code}.\n\n"
        "We are now booking your slot with the certification provider and will "
        "email you the confirmed date and time. If the slot you asked for is "
        "unavailable we will offer alternatives or refund you in full.\n",
    )


def payment_confirmation_email(name: str, course_title: str, amount: str) -> tuple[str, str]:
    return (
        "Payment confirmed",
        f"Hi {name},\n\nWe have confirmed your payment of {amount} for {course_title}. "
        "Your enrollment is active.\n",
    )


def challenge_result_email(
    *,
    name: str,
    certification_name: str,
    reference_code: str,
    score: str,
    correct_count: int,
    question_count: int,
    passed: bool,
    discount_percentage: str | None,
    response_hours: int,
    retake_after_days: int,
    warnings: int,
) -> tuple[str, str]:
    """The candidate's copy of their result.

    The score is restated here because the result page is not addressable
    later -- this email is the only durable record the candidate keeps.
    """
    scoreline = f"You answered {correct_count} of {question_count} correctly ({score})."
    note = ""
    if warnings:
        note = (
            f"\nRecorded during your test: {warnings} warning(s) for leaving the "
            "test window or attempting to copy text.\n"
        )

    if passed and discount_percentage:
        return (
            f"You passed - {discount_percentage} off your {certification_name} exam "
            f"({reference_code})",
            f"Hi {name},\n\n{scoreline}\n\n"
            f"You have qualified for {discount_percentage} off the {certification_name} "
            f"exam. Our team will contact you within {response_hours} hours to confirm "
            "the discount and schedule your exam on a call, at a date and time that "
            f"suits you.\n\nYour reference is {reference_code} - quote it when we "
            f"speak.\n{note}\n"
            "Seats are booked with the certification provider, so the final date and "
            "time depend on their availability.\n",
        )

    return (
        f"Your {certification_name} test result ({reference_code})",
        f"Hi {name},\n\n{scoreline}\n\n"
        "That is below the mark needed for the exam discount this time. Your result "
        "page listed the correct answer and an explanation for every question, which "
        "is the fastest way to see what to revise.\n\n"
        f"You can take the test again after {retake_after_days} days. Your reference "
        f"is {reference_code}.\n{note}",
    )


def challenge_lead_email(
    *,
    name: str,
    email: str,
    phone: str,
    certification_name: str,
    score: str,
    discount_percentage: str,
    reference_code: str,
    response_hours: int,
) -> tuple[str, str]:
    """Internal alert: somebody has been promised a callback, with a clock on it."""
    return (
        f"Challenge lead: {name} qualified for {certification_name} ({score})",
        f"{name} passed the {certification_name} challenge with {score} and has been "
        f"promised {discount_percentage} off, plus a call within {response_hours} "
        f"hours.\n\n"
        f"Reference: {reference_code}\n"
        f"Email:     {email}\n"
        f"Phone:     {phone}\n\n"
        "Open Admin > Challenge leads to record the outcome of the call.\n",
    )
