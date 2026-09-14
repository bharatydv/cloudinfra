"""Exam scheduling requests submitted from the public site."""

from __future__ import annotations

import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
from app.services import email as email_service
from app.services import pricing

# No vowels and no 0/1/I/O: a code is read out over the phone as often as it is
# copied, so ambiguous glyphs cost support time.
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
    """Published certifications, for the scheduling form's picker."""
    config = await pricing.load_config(db)
    rows = await db.scalars(
        select(Certification)
        .options(selectinload(Certification.provider))
        .where(Certification.is_published.is_(True))
        .order_by(Certification.name)
    )
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

    subject, body = email_service.exam_booking_email(
        booking.full_name,
        booking.certification_name,
        booking.reference_code,
        booking.preferred_date.isoformat(),
    )
    await email_service.send_email(booking.email, subject, body)

    return booking, certification_url(certification)


def build_receipt(booking: ExamBooking, url: str | None) -> ExamBookingReceipt:
    return ExamBookingReceipt(
        message=(
            "Your exam scheduling request has been received. "
            "Our team will confirm your slot by email."
        ),
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
