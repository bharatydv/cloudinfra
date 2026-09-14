from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.factories import make_certification, make_provider

pytestmark = pytest.mark.asyncio


async def _detail(client: AsyncClient, provider, certification) -> dict:
    response = await client.get(
        f"/api/certifications/{provider.slug}/{certification.slug}"
    )
    assert response.status_code == 200
    return response.json()


async def test_detail_exposes_both_prices_and_the_saving(client: AsyncClient, db_session):
    provider = await make_provider(db_session)
    certification = await make_certification(
        db_session, provider, exam_fee="125.00", offer_price="100.00"
    )

    body = await _detail(client, provider, certification)
    assert body["exam_fee_amount"] == "125.00"
    assert body["offer_price_amount"] == "100.00"
    assert body["exam_fee_currency"] == "USD"
    assert body["savings_percentage"] == 20


@pytest.mark.parametrize(
    ("exam_fee", "offer_price"),
    [
        (None, None),  # nothing quoted
        ("125.00", None),  # vendor fee only -- nothing to compare against
        (None, "100.00"),  # our price only -- no comparison to draw
        ("125.00", "125.00"),  # identical, so no saving to claim
        ("125.00", "150.00"),  # ours is dearer; never advertise a negative saving
        ("0.00", "0.00"),  # free exam, guards the divide-by-zero
    ],
)
async def test_savings_is_null_unless_there_is_a_real_discount(
    client: AsyncClient, db_session, exam_fee, offer_price
):
    provider = await make_provider(db_session)
    certification = await make_certification(
        db_session, provider, exam_fee=exam_fee, offer_price=offer_price
    )

    body = await _detail(client, provider, certification)
    assert body["savings_percentage"] is None


async def test_listing_and_scheduling_options_agree_on_price(
    client: AsyncClient, db_session
):
    provider = await make_provider(db_session)
    await make_certification(db_session, provider, exam_fee="200.00", offer_price="160.00")

    listing = await client.get("/api/certifications")
    card = listing.json()["items"][0]

    options = await client.get("/api/exam-bookings/options")
    option = options.json()[0]

    # The scheduling form prices the exam from its own payload, so the two
    # surfaces must not be able to disagree.
    for field in ("exam_fee_amount", "offer_price_amount", "savings_percentage"):
        assert card[field] == option[field], field
    assert card["savings_percentage"] == 20


async def test_admin_can_set_and_clear_pricing(client: AsyncClient, db_session, admin):
    from tests.conftest import auth_override

    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider)
    auth_override(admin)

    priced = await client.put(
        f"/api/certifications/{certification.id}",
        json={"exam_fee_amount": "99.00", "offer_price_amount": "79.00"},
    )
    assert priced.status_code == 200
    assert priced.json()["savings_percentage"] == 20

    cleared = await client.put(
        f"/api/certifications/{certification.id}",
        json={"exam_fee_amount": None, "offer_price_amount": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["savings_percentage"] is None


async def test_negative_pricing_is_rejected(client: AsyncClient, db_session, admin):
    from tests.conftest import auth_override

    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider)
    auth_override(admin)

    response = await client.put(
        f"/api/certifications/{certification.id}", json={"exam_fee_amount": "-1.00"}
    )
    assert response.status_code == 422
