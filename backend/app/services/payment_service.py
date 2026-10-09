"""Payment orchestration.

Flow:  user -> POST /api/payments/create -> provider checkout -> provider
webhook -> POST /api/payments/webhook -> payment marked successful ->
enrollment granted.

The browser never grants access; only the verified webhook does.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.models.campaign import ChallengeAttempt
from app.models.commerce import ExamCoupon, Payment
from app.models.enums import PaymentStatus
from app.models.scheduling import ExamBooking
from app.models.user import User
from app.repositories import course_repo, engagement_repo
from app.schemas.system import ExamCheckout, PaymentIntentResponse
from app.services import email as email_service
from app.services import enrollment_service
from app.services.payments import get_payment_provider

logger = logging.getLogger(__name__)


def payments_enabled() -> bool:
    """Whether an online payment can actually be taken right now.

    The noop provider never collects money -- it exists so the rest of the flow
    works without credentials -- so a surface that would offer a "pay now"
    button asks here first rather than offering one that cannot charge anything.
    """
    if settings.payment_provider == "noop":
        return False
    return bool(settings.payment_provider_key and settings.payment_provider_secret)


async def start_exam_checkout(
    db: AsyncSession,
    *,
    amount: Decimal,
    currency: str,
    description: str,
    payer_name: str,
    payer_email: str,
    payer_phone: str,
    user_id: uuid.UUID | None = None,
    exam_booking_id: uuid.UUID | None = None,
    challenge_attempt_id: uuid.UUID | None = None,
    exam_coupon_id: uuid.UUID | None = None,
    certification_id: uuid.UUID | None = None,
    raise_on_failure: bool = False,
) -> tuple[Payment, ExamCheckout] | None:
    """Create a provider order for an exam fee and the pending payment behind it.

    Shared by the scheduling form and by a passed challenge attempt, so there is
    one implementation of the ordering that matters: the payment id is minted
    before the provider is called, so a provider outage leaves nothing written
    and nothing to roll back. The caller commits, after setting whatever it
    denormalises the status onto.

    Returns None when there is nothing to charge or no provider to charge with.
    `raise_on_failure` is for a surface whose only purpose was to pay -- it wants
    an error it can show, not a silent no-op.
    """
    if not payments_enabled() or amount is None or amount <= 0:
        if raise_on_failure:
            raise ValidationFailedError(
                "Online payment is not available at the moment. Our team will "
                "take payment with you directly."
            )
        return None

    payment_id = uuid.uuid4()
    provider = get_payment_provider()
    try:
        session = await provider.create_checkout(
            amount=amount,
            currency=currency,
            reference=str(payment_id),
            description=description,
        )
    except Exception as exc:
        logger.exception("Checkout could not be started for %s", description)
        if raise_on_failure:
            raise ValidationFailedError(
                "We could not open the payment window. Please try again in a moment."
            ) from exc
        return None

    payment = Payment(
        id=payment_id,
        user_id=user_id,
        exam_booking_id=exam_booking_id,
        challenge_attempt_id=challenge_attempt_id,
        exam_coupon_id=exam_coupon_id,
        certification_id=certification_id,
        amount=amount,
        currency=currency,
        payment_provider=settings.payment_provider,
        provider_reference=session.reference,
        status=PaymentStatus.PENDING.value,
    )
    db.add(payment)

    return payment, ExamCheckout(
        provider=session.provider,
        payment_id=payment_id,
        amount=amount,
        currency=currency,
        order_id=session.client_secret,
        checkout_url=session.checkout_url,
        public_key=settings.payment_provider_key,
        prefill_name=payer_name,
        prefill_email=payer_email,
        prefill_contact=payer_phone,
        description=description,
    )


async def create_checkout(
    db: AsyncSession, user: User, course_id: uuid.UUID
) -> PaymentIntentResponse:
    course = await course_repo.get_by_id(db, course_id)
    if course is None or not course.is_published:
        raise NotFoundError("Course not found.")
    if float(course.price) <= 0:
        raise ValidationFailedError("This course is free -- enroll directly.")

    existing = await engagement_repo.get_enrollment(db, user.id, course.id)
    if existing is not None and existing.status != "cancelled":
        raise ConflictError("You already have access to this course.")

    payment = Payment(
        user_id=user.id,
        course_id=course.id,
        amount=course.price,
        currency=course.currency,
        payment_provider=settings.payment_provider,
        status=PaymentStatus.PENDING.value,
    )
    db.add(payment)
    await db.flush()

    provider = get_payment_provider()
    session = await provider.create_checkout(
        amount=course.price,
        currency=course.currency,
        reference=str(payment.id),
        description=course.title,
    )
    payment.provider_reference = session.reference
    await db.commit()
    await db.refresh(payment)

    return PaymentIntentResponse(
        payment_id=payment.id,
        provider=session.provider,
        status=PaymentStatus(payment.status),
        checkout_url=session.checkout_url,
        client_secret=session.client_secret,
        amount=payment.amount,
        currency=payment.currency,
    )


async def get_payment(
    db: AsyncSession, payment_id: uuid.UUID, user: User
) -> Payment:
    payment = await db.scalar(select(Payment).where(Payment.id == payment_id))
    if payment is None:
        raise NotFoundError("Payment not found.")
    if payment.user_id is None or (payment.user_id != user.id and not user.is_admin):
        raise NotFoundError("Payment not found.")
    return payment


async def handle_webhook(db: AsyncSession, payload: bytes, signature: str | None) -> str:
    provider = get_payment_provider()
    event = provider.verify_webhook(payload, signature)
    result = provider.parse_webhook(event)
    if result is None:
        logger.info("Ignoring unrecognised payment webhook event")
        return "ignored"

    payment = await db.scalar(
        select(Payment).where(Payment.provider_reference == result.reference)
    )
    if payment is None:
        logger.warning("Webhook for unknown payment reference %s", result.reference)
        return "unknown"

    # Idempotent: replayed webhooks must not double-grant access.
    if payment.status == PaymentStatus.SUCCESSFUL.value:
        return "already_processed"

    payment.status = result.status.value
    payment.transaction_id = result.transaction_id or payment.transaction_id
    payment.provider_metadata = result.raw or {}

    # The booking mirrors the payment so the admin queue can filter on it. This
    # webhook is the only writer of either.
    booking = (
        await db.get(ExamBooking, payment.exam_booking_id)
        if payment.exam_booking_id
        else None
    )
    if booking is not None:
        booking.payment_status = result.status.value

    # The same mirroring for a discounted exam fee paid off a passed test.
    attempt = (
        await db.get(ChallengeAttempt, payment.challenge_attempt_id)
        if payment.challenge_attempt_id
        else None
    )
    if attempt is not None:
        attempt.payment_status = result.status.value

    if result.status == PaymentStatus.SUCCESSFUL:
        payment.paid_at = datetime.now(UTC)
        if payment.course_id and payment.user_id:
            await enrollment_service.grant_enrollment(db, payment.user_id, payment.course_id)

        # A code counts as redeemed when the money lands, not when it is typed:
        # a visitor may check a code as often as they like without spending it.
        coupon = (
            await db.get(ExamCoupon, payment.exam_coupon_id)
            if payment.exam_coupon_id
            else None
        )
        if coupon is not None:
            coupon.redemption_count += 1

        await db.commit()

        amount = f"{payment.amount} {payment.currency}"
        if booking is not None:
            # Booking payments are open to guests, so the receipt goes to the
            # address on the booking rather than to an account.
            subject, body = email_service.exam_payment_confirmation_email(
                booking.full_name, booking.certification_name, amount, booking.reference_code
            )
            await email_service.send_email(
                booking.email, subject, body, sender=email_service.contact_sender()
            )
            return "booking_paid"

        if attempt is not None:
            # A challenge sitting is open to guests too, so the receipt follows
            # the address that sat the paper.
            subject, body = email_service.exam_payment_confirmation_email(
                attempt.full_name, attempt.certification_name, amount, attempt.reference_code
            )
            await email_service.send_email(
                attempt.email, subject, body, sender=email_service.contact_sender()
            )
            return "challenge_paid"

        user = await db.get(User, payment.user_id) if payment.user_id else None
        course = await course_repo.get_by_id(db, payment.course_id) if payment.course_id else None
        if user and course:
            subject, body = email_service.payment_confirmation_email(
                user.name, course.title, amount
            )
            await email_service.send_email(user.email, subject, body)
        return "granted"

    await db.commit()
    return result.status.value
