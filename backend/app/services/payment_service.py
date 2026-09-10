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

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.models.commerce import Payment
from app.models.enums import PaymentStatus
from app.models.user import User
from app.repositories import course_repo, engagement_repo
from app.schemas.system import PaymentIntentResponse
from app.services import email as email_service
from app.services import enrollment_service
from app.services.payments import get_payment_provider

logger = logging.getLogger(__name__)


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
    if payment.user_id != user.id and not user.is_admin:
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

    if result.status == PaymentStatus.SUCCESSFUL:
        payment.paid_at = datetime.now(UTC)
        if payment.course_id:
            await enrollment_service.grant_enrollment(db, payment.user_id, payment.course_id)
        await db.commit()

        user = await db.get(User, payment.user_id)
        course = await course_repo.get_by_id(db, payment.course_id) if payment.course_id else None
        if user and course:
            subject, body = email_service.payment_confirmation_email(
                user.name, course.title, f"{payment.amount} {payment.currency}"
            )
            await email_service.send_email(user.email, subject, body)
        return "granted"

    await db.commit()
    return result.status.value
