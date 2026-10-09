from __future__ import annotations

import uuid

from fastapi import APIRouter, Header, Request, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.common import Message
from app.schemas.system import PaymentCreate, PaymentIntentResponse, PaymentRead
from app.services import payment_service

router = APIRouter(tags=["Payments"])


@router.post(
    "/payments/create",
    response_model=PaymentIntentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment(
    payload: PaymentCreate, user: CurrentUser, db: DbSession
) -> PaymentIntentResponse:
    """Start checkout.

    Returns a pending payment plus the provider redirect. Access is granted only
    after the provider webhook confirms the charge server-side.
    """
    return await payment_service.create_checkout(db, user, payload.course_id)


@router.get("/payments/{payment_id}", response_model=PaymentRead)
async def get_payment(
    payment_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> PaymentRead:
    payment = await payment_service.get_payment(db, payment_id, user)
    return PaymentRead.model_validate(payment)


@router.post("/payments/webhook", response_model=Message, include_in_schema=False)
async def payment_webhook(
    request: Request,
    db: DbSession,
    signature: str | None = Header(default=None, alias="X-Payment-Signature"),
    razorpay_signature: str | None = Header(default=None, alias="X-Razorpay-Signature"),
) -> Message:
    """Signature-verified provider callback. The only path that grants paid access.

    Razorpay sends its HMAC in `X-Razorpay-Signature`; the generic header is
    what the noop provider and our own tests use. Both carry the same thing --
    a hex SHA-256 HMAC of the raw body under the webhook secret -- so either is
    accepted and the verification itself is unchanged. Without this a real
    Razorpay callback would be rejected, money would be taken and nothing would
    ever be marked paid.
    """
    body = await request.body()
    outcome = await payment_service.handle_webhook(
        db, body, signature or razorpay_signature
    )
    return Message(message=outcome)
