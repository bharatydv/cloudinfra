"""Paying for an exam with a coupon code.

The code is the only thing standing between a visitor and a discounted price,
and this route asks for no contact details, so these tests concentrate on the
places that matters:

  * a code cannot be worth more than the price the catalogue advertises,
  * checking a code does not spend it, and spending it needs the provider,
  * a code scoped to one exam cannot be carried to another,
  * and a refusal never tells the guesser which kind of refusal it was.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.commerce import ExamCoupon, Payment
from app.models.enums import PaymentStatus
from app.services import pricing
from tests.conftest import auth_override
from tests.factories import make_certification, make_provider
from tests.test_challenge_payments import razorpay  # noqa: F401 -- fixture

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def _clear_pricing_cache():
    pricing.reset_cache()
    yield
    pricing.reset_cache()


async def _exam(db, *, discount: str | None = "65.00", fee: str | None = "99.00"):
    """A published exam advertised at a discount, as the catalogue shows it."""
    provider = await make_provider(db, name="Google Cloud")
    return await make_certification(
        db,
        provider,
        name="Cloud Digital Leader",
        exam_fee=fee,
        discount_percentage=discount,
    )


async def _coupon(db, certification=None, **overrides) -> ExamCoupon:
    values = {
        "code": "LAUNCH50",
        "certification_id": certification.id if certification else None,
        "is_active": True,
    }
    values.update(overrides)
    coupon = ExamCoupon(**values)
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return coupon


def _signed(body: dict, secret: str) -> tuple[bytes, str]:
    raw = json.dumps(body).encode()
    return raw, hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


# --- What a code is worth -----------------------------------------------------
async def test_a_code_unlocks_the_advertised_price_and_nothing_better(
    client, db_session
):
    """The whole point: a code is a key, not a second discount."""
    certification = await _exam(db_session)
    await _coupon(db_session, certification)

    response = await client.post(
        "/api/exam-coupons/redeem",
        json={"code": "LAUNCH50", "certification_id": str(certification.id)},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    # 99.00 less the catalogue's 65%. Not 34.65 less anything again.
    assert body["pricing"]["total_price_amount"] == "34.65"
    assert body["amount_payable"] == "34.65"
    assert body["certification_name"] == "Cloud Digital Leader"


async def test_a_code_is_matched_however_it_is_typed(client, db_session):
    certification = await _exam(db_session)
    await _coupon(db_session, certification)

    response = await client.post(
        "/api/exam-coupons/redeem",
        json={"code": "  launch50  ", "certification_id": str(certification.id)},
    )
    assert response.status_code == 200, response.text
    assert response.json()["code"] == "LAUNCH50"


async def test_a_code_with_no_certification_works_on_any_exam(client, db_session):
    certification = await _exam(db_session)
    await _coupon(db_session, None, code="ANYEXAM")

    response = await client.post(
        "/api/exam-coupons/redeem",
        json={"code": "ANYEXAM", "certification_id": str(certification.id)},
    )
    assert response.status_code == 200, response.text


# --- Every way a code is refused ----------------------------------------------
@pytest.mark.parametrize(
    "overrides",
    [
        pytest.param({"is_active": False}, id="switched off"),
        pytest.param(
            {"expires_at": datetime.now(UTC) - timedelta(days=1)}, id="expired"
        ),
        pytest.param(
            {"starts_at": datetime.now(UTC) + timedelta(days=1)}, id="not started yet"
        ),
        pytest.param(
            {"max_redemptions": 2, "redemption_count": 2}, id="fully redeemed"
        ),
    ],
)
async def test_a_code_that_cannot_be_used_is_refused(client, db_session, overrides):
    certification = await _exam(db_session)
    await _coupon(db_session, certification, **overrides)

    response = await client.post(
        "/api/exam-coupons/redeem",
        json={"code": "LAUNCH50", "certification_id": str(certification.id)},
    )
    assert response.status_code == 422
    # The same message every time: the endpoint must not say which kind of
    # refusal it was, or it becomes an oracle for guessing live codes.
    assert response.json()["error"]["message"] == "That code is not valid for this exam."


async def test_an_unknown_code_is_refused_in_the_same_words(client, db_session):
    certification = await _exam(db_session)
    await _coupon(db_session, certification)

    response = await client.post(
        "/api/exam-coupons/redeem",
        json={"code": "NOTACODE", "certification_id": str(certification.id)},
    )
    assert response.status_code == 422
    assert response.json()["error"]["message"] == "That code is not valid for this exam."


async def test_a_code_inside_its_window_works(client, db_session):
    """The window is a window, not just an expiry: open at both ends."""
    certification = await _exam(db_session)
    await _coupon(
        db_session,
        certification,
        starts_at=datetime.now(UTC) - timedelta(days=1),
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )

    response = await client.post(
        "/api/exam-coupons/redeem",
        json={"code": "LAUNCH50", "certification_id": str(certification.id)},
    )
    assert response.status_code == 200, response.text


async def test_a_code_scoped_to_one_exam_does_not_work_on_another(client, db_session):
    certification = await _exam(db_session)
    other = await make_certification(
        db_session,
        await make_provider(db_session, name="Amazon"),
        name="Other Exam",
        exam_fee="99.00",
        discount_percentage="65.00",
    )
    await _coupon(db_session, certification)

    response = await client.post(
        "/api/exam-coupons/redeem",
        json={"code": "LAUNCH50", "certification_id": str(other.id)},
    )
    assert response.status_code == 422


async def test_an_unpriced_exam_cannot_be_unlocked(client, db_session):
    certification = await _exam(db_session, fee=None, discount=None)
    await _coupon(db_session, certification)

    response = await client.post(
        "/api/exam-coupons/redeem",
        json={"code": "LAUNCH50", "certification_id": str(certification.id)},
    )
    assert response.status_code == 422
    assert "published fee" in response.json()["error"]["message"]


# --- Paying ------------------------------------------------------------------
async def test_checkout_charges_the_advertised_price(client, db_session, razorpay):  # noqa: F811
    certification = await _exam(db_session)
    coupon = await _coupon(db_session, certification)

    response = await client.post(
        "/api/exam-coupons/checkout",
        json={"code": "LAUNCH50", "certification_id": str(certification.id)},
    )
    assert response.status_code == 200, response.text
    checkout = response.json()
    assert checkout["amount"] == "34.65"
    assert razorpay[0]["amount"] == Decimal("34.65")
    # No contact step on this route, so the provider's form collects them.
    assert checkout["prefill_email"] == ""

    payment = await db_session.scalar(
        select(Payment).where(Payment.exam_coupon_id == coupon.id)
    )
    assert payment is not None
    assert payment.status == PaymentStatus.PENDING.value
    assert payment.certification_id == certification.id
    assert payment.paid_at is None


async def test_a_refused_code_never_reaches_the_payment_provider(
    client, db_session, razorpay  # noqa: F811
):
    certification = await _exam(db_session)
    await _coupon(db_session, certification, is_active=False)

    response = await client.post(
        "/api/exam-coupons/checkout",
        json={"code": "LAUNCH50", "certification_id": str(certification.id)},
    )
    assert response.status_code == 422
    assert razorpay == []
    assert await db_session.scalar(select(Payment)) is None


async def test_checking_a_code_does_not_spend_it(client, db_session):
    certification = await _exam(db_session)
    coupon = await _coupon(db_session, certification, max_redemptions=1)

    for _ in range(3):
        response = await client.post(
            "/api/exam-coupons/redeem",
            json={"code": "LAUNCH50", "certification_id": str(certification.id)},
        )
        assert response.status_code == 200

    await db_session.refresh(coupon)
    assert coupon.redemption_count == 0


# --- Running a batch of codes ------------------------------------------------
async def test_a_generated_code_carries_the_influencer_and_is_not_in_use(
    client, db_session, admin
):
    auth_override(admin)
    await _coupon(db_session, None, code="PRIYASHARMA-AAAAA")

    response = await client.get(
        "/api/exam-coupons/admin/generate", params={"owner_name": "Priya Sharma!"}
    )
    assert response.status_code == 200, response.text
    code = response.json()["code"]

    assert code.startswith("PRIYASHARMA-")
    assert code != "PRIYASHARMA-AAAAA"
    # Lookalike characters are left out, so a code read off a video survives
    # being retyped from memory.
    assert not set(code.split("-")[1]) & set("O0I1L")


async def test_a_generated_code_without_an_owner_still_works(client, db_session, admin):
    auth_override(admin)
    response = await client.get("/api/exam-coupons/admin/generate")
    assert response.status_code == 200, response.text
    assert response.json()["code"].startswith("GC-")


async def test_an_admin_creates_a_code_for_an_influencer(client, db_session, admin):
    auth_override(admin)
    certification = await _exam(db_session)

    response = await client.post(
        "/api/exam-coupons/admin",
        json={
            "code": "PRIYA-7K4MQ",
            "owner_name": "Priya Sharma",
            "owner_email": "priya@example.com",
            "certification_id": str(certification.id),
            "is_active": True,
            "starts_at": "2026-11-01T00:00:00Z",
            "expires_at": "2026-12-31T23:59:59Z",
            "max_redemptions": 100,
        },
    )
    assert response.status_code == 201, response.text
    row = response.json()
    assert row["owner_name"] == "Priya Sharma"
    assert row["certification_name"] == "Cloud Digital Leader"
    # Dated into the future, so the console says so rather than calling it live.
    assert row["status"] == "scheduled"


async def test_a_window_that_closes_before_it_opens_is_refused(
    client, db_session, admin
):
    auth_override(admin)
    response = await client.post(
        "/api/exam-coupons/admin",
        json={
            "code": "BACKWARDS",
            "is_active": True,
            "starts_at": "2026-12-31T00:00:00Z",
            "expires_at": "2026-11-01T00:00:00Z",
        },
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        pytest.param({}, "live", id="live"),
        pytest.param({"is_active": False}, "off", id="off"),
        pytest.param(
            {"starts_at": datetime.now(UTC) + timedelta(days=1)},
            "scheduled",
            id="scheduled",
        ),
        pytest.param(
            {"expires_at": datetime.now(UTC) - timedelta(days=1)},
            "expired",
            id="expired",
        ),
        pytest.param(
            {"max_redemptions": 1, "redemption_count": 1}, "spent", id="spent"
        ),
    ],
)
async def test_the_console_reads_the_same_rules_the_site_does(
    client, db_session, admin, overrides, expected
):
    """The badge in the admin table must not disagree with the redeem endpoint."""
    auth_override(admin)
    await _coupon(db_session, None, **overrides)

    rows = (await client.get("/api/exam-coupons/admin")).json()
    assert rows[0]["status"] == expected


async def test_the_webhook_is_what_spends_a_code(
    client, db_session, razorpay, monkeypatch  # noqa: F811
):
    monkeypatch.setattr(settings, "payment_webhook_secret", "shh")
    certification = await _exam(db_session)
    coupon = await _coupon(db_session, certification, max_redemptions=1)

    checkout = (
        await client.post(
            "/api/exam-coupons/checkout",
            json={"code": "LAUNCH50", "certification_id": str(certification.id)},
        )
    ).json()

    raw, signature = _signed(
        {
            "event": "payment.captured",
            "payload": {
                "payment": {"entity": {"id": "pay_1", "order_id": checkout["order_id"]}}
            },
        },
        "shh",
    )
    response = await client.post(
        "/api/payments/webhook", content=raw, headers={"X-Payment-Signature": signature}
    )
    assert response.status_code == 200

    await db_session.refresh(coupon)
    assert coupon.redemption_count == 1

    # And that was its only use: the code is spent now.
    refused = await client.post(
        "/api/exam-coupons/redeem",
        json={"code": "LAUNCH50", "certification_id": str(certification.id)},
    )
    assert refused.status_code == 422
