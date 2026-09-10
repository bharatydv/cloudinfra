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
) -> Message:
    """Signature-verified provider callback. The only path that grants paid access."""
    body = await request.body()
    outcome = await payment_service.handle_webhook(db, body, signature)
    return Message(message=outcome)
