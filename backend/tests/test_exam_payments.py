from __future__ import annotations

import hashlib
import hmac
import json
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import get_current_user, get_optional_user
from app.models.commerce import Payment
from app.models.enums import PaymentStatus
from app.models.scheduling import ExamBooking
from app.services import pricing
from app.services.payments import RazorpayPaymentProvider, to_minor_units
from tests.conftest import auth_override
from tests.factories import make_certification, make_provider
from tests.test_exam_scheduling import _payload

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def _clear_pricing_cache():
    pricing.reset_cache()
    yield
    pricing.reset_cache()


# --- Amount conversion ------------------------------------------------------
@pytest.mark.parametrize(
    ("amount", "currency", "expected"),
    [
        ("118.00", "USD", 11800),
        ("99.99", "USD", 9999),
        # 79.20 in float arithmetic is 79.19999...; Decimal must not truncate it.
        ("79.20", "USD", 7920),
        ("0.01", "INR", 1),
        ("1500", "JPY", 1500),  # zero-decimal currency is not multiplied
        ("93.455", "USD", 9346),  # half-up, not banker's rounding
    ],
)
def test_minor_units_conversion(amount, currency, expected):
    assert to_minor_units(Decimal(amount), currency) == expected


# --- Webhook parsing --------------------------------------------------------
def _signed(body: dict, secret: str) -> tuple[bytes, str]:
    raw = json.dumps(body).encode()
    return raw, hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


def test_webhook_signature_must_match(monkeypatch):
    monkeypatch.setattr(settings, "payment_webhook_secret", "shh")
    provider = RazorpayPaymentProvider()
    raw, signature = _signed({"event": "payment.captured"}, "shh")

    assert provider.verify_webhook(raw, signature)["event"] == "payment.captured"

    from app.core.errors import ValidationFailedError

    with pytest.raises(ValidationFailedError):
        provider.verify_webhook(raw, "deadbeef")
    with pytest.raises(ValidationFailedError):
        provider.verify_webhook(raw, None)
    # A body edited after signing must not verify.
    with pytest.raises(ValidationFailedError):
        provider.verify_webhook(raw + b" ", signature)


@pytest.mark.parametrize(
    ("event", "expected"),
    [
        ("payment.captured", PaymentStatus.SUCCESSFUL),
        ("order.paid", PaymentStatus.SUCCESSFUL),
        ("payment.failed", PaymentStatus.FAILED),
        ("refund.processed", PaymentStatus.REFUNDED),
    ],
)
def test_known_events_map_to_a_status(event, expected):
    result = RazorpayPaymentProvider().parse_webhook(
        {
            "event": event,
            "payload": {"payment": {"entity": {"id": "pay_1", "order_id": "order_1"}}},
        }
    )
    assert result is not None
    assert result.status is expected
    assert result.reference == "order_1"
    assert result.transaction_id == "pay_1"


def test_authorized_but_uncaptured_is_not_treated_as_paid():
    """Authorized is money held, not money taken."""
    assert (
        RazorpayPaymentProvider().parse_webhook(
            {
                "event": "payment.authorized",
                "payload": {"payment": {"entity": {"id": "p", "order_id": "o"}}},
            }
        )
        is None
    )


def test_event_without_an_order_is_ignored():
    assert (
        RazorpayPaymentProvider().parse_webhook(
            {"event": "payment.captured", "payload": {"payment": {"entity": {"id": "p"}}}}
        )
        is None
    )


# --- End to end -------------------------------------------------------------
async def _book(client: AsyncClient, db_session, admin, **pricing_setting) -> dict:
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider, exam_fee="100.00")
    auth_override(admin)
    await client.put(
        "/api/admin/settings/pricing",
        json={"value": pricing_setting or {"discountPercentage": 20}, "is_public": True},
    )
    # Book as a guest: the admin identity was only needed to save the setting.
    from app.main import app

    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_optional_user, None)
    response = await client.post(
        "/api/exam-bookings", json=_payload(str(certification.id))
    )
    assert response.status_code == 201
    return response.json()


async def test_no_checkout_when_payments_are_off(client: AsyncClient, db_session, admin):
    """The default provider is noop, so the flow stays exactly as it was."""
    receipt = await _book(client, db_session, admin)
    assert receipt["checkout"] is None


async def test_booking_survives_a_failing_provider(
    client: AsyncClient, db_session, admin, monkeypatch
):
    """A checkout failure must never cost the lead."""
    monkeypatch.setattr(settings, "payment_provider", "razorpay")
    monkeypatch.setattr(settings, "payment_provider_key", None)  # forces a failure
    from app.services import payments

    payments.get_payment_provider.cache_clear()

    receipt = await _book(client, db_session, admin)
    assert receipt["checkout"] is None
    assert receipt["reference_code"]

    booking = await db_session.scalar(
        select(ExamBooking).where(ExamBooking.reference_code == receipt["reference_code"])
    )
    assert booking is not None
    assert booking.payment_status == "unpaid"
    payments.get_payment_provider.cache_clear()


async def test_webhook_is_the_only_thing_that_marks_a_booking_paid(
    client: AsyncClient, db_session, admin, monkeypatch
):
    monkeypatch.setattr(settings, "payment_webhook_secret", "shh")
    monkeypatch.setattr(settings, "payment_provider", "noop")
    from app.services import payments

    payments.get_payment_provider.cache_clear()

    receipt = await _book(client, db_session, admin)
    booking = await db_session.scalar(
        select(ExamBooking).where(ExamBooking.reference_code == receipt["reference_code"])
    )
    assert booking is not None

    # A guest payment: no user, linked to the booking instead.
    payment = Payment(
        user_id=None,
        exam_booking_id=booking.id,
        amount=Decimal("80.00"),
        currency="USD",
        payment_provider="noop",
        provider_reference="order_test_1",
        status=PaymentStatus.PENDING.value,
    )
    db_session.add(payment)
    booking.payment_status = PaymentStatus.PENDING.value
    await db_session.commit()

    raw, signature = _signed(
        {"reference": "order_test_1", "status": "successful", "transaction_id": "pay_1"},
        "shh",
    )
    response = await client.post(
        "/api/payments/webhook", content=raw, headers={"X-Payment-Signature": signature}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "booking_paid"

    await db_session.refresh(booking)
    await db_session.refresh(payment)
    assert booking.payment_status == PaymentStatus.SUCCESSFUL.value
    assert payment.status == PaymentStatus.SUCCESSFUL.value
    assert payment.paid_at is not None

    # Replay must be a no-op, not a second confirmation.
    replay = await client.post(
        "/api/payments/webhook", content=raw, headers={"X-Payment-Signature": signature}
    )
    assert replay.json()["message"] == "already_processed"
    payments.get_payment_provider.cache_clear()


async def test_unsigned_webhook_cannot_mark_anything_paid(
    client: AsyncClient, db_session, monkeypatch
):
    monkeypatch.setattr(settings, "payment_webhook_secret", "shh")
    body = json.dumps({"reference": "order_x", "status": "successful"}).encode()

    response = await client.post(
        "/api/payments/webhook", content=body, headers={"X-Payment-Signature": "wrong"}
    )
    assert response.status_code == 422
