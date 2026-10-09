"""Paying for an exam with the discount a challenge paper earned.

The campaign used to end at a promise: pass, and somebody calls you. These
tests cover the part that now takes money, and they concentrate on the places
where a candidate has an incentive to cheat the till:

  * paying for a paper they failed,
  * paying someone else's passed paper,
  * choosing their own price,
  * and being credited without the provider ever confirming the charge.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.core.config import settings
from app.core.security import hash_password
from app.models.campaign import ChallengeAttempt
from app.models.commerce import Payment
from app.models.enums import PaymentStatus, UserRole
from app.models.user import User
from app.services import payments, pricing
from app.services.payments import CheckoutSession, RazorpayPaymentProvider
from tests.conftest import auth_override
from tests.test_challenge import (
    GUEST_EMAIL,
    GUEST_PHONE,
    _answer_key,
    _setup,
    _start_payload,
    _terms,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def _clear_pricing_cache():
    pricing.reset_cache()
    yield
    pricing.reset_cache()


@pytest.fixture
def razorpay(monkeypatch):
    """A configured provider whose orders are recorded rather than sent.

    Returns the list of orders the service asked for, so a test can assert on
    the amount that would have been charged.
    """
    monkeypatch.setattr(settings, "payment_provider", "razorpay")
    monkeypatch.setattr(settings, "payment_provider_key", "rzp_test_key")
    monkeypatch.setattr(settings, "payment_provider_secret", "rzp_test_secret")
    orders: list[dict] = []

    async def _create_checkout(self, *, amount, currency, reference, description):
        orders.append(
            {
                "amount": amount,
                "currency": currency,
                "reference": reference,
                "description": description,
            }
        )
        order_id = f"order_{len(orders)}"
        return CheckoutSession(
            provider="razorpay",
            reference=order_id,
            status=PaymentStatus.PENDING,
            client_secret=order_id,
        )

    monkeypatch.setattr(RazorpayPaymentProvider, "create_checkout", _create_checkout)
    payments.get_payment_provider.cache_clear()
    yield orders
    payments.get_payment_provider.cache_clear()


async def _sit(client, db, certification, *, option: str | None = None) -> tuple[dict, dict]:
    """Sit a paper. `option=None` answers everything correctly."""
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    qids, key = await _answer_key(db, session["attempt_id"])
    result = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/submit",
        json={
            "token": session["token"],
            "answers": [{"question_id": q, "option_key": option or key[q]} for q in qids],
        },
    )
    assert result.status_code == 200, result.text
    return session, result.json()


def _signed(body: dict, secret: str) -> tuple[bytes, str]:
    raw = json.dumps(body).encode()
    return raw, hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


async def _attempt(db, attempt_id: str) -> ChallengeAttempt:
    attempt = await db.scalar(
        select(ChallengeAttempt).where(ChallengeAttempt.id == uuid.UUID(attempt_id))
    )
    assert attempt is not None
    await db.refresh(attempt)
    return attempt


# --- What a result offers ----------------------------------------------------
async def test_a_passed_paper_offers_to_pay_the_discounted_fee(
    client, db_session, razorpay
):
    _, certification = await _setup(db_session)
    session, result = await _sit(client, db_session, certification)

    assert result["passed"] is True
    assert result["can_pay"] is True
    assert result["payment_status"] == "unpaid"

    response = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/checkout",
        json={"token": session["token"]},
    )
    assert response.status_code == 200, response.text
    checkout = response.json()
    # 125.00 less the 65% a perfect paper earns -- the same figure the result
    # screen quoted, recomputed on the server rather than taken from the client.
    assert checkout["amount"] == "43.75"
    assert checkout["order_id"] == "order_1"
    assert checkout["public_key"] == "rzp_test_key"
    assert checkout["prefill_email"] == GUEST_EMAIL
    assert razorpay[0]["amount"] == Decimal("43.75")

    attempt = await _attempt(db_session, session["attempt_id"])
    assert attempt.payment_status == PaymentStatus.PENDING.value

    payment = await db_session.scalar(
        select(Payment).where(Payment.challenge_attempt_id == attempt.id)
    )
    assert payment is not None
    assert payment.status == PaymentStatus.PENDING.value
    assert payment.provider_reference == "order_1"
    # Nothing is paid until the webhook says so.
    assert payment.paid_at is None


async def test_a_failed_paper_has_nothing_to_pay(client, db_session, razorpay):
    _, certification = await _setup(db_session)
    session, result = await _sit(client, db_session, certification, option="b")

    assert result["passed"] is False
    assert result["can_pay"] is False

    response = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/checkout",
        json={"token": session["token"]},
    )
    assert response.status_code == 422
    assert "did not earn a discount" in response.json()["error"]["message"]
    assert razorpay == []


async def test_the_result_says_when_another_sitting_is_allowed(
    client, db_session, razorpay
):
    """The retake button reads this date; it must agree with the start guard."""
    _, certification = await _setup(db_session)
    _, result = await _sit(client, db_session, certification, option="b")
    assert result["retake_available_on"] is not None

    # A campaign with no cooldown allows one straight away, and says so.
    await _terms(db_session, retakeAfterDays=0)
    _, again = await _sit(client, db_session, certification, option="b")
    assert again["retake_available_on"] is None


async def test_nothing_is_payable_without_a_configured_provider(client, db_session):
    """The default provider cannot take money, so no surface offers to."""
    _, certification = await _setup(db_session)
    session, result = await _sit(client, db_session, certification)

    assert result["passed"] is True
    assert result["can_pay"] is False

    response = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/checkout",
        json={"token": session["token"]},
    )
    assert response.status_code == 422
    assert "not available" in response.json()["error"]["message"]


async def test_an_unpriced_exam_cannot_be_paid_for(client, db_session, razorpay):
    _, certification = await _setup(db_session)
    certification.exam_fee_amount = None
    await db_session.commit()
    session, result = await _sit(client, db_session, certification)

    assert result["can_pay"] is False
    response = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/checkout",
        json={"token": session["token"]},
    )
    assert response.status_code == 422
    assert "published fee" in response.json()["error"]["message"]


# --- Who may pay -------------------------------------------------------------
async def test_checkout_rejects_a_wrong_token(client, db_session, razorpay):
    _, certification = await _setup(db_session)
    session, _ = await _sit(client, db_session, certification)

    response = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/checkout",
        json={"token": "f" * len(session["token"])},
    )
    # The same 404 a wrong id gets: the two must not be distinguishable.
    assert response.status_code == 404
    assert razorpay == []


async def test_checkout_rejects_a_signed_in_stranger(client, db_session, razorpay):
    _, certification = await _setup(db_session)
    session, _ = await _sit(client, db_session, certification)

    stranger = User(
        name="Stranger",
        email="someone-else@example.com",
        phone="+15550001111",
        password_hash=hash_password("Passw0rd!"),
        role=UserRole.STUDENT.value,
        is_active=True,
        is_email_verified=True,
    )
    db_session.add(stranger)
    await db_session.commit()
    auth_override(stranger)

    response = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/checkout", json={}
    )
    assert response.status_code == 404
    assert razorpay == []


async def test_the_owner_can_pay_without_the_token_once_signed_in(
    client, db_session, razorpay
):
    """A guest who registers later still owns the paper they sat."""
    _, certification = await _setup(db_session)
    session, _ = await _sit(client, db_session, certification)

    owner = User(
        name="Asha Rao",
        email=GUEST_EMAIL,
        phone=GUEST_PHONE,
        password_hash=hash_password("Passw0rd!"),
        role=UserRole.STUDENT.value,
        is_active=True,
        is_email_verified=True,
    )
    db_session.add(owner)
    await db_session.commit()
    auth_override(owner)

    response = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/checkout", json={}
    )
    assert response.status_code == 200, response.text
    assert response.json()["amount"] == "43.75"


# --- Not charging twice for one exam ----------------------------------------
async def test_reopening_checkout_reuses_the_pending_order(
    client, db_session, razorpay
):
    """An abandoned checkout is reopened, not re-ordered."""
    _, certification = await _setup(db_session)
    session, _ = await _sit(client, db_session, certification)
    url = f"/api/challenge/attempts/{session['attempt_id']}/checkout"

    first = await client.post(url, json={"token": session["token"]})
    second = await client.post(url, json={"token": session["token"]})
    assert first.status_code == second.status_code == 200
    assert first.json()["order_id"] == second.json()["order_id"]
    assert first.json()["payment_id"] == second.json()["payment_id"]

    assert len(razorpay) == 1
    count = await db_session.scalar(
        select(func.count()).select_from(Payment).where(Payment.challenge_attempt_id.is_not(None))
    )
    assert count == 1


async def test_the_webhook_is_what_marks_a_challenge_exam_paid(
    client, db_session, razorpay, monkeypatch
):
    monkeypatch.setattr(settings, "payment_webhook_secret", "shh")
    _, certification = await _setup(db_session)
    session, _ = await _sit(client, db_session, certification)
    url = f"/api/challenge/attempts/{session['attempt_id']}/checkout"
    checkout = (await client.post(url, json={"token": session["token"]})).json()

    # Razorpay's own event shape, matched on the order id stored against the
    # payment -- not on anything the browser reported.
    raw, signature = _signed(
        {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {"id": "pay_1", "order_id": checkout["order_id"]}
                }
            },
        },
        "shh",
    )
    response = await client.post(
        "/api/payments/webhook", content=raw, headers={"X-Payment-Signature": signature}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "challenge_paid"

    attempt = await _attempt(db_session, session["attempt_id"])
    assert attempt.payment_status == PaymentStatus.SUCCESSFUL.value

    payment = await db_session.scalar(
        select(Payment).where(Payment.challenge_attempt_id == attempt.id)
    )
    assert payment is not None
    await db_session.refresh(payment)
    assert payment.status == PaymentStatus.SUCCESSFUL.value
    assert payment.paid_at is not None

    # Replaying the event must not confirm it a second time.
    replay = await client.post(
        "/api/payments/webhook", content=raw, headers={"X-Payment-Signature": signature}
    )
    assert replay.json()["message"] == "already_processed"

    # And a paid exam cannot be paid for again.
    again = await client.post(url, json={"token": session["token"]})
    assert again.status_code == 409


async def test_razorpays_own_signature_header_is_accepted(
    client, db_session, razorpay, monkeypatch
):
    """Razorpay signs with `X-Razorpay-Signature`, not our generic header."""
    monkeypatch.setattr(settings, "payment_webhook_secret", "shh")
    _, certification = await _setup(db_session)
    session, _ = await _sit(client, db_session, certification)
    url = f"/api/challenge/attempts/{session['attempt_id']}/checkout"
    checkout = (await client.post(url, json={"token": session["token"]})).json()

    raw, signature = _signed(
        {
            "event": "payment.captured",
            "payload": {
                "payment": {"entity": {"id": "pay_9", "order_id": checkout["order_id"]}}
            },
        },
        "shh",
    )
    response = await client.post(
        "/api/payments/webhook",
        content=raw,
        headers={"X-Razorpay-Signature": signature},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "challenge_paid"

    attempt = await _attempt(db_session, session["attempt_id"])
    assert attempt.payment_status == PaymentStatus.SUCCESSFUL.value


async def test_an_unsigned_webhook_cannot_mark_a_challenge_exam_paid(
    client, db_session, razorpay, monkeypatch
):
    monkeypatch.setattr(settings, "payment_webhook_secret", "shh")
    _, certification = await _setup(db_session)
    session, _ = await _sit(client, db_session, certification)
    url = f"/api/challenge/attempts/{session['attempt_id']}/checkout"
    checkout = (await client.post(url, json={"token": session["token"]})).json()

    body = json.dumps(
        {
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"order_id": checkout["order_id"]}}},
        }
    ).encode()
    response = await client.post(
        "/api/payments/webhook", content=body, headers={"X-Payment-Signature": "wrong"}
    )
    assert response.status_code == 422

    attempt = await _attempt(db_session, session["attempt_id"])
    assert attempt.payment_status == PaymentStatus.PENDING.value


# --- The learner's own record -----------------------------------------------
async def test_my_attempts_includes_a_paper_sat_before_registering(
    client, db_session, razorpay
):
    _, certification = await _setup(db_session)
    session, _ = await _sit(client, db_session, certification)

    owner = User(
        name="Asha Rao",
        email=GUEST_EMAIL,
        phone=GUEST_PHONE,
        password_hash=hash_password("Passw0rd!"),
        role=UserRole.STUDENT.value,
        is_active=True,
        is_email_verified=True,
    )
    db_session.add(owner)
    await db_session.commit()
    auth_override(owner)

    response = await client.get("/api/challenge/attempts/mine")
    assert response.status_code == 200, response.text
    rows = response.json()
    assert len(rows) == 1
    row = rows[0]
    assert row["id"] == session["attempt_id"]
    assert row["passed"] is True
    assert row["can_pay"] is True
    assert row["rewarded_price"] == "43.75"
    assert row["payment_status"] == "unpaid"
    assert row["certification_url"].endswith(certification.slug)
    assert row["retake_available_on"] is not None


async def test_my_attempts_does_not_leak_somebody_elses_paper(client, db_session):
    _, certification = await _setup(db_session)
    await _sit(client, db_session, certification)

    stranger = User(
        name="Stranger",
        email="someone-else@example.com",
        phone="+15550001111",
        password_hash=hash_password("Passw0rd!"),
        role=UserRole.STUDENT.value,
        is_active=True,
        is_email_verified=True,
    )
    db_session.add(stranger)
    await db_session.commit()
    auth_override(stranger)

    response = await client.get("/api/challenge/attempts/mine")
    assert response.status_code == 200
    assert response.json() == []


async def test_my_attempts_needs_an_account(client, db_session):
    response = await client.get("/api/challenge/attempts/mine")
    assert response.status_code == 401
