"""Provider-agnostic transactional email.

Business logic depends on `EmailSender`, never on a vendor SDK. Swap providers
by changing EMAIL_PROVIDER; no call site changes.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage as EmailMessageBuilder
from email.utils import formataddr
from functools import lru_cache
from typing import Protocol

import httpx

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


class SmtpEmailSender:
    """Plain SMTP, run off the event loop.

    smtplib is blocking, and a slow relay must not stall the request that
    triggered the mail, so each send happens in a worker thread.
    """

    async def send(self, message: EmailMessage) -> None:
        await asyncio.to_thread(self._send_blocking, message)

    @staticmethod
    def _send_blocking(message: EmailMessage) -> None:
        mail = EmailMessageBuilder()
        mail["Subject"] = message.subject
        mail["From"] = formataddr((settings.email_from_name, settings.email_from_address))
        mail["To"] = message.to
        mail.set_content(message.text_body)
        if message.html_body:
            mail.add_alternative(message.html_body, subtype="html")

        host = settings.smtp_host or ""
        if settings.smtp_use_ssl:
            server: smtplib.SMTP = smtplib.SMTP_SSL(host, settings.smtp_port, timeout=30)
        else:
            server = smtplib.SMTP(host, settings.smtp_port, timeout=30)
        try:
            server.ehlo()
            if settings.smtp_use_tls and not settings.smtp_use_ssl:
                server.starttls()
                server.ehlo()
            if settings.smtp_username and settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(mail)
        finally:
            server.quit()


class ResendEmailSender:
    """Resend's HTTP API, authenticated with EMAIL_PROVIDER_KEY."""

    async def send(self, message: EmailMessage) -> None:
        payload: dict[str, object] = {
            "from": formataddr((settings.email_from_name, settings.email_from_address)),
            "to": [message.to],
            "subject": message.subject,
            "text": message.text_body,
        }
        if message.html_body:
            payload["html"] = message.html_body
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={"Authorization": f"Bearer {settings.email_provider_key}"},
            )
            response.raise_for_status()


@lru_cache
def get_email_sender() -> EmailSender:
    if settings.email_provider == "console":
        return ConsoleEmailSender()
    if settings.email_provider == "smtp":
        if not settings.smtp_host:
            return NotConfiguredEmailSender("smtp (SMTP_HOST is not set)")
        return SmtpEmailSender()
    if settings.email_provider == "resend":
        if not settings.email_provider_key:
            return NotConfiguredEmailSender("resend (EMAIL_PROVIDER_KEY is not set)")
        return ResendEmailSender()
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


def verification_email(name: str, code: str) -> tuple[str, str]:
    return (
        f"Verify your email for {settings.email_from_name}",
        f"Hi {name},\n\nUse this code to finish creating your account: {code}\n\n"
        f"It expires in {settings.email_verification_code_expire_minutes} minutes.\n\n"
        "If you did not request this, you can ignore this email.\n",
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
    booking_preferences: dict | None = None,
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
        slot = ""
        if booking_preferences:
            slot = "\nThe slot you asked for: " + _describe_slot(booking_preferences) + "\n"
        return (
            f"You passed - {discount_percentage} off your {certification_name} exam "
            f"({reference_code})",
            f"Hi {name},\n\n{scoreline}\n\n"
            f"Your score earns {discount_percentage} off the {certification_name} exam. "
            "The discount is based on your result: the pass mark earns the minimum "
            "and a perfect paper the maximum.\n\n"
            f"Our team will contact you within {response_hours} hours to confirm the "
            "discount and schedule your exam on a call, at a date and time that suits "
            f"you.\n{slot}\nYour reference is {reference_code} - quote it when we "
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


def _describe_slot(preferences: dict) -> str:
    """One line for the slot an applicant asked for on the scheduling form."""
    parts: list[str] = []
    if preferences.get("preferred_date"):
        parts.append(str(preferences["preferred_date"]))
    if preferences.get("alternate_date"):
        parts.append(f"or {preferences['alternate_date']}")
    if preferences.get("preferred_time_slot"):
        parts.append(str(preferences["preferred_time_slot"]))
    if preferences.get("timezone"):
        parts.append(f"({preferences['timezone']})")
    if preferences.get("delivery_mode"):
        parts.append(str(preferences["delivery_mode"]).replace("_", " "))
    if preferences.get("city"):
        parts.append(f"near {preferences['city']}")
    return " ".join(parts) or "not specified"


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
    booking_preferences: dict | None = None,
) -> tuple[str, str]:
    """Internal alert: somebody has been promised a callback, with a clock on it."""
    slot = ""
    if booking_preferences:
        slot = f"Slot asked for: {_describe_slot(booking_preferences)}\n"
    return (
        f"Challenge lead: {name} qualified for {certification_name} ({score})",
        f"{name} passed the {certification_name} challenge with {score} and has been "
        f"promised {discount_percentage} off, plus a call within {response_hours} "
        f"hours.\n\n"
        f"Reference: {reference_code}\n"
        f"Email:     {email}\n"
        f"Phone:     {phone}\n"
        f"{slot}\n"
        "Open Admin > Challenge leads to record the outcome of the call.\n",
    )
