"""Provider-agnostic transactional email.

Business logic depends on `EmailSender`, never on a vendor SDK. Swap providers
by changing EMAIL_PROVIDER; no call site changes.
"""

from __future__ import annotations

import asyncio
import html as html_lib
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
    # Envelope sender; defaults to EMAIL_FROM_ADDRESS when unset.
    from_address: str | None = None

    @property
    def sender(self) -> str:
        return formataddr(
            (settings.email_from_name, self.from_address or settings.email_from_address)
        )


def contact_sender() -> str:
    """The address for mail a human follows up on (results, exam scheduling)."""
    return settings.email_contact_address or settings.email_from_address


class EmailSender(Protocol):
    async def send(self, message: EmailMessage) -> None: ...


class ConsoleEmailSender:
    """Development default: logs instead of sending."""

    async def send(self, message: EmailMessage) -> None:
        logger.info(
            "[email:console] from=%s to=%s subject=%s\n%s",
            message.sender,
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
        mail["From"] = message.sender
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
            "from": message.sender,
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


async def send_email(
    to: str,
    subject: str,
    body: str,
    html: str | None = None,
    *,
    sender: str | None = None,
) -> None:
    await get_email_sender().send(
        EmailMessage(
            to=to, subject=subject, text_body=body, html_body=html, from_address=sender
        )
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


def contact_code_email(code: str) -> tuple[str, str]:
    return (
        f"Your {settings.email_from_name} verification code",
        f"Your verification code is {code}\n\n"
        f"It expires in {settings.contact_verification_code_expire_minutes} minutes.\n\n"
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
    *,
    name: str,
    certification_name: str,
    exam_code: str | None,
    reference_code: str,
    preferred_date: str,
    alternate_date: str | None,
    preferred_time_slot: str | None,
    timezone: str,
    delivery_mode: str,
    city: str | None,
    country: str,
    response_hours: int,
) -> tuple[str, str, str]:
    """The applicant's receipt for a scheduling request, as (subject, text, html).

    Nothing is booked yet: the request goes to the team, who call back to
    confirm a slot with the certification provider.
    """
    subject = f"We received your {certification_name} exam request ({reference_code})"
    where = ", ".join(part for part in (city, country) if part)
    details: list[tuple[str, str]] = [("Reference", reference_code)]
    if exam_code:
        details.append(("Exam code", exam_code))
    details.append(("Preferred date", preferred_date))
    if alternate_date:
        details.append(("Alternate date", alternate_date))
    if preferred_time_slot:
        details.append(("Preferred time", preferred_time_slot))
    details.append(("Time zone", timezone))
    details.append(("Delivery", delivery_mode.replace("_", " ")))
    if where:
        details.append(("Location", where))

    intro = (
        f"Thanks for asking us to schedule your {certification_name} exam. "
        "Here is what you sent us."
    )
    next_step = (
        f"Our team will contact you within {response_hours} hours to confirm your "
        "slot and walk you through the next steps."
    )
    seats_note = (
        "Seats are booked with the certification provider, so the final date and "
        "time depend on their availability. Your preferred dates are a request, not "
        "yet a confirmed booking."
    )
    keep_note = f"Please keep your reference {reference_code} handy and quote it when we speak."

    width = max(len(label) for label, _ in details) + 2
    lines = [f"Hi {name},", "", intro, ""]
    lines += [f"{label + ':':<{width}} {value}" for label, value in details]
    lines += ["", "What happens next", next_step, keep_note, "", seats_note]
    lines += ["", f"The {settings.email_from_name} team", settings.public_site_url, ""]
    text = "\n".join(lines)

    e = html_lib.escape
    rows = "".join(
        f'<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">{e(label)}</td>'
        f'<td style="padding:6px 0;text-align:right;color:#0f172a;font-size:14px;'
        f'font-weight:600;">{e(value)}</td></tr>'
        for label, value in details
    )
    body_html = (
        _p(f"Hi {e(name)},")
        + _p(e(intro))
        + f'''
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:24px 0;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
  <tr><td style="padding:24px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4f46e5;">Exam request received</div>
    <div style="font-size:24px;font-weight:800;line-height:1.2;color:#0f172a;margin:6px 0 14px;">{e(certification_name)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border-top:1px solid #e2e8f0;padding-top:8px;">{rows}</table>
  </td></tr>
</table>
'''
        + _next_step_box(next_step)
        + _p(
            f"Please keep your reference <strong>{e(reference_code)}</strong> handy and "
            "quote it when we speak."
        )
        + _p(e(seats_note), muted=True)
    )
    return subject, text, _html_frame(
        subject, body_html, reason="you asked us to schedule an exam"
    )


def exam_booking_alert_email(
    *,
    name: str,
    email: str,
    phone: str,
    certification_name: str,
    reference_code: str,
    preferred_date: str,
    response_hours: int,
) -> tuple[str, str]:
    """Internal alert: an exam request has been promised a callback."""
    return (
        f"Exam request: {name} for {certification_name} on {preferred_date}",
        f"{name} asked to schedule the {certification_name} exam for {preferred_date} "
        f"and has been promised a call within {response_hours} hours.\n\n"
        f"Reference: {reference_code}\n"
        f"Email:     {email}\n"
        f"Phone:     {phone}\n\n"
        "Open Admin > Exam requests to confirm the slot and record the outcome.\n",
    )


def _next_step_box(text: str, *, accent: str = "#4f46e5") -> str:
    return f'''
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:20px 0;border-left:4px solid {accent};background:#eef2ff;border-radius:0 10px 10px 0;">
  <tr><td style="padding:16px 18px;">
    <div style="font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#3730a3;margin-bottom:6px;">What happens next</div>
    <div style="font-size:15px;line-height:1.6;color:#1e1b4b;">{html_lib.escape(text)}</div>
  </td></tr>
</table>
'''


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
    pass_mark: str,
    correct_count: int,
    question_count: int,
    passed: bool,
    timed_out: bool = False,
    discount_percentage: str | None,
    response_hours: int,
    retake_after_days: int,
    warnings: int,
    booking_preferences: dict | None = None,
) -> tuple[str, str, str]:
    """The candidate's copy of their result, as (subject, text, html).

    The score is restated here because the result page is not addressable
    later -- this email is the only durable record the candidate keeps.
    Everyone who sits the paper is promised a call, pass or fail: the
    conversation is the point of the campaign, and the score just sets its
    starting point.
    """
    rewarded = passed and bool(discount_percentage)
    slot = _describe_slot(booking_preferences) if booking_preferences else None

    if rewarded:
        subject = (
            f"You passed with {score}: {discount_percentage} off your "
            f"{certification_name} exam ({reference_code})"
        )
        verdict = f"Congratulations, you passed with {score}."
        outcome = (
            f"Your score earns {discount_percentage} off the {certification_name} exam. "
            "The discount is based on your result: the pass mark earns the minimum "
            "and a perfect paper earns the maximum."
        )
        next_step = (
            f"Our team will contact you within {response_hours} hours to confirm your "
            "discount and book your exam on a call, at a date and time that suits you."
        )
    elif timed_out:
        subject = f"Your {certification_name} test result: {score} ({reference_code})"
        verdict = f"You scored {score}, but the paper was submitted after the time limit."
        outcome = (
            "Because the time ran out, the exam discount was not applied this time. "
            f"You can take the test again after {retake_after_days} days."
        )
        next_step = (
            f"Our team will contact you within {response_hours} hours to go through "
            "your result and help you plan the next step."
        )
    else:
        subject = f"Your {certification_name} test result: {score} ({reference_code})"
        verdict = f"You scored {score}. The pass mark is {pass_mark}."
        outcome = (
            "This time your score is below the mark needed for the exam discount. "
            "Your result page listed the correct answer and an explanation for every "
            "question, which is the fastest way to see what to revise. You can take "
            f"the test again after {retake_after_days} days."
        )
        next_step = (
            f"Our team will contact you within {response_hours} hours to go through "
            "your result and help you plan the next step."
        )

    warning_note = (
        f"Recorded during your test: {warnings} warning(s) for leaving the test "
        "window or attempting to copy text."
        if warnings
        else None
    )
    seats_note = (
        "Seats are booked with the certification provider, so the final date and "
        "time depend on their availability."
        if rewarded
        else None
    )

    # --- Plain text ---------------------------------------------------------
    lines = [
        f"Hi {name},",
        "",
        f"Thanks for taking the {certification_name} challenge. Here is your result.",
        "",
        verdict,
        "",
        f"Score:          {score}",
        f"Correct:        {correct_count} of {question_count}",
        f"Pass mark:      {pass_mark}",
        f"Reference:      {reference_code}",
    ]
    if discount_percentage and rewarded:
        lines.append(f"Discount earned: {discount_percentage}")
    lines += ["", outcome, "", "What happens next", next_step]
    if slot:
        lines.append(f"The slot you asked for: {slot}.")
    lines.append(f"Please keep your reference {reference_code} handy and quote it when we speak.")
    if warning_note:
        lines += ["", warning_note]
    if seats_note:
        lines += ["", seats_note]
    lines += ["", f"The {settings.email_from_name} team", settings.public_site_url, ""]
    text = "\n".join(lines)

    # --- HTML ---------------------------------------------------------------
    e = html_lib.escape
    stats = [
        ("Correct answers", f"{correct_count} of {question_count}"),
        ("Pass mark", pass_mark),
        ("Reference", reference_code),
    ]
    if discount_percentage and rewarded:
        stats.insert(0, ("Discount earned", discount_percentage))
    stat_rows = "".join(
        f'<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">{e(label)}</td>'
        f'<td style="padding:6px 0;text-align:right;color:#0f172a;font-size:14px;'
        f'font-weight:600;">{e(value)}</td></tr>'
        for label, value in stats
    )
    accent = "#16a34a" if rewarded else "#4f46e5"
    badge = "Passed" if rewarded else ("Time ran out" if timed_out else "Not passed")

    extras = ""
    if slot:
        extras += _p(f"<strong>The slot you asked for:</strong> {e(slot)}.")
    extras += _p(
        f"Please keep your reference <strong>{e(reference_code)}</strong> handy and "
        "quote it when we speak."
    )
    if warning_note:
        extras += _p(e(warning_note), muted=True)
    if seats_note:
        extras += _p(e(seats_note), muted=True)

    body_html = (
        _p(f"Hi {e(name)},")
        + _p(f"Thanks for taking the {e(certification_name)} challenge. Here is your result.")
        + f'''
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:24px 0;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
  <tr><td style="padding:24px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:{accent};">{e(badge)}</div>
    <div style="font-size:44px;font-weight:800;line-height:1.1;color:#0f172a;margin:6px 0 2px;">{e(score)}</div>
    <div style="font-size:14px;color:#475569;margin-bottom:14px;">{e(certification_name)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border-top:1px solid #e2e8f0;padding-top:8px;">{stat_rows}</table>
  </td></tr>
</table>
'''
        + _p(e(outcome))
        + _next_step_box(next_step, accent=accent)
        + extras
    )
    html = _html_frame(subject, body_html)
    return subject, text, html


def _p(inner: str, *, muted: bool = False) -> str:
    color = "#64748b" if muted else "#1e293b"
    size = "13px" if muted else "15px"
    return f'<p style="margin:0 0 14px;font-size:{size};line-height:1.6;color:{color};">{inner}</p>\n'


def _html_frame(
    title: str, body: str, *, reason: str = "you took a certification challenge"
) -> str:
    """A single-column, inline-styled shell that renders the same everywhere.

    `reason` finishes the footer's "You are receiving this because ..." line.
    """
    e = html_lib.escape
    brand = e(settings.email_from_name)
    site = e(settings.public_site_url)
    why = e(reason)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#4f46e5;padding:20px 28px;">
        <a href="{site}" style="color:#ffffff;font-size:20px;font-weight:800;text-decoration:none;letter-spacing:-.01em;">{brand}</a>
      </td></tr>
      <tr><td style="padding:28px;">
{body}
        <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#1e293b;">The {brand} team</p>
      </td></tr>
      <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">You are receiving this because {why} at <a href="{site}" style="color:#4f46e5;text-decoration:none;">{site}</a>.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
'''


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
    passed: bool,
    discount_percentage: str | None,
    reference_code: str,
    response_hours: int,
    booking_preferences: dict | None = None,
) -> tuple[str, str]:
    """Internal alert: somebody has been promised a callback, with a clock on it."""
    slot = ""
    if booking_preferences:
        slot = f"Slot asked for: {_describe_slot(booking_preferences)}\n"
    if passed and discount_percentage:
        subject = f"Challenge lead: {name} qualified for {certification_name} ({score})"
        summary = (
            f"{name} passed the {certification_name} challenge with {score} and has been "
            f"promised {discount_percentage} off, plus a call within {response_hours} "
            "hours."
        )
    else:
        subject = f"Challenge lead: {name} sat {certification_name} ({score}, not passed)"
        summary = (
            f"{name} took the {certification_name} challenge and scored {score}, below "
            f"the pass mark. No discount was earned, but they were promised a call "
            f"within {response_hours} hours to talk through the result."
        )
    return (
        subject,
        f"{summary}\n\n"
        f"Reference: {reference_code}\n"
        f"Email:     {email}\n"
        f"Phone:     {phone}\n"
        f"{slot}\n"
        "Open Admin > Challenge leads to record the outcome of the call.\n",
    )
