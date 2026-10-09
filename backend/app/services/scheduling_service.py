"""Exam scheduling requests submitted from the public site."""

from __future__ import annotations

import logging
import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.errors import NotFoundError, ValidationFailedError
from app.models.certification import Certification
from app.models.scheduling import ExamBooking
from app.models.user import User
from app.repositories import scheduling_repo
from app.schemas.scheduling import (
    CertificationOption,
    ExamBookingCreate,
    ExamBookingReceipt,
    ExamBookingUpdate,
)
from app.services import challenge_service, pricing
from app.services import email as email_service

# No vowels and no 0/1/I/O: a code is read out over the phone as often as it is
# copied, so ambiguous glyphs cost support time.
logger = logging.getLogger(__name__)

_CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY2345679"


async def _unique_reference_code(db: AsyncSession) -> str:
    for _ in range(5):
        code = "EX-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
        if not await scheduling_repo.reference_code_exists(db, code):
            return code
    # 28^6 keyspace; five straight collisions means something is wrong upstream.
    raise ValidationFailedError("Could not allocate a reference code. Please try again.")


def certification_url(certification: Certification) -> str:
    return f"/certifications/{certification.provider.slug}/{certification.slug}"


async def list_options(db: AsyncSession) -> list[CertificationOption]:
    """Published certifications, for the scheduling form's picker.

    When the campaign names specific certifications, only those are offered:
    the scheduling form and the discount test are two doors into the same
    offer, so they must agree on which exams it covers.
    """
    config = await pricing.load_config(db)
    campaign = await challenge_service.load_config(db)
    rows = list(
        await db.scalars(
            select(Certification)
            .options(selectinload(Certification.provider))
            .where(Certification.is_published.is_(True))
            .order_by(Certification.name)
        )
    )
    if campaign.certification_slugs:
        by_slug = {row.slug: row for row in rows if row.slug in campaign.certification_slugs}
        rows = [by_slug[slug] for slug in campaign.certification_slugs if slug in by_slug]
    return [
        CertificationOption(
            id=row.id,
            name=row.name,
            exam_code=row.exam_code,
            provider_name=row.provider.name,
            url=certification_url(row),
            pricing=pricing.compute(
                exam_fee_amount=row.exam_fee_amount,
                currency=row.exam_fee_currency,
                fee_checked_on=row.exam_fee_checked_on,
                discount_override=row.discount_percentage,
                config=config,
            ),
        )
        for row in rows
    ]


async def submit(
    db: AsyncSession,
    payload: ExamBookingCreate,
    *,
    user: User | None = None,
    source_ip: str | None = None,
) -> tuple[ExamBooking, str]:
    """Record a scheduling request. Takes no money, by design.

    The discounted fee is a reward, not a list price: it is payable only by
    someone who earned it, through a passed challenge paper or a coupon code.
    This form is open to anyone, so charging the discounted total here handed
    the discount to every visitor who asked and made both routes pointless.
    The request is a lead; the team confirms the slot and the price.
    """
    if payload.website:
        # Honeypot tripped -- almost certainly a bot.
        raise ValidationFailedError("Your request could not be submitted.")

    certification = await db.scalar(
        select(Certification)
        .options(selectinload(Certification.provider))
        .where(Certification.id == payload.certification_id)
    )
    if certification is None or not certification.is_published:
        raise NotFoundError("That certification is not available for scheduling.")

    booking = ExamBooking(
        user_id=user.id if user else None,
        full_name=payload.full_name.strip(),
        email=str(payload.email).strip().lower(),
        phone=payload.phone.strip(),
        country=payload.country.strip(),
        city=payload.city.strip() if payload.city else None,
        certification_id=certification.id,
        certification_name=certification.name,
        exam_code=certification.exam_code,
        preferred_date=payload.preferred_date,
        alternate_date=payload.alternate_date,
        preferred_time_slot=payload.preferred_time_slot,
        timezone=payload.timezone.strip(),
        delivery_mode=payload.delivery_mode.value,
        reference_code=await _unique_reference_code(db),
        source_ip=source_ip,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    campaign = await challenge_service.load_config(db)
    await _send_request_emails(booking, campaign.response_hours)

    return booking, certification_url(certification)


async def _send_request_emails(booking: ExamBooking, response_hours: int) -> None:
    """Receipt to the applicant, and an alert to the team promised to call.

    The request is already committed, so a mail provider outage is logged
    rather than turned into an error on the form.
    """
    try:
        subject, body, html = email_service.exam_booking_email(
            name=booking.full_name,
            certification_name=booking.certification_name,
            exam_code=booking.exam_code,
            reference_code=booking.reference_code,
            preferred_date=booking.preferred_date.isoformat(),
            alternate_date=(
                booking.alternate_date.isoformat() if booking.alternate_date else None
            ),
            preferred_time_slot=booking.preferred_time_slot,
            timezone=booking.timezone,
            delivery_mode=booking.delivery_mode,
            city=booking.city,
            country=booking.country,
            response_hours=response_hours,
        )
        await email_service.send_email(
            booking.email, subject, body, html=html, sender=email_service.contact_sender()
        )
    except Exception:
        logger.exception("Could not email the exam request receipt for %s", booking.reference_code)

    if not settings.sales_notification_email:
        return
    try:
        subject, body = email_service.exam_booking_alert_email(
            name=booking.full_name,
            email=booking.email,
            phone=booking.phone,
            certification_name=booking.certification_name,
            reference_code=booking.reference_code,
            preferred_date=booking.preferred_date.isoformat(),
            response_hours=response_hours,
        )
        await email_service.send_email(
            settings.sales_notification_email,
            subject,
            body,
            sender=email_service.contact_sender(),
        )
    except Exception:
        logger.exception("Could not notify the team about exam request %s", booking.reference_code)


def build_receipt(booking: ExamBooking, url: str | None) -> ExamBookingReceipt:
    message = (
        "Your exam scheduling request has been received. "
        "Our team will confirm your slot by email."
    )
    return ExamBookingReceipt(
        message=message,
        reference_code=booking.reference_code,
        certification_name=booking.certification_name,
        certification_url=url,
    )


async def update_booking(
    db: AsyncSession, booking_id: uuid.UUID, payload: ExamBookingUpdate
) -> ExamBooking:
    booking = await scheduling_repo.get_booking(db, booking_id)
    if booking is None:
        raise NotFoundError("Exam request not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(booking, field, value.value if hasattr(value, "value") else value)
    await db.commit()
    await db.refresh(booking)
    return booking


async def delete_booking(db: AsyncSession, booking_id: uuid.UUID) -> None:
    booking = await scheduling_repo.get_booking(db, booking_id)
    if booking is None:
        raise NotFoundError("Exam request not found.")
    await db.delete(booking)
    await db.commit()
