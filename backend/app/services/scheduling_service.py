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
from app.models.commerce import Payment
from app.models.enums import PaymentStatus
from app.models.scheduling import ExamBooking
from app.models.user import User
from app.repositories import scheduling_repo
from app.schemas.scheduling import (
    CertificationOption,
    ExamBookingCreate,
    ExamBookingReceipt,
    ExamBookingUpdate,
    ExamCheckout,
)
from app.services import email as email_service
from app.services import pricing
from app.services.payments import get_payment_provider

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
) -> tuple[ExamBooking, str, ExamCheckout | None]:
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

    config = await pricing.load_config(db)
    checkout = await _start_checkout(db, booking, certification, config)
    return booking, certification_url(certification), checkout


async def _start_checkout(
    db: AsyncSession,
    booking: ExamBooking,
    certification: Certification,
    config: pricing.PricingConfig,
) -> ExamCheckout | None:
    """Create a pending payment and a provider order for this booking.

    Returns None when there is nothing to charge -- an unpriced exam, or no
    payment provider configured. The booking still stands in both cases; it is
    simply handled the way it was before payments existed.

    The amount is recomputed here from the certification and the current
    pricing rules. It is never taken from the request, so a tampered client
    cannot choose its own price.
    """
    if settings.payment_provider == "noop":
        return None

    quote = pricing.compute(
        exam_fee_amount=certification.exam_fee_amount,
        currency=certification.exam_fee_currency,
        fee_checked_on=certification.exam_fee_checked_on,
        discount_override=certification.discount_percentage,
        config=config,
    )
    if quote is None or quote.total_price_amount <= 0:
        return None

    # The id is generated up front so the provider can be called before
    # anything is written. A failed checkout then leaves nothing to roll back --
    # and rolling back here would expire the booking that was already committed
    # above, turning a recoverable provider outage into a broken response.
    payment_id = uuid.uuid4()
    description = f"{certification.name} exam booking {booking.reference_code}"
    provider = get_payment_provider()
    try:
        session = await provider.create_checkout(
            amount=quote.total_price_amount,
            currency=quote.currency,
            reference=str(payment_id),
            description=description,
        )
    except Exception:
        # The request is already saved and the applicant has their reference.
        # Losing checkout is recoverable by a follow-up; losing the lead is not.
        logger.exception("Checkout failed for booking %s", booking.reference_code)
        return None

    payment = Payment(
        id=payment_id,
        user_id=booking.user_id,
        exam_booking_id=booking.id,
        amount=quote.total_price_amount,
        currency=quote.currency,
        payment_provider=settings.payment_provider,
        provider_reference=session.reference,
        status=PaymentStatus.PENDING.value,
    )
    db.add(payment)
    booking.payment_status = PaymentStatus.PENDING.value
    await db.commit()
    await db.refresh(payment)

    return ExamCheckout(
        provider=session.provider,
        payment_id=payment.id,
        amount=payment.amount,
        currency=payment.currency,
        order_id=session.client_secret,
        checkout_url=session.checkout_url,
        public_key=settings.payment_provider_key,
        prefill_name=booking.full_name,
        prefill_email=booking.email,
        prefill_contact=booking.phone,
        description=description,
    )


def build_receipt(
    booking: ExamBooking, url: str | None, checkout: ExamCheckout | None = None
) -> ExamBookingReceipt:
    message = (
        "Your request is saved. Complete payment to confirm your booking."
        if checkout
        else "Your exam scheduling request has been received. "
        "Our team will confirm your slot by email."
    )
    return ExamBookingReceipt(
        message=message,
        reference_code=booking.reference_code,
        certification_name=booking.certification_name,
        certification_url=url,
        checkout=checkout,
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
