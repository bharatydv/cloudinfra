"""Deals, course discounts and the discovery surfaces built on them.

The rule these tests exist to hold: a saving is only ever shown when someone
has recorded the price it is measured against. Most of what follows is
therefore about what does *not* appear.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.services import pricing
from app.services.pricing import course_discount
from tests.conftest import auth_override
from tests.factories import make_certification, make_course, make_provider

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def _clear_pricing_cache():
    """The config is cached for 30s; tests must not inherit each other's."""
    pricing.reset_cache()
    yield
    pricing.reset_cache()


async def _set_pricing(client: AsyncClient, admin, **value) -> None:
    auth_override(admin)
    response = await client.put(
        "/api/admin/settings/pricing", json={"value": value, "is_public": True}
    )
    assert response.status_code == 200


# --- The course arithmetic, unit tested -----------------------------------
def test_course_saving_is_derived_from_the_two_prices():
    result = course_discount(price=Decimal("49.00"), compare_at_price=Decimal("199.00"))
    assert result is not None
    assert result.discount_amount == Decimal("150.00")
    assert result.discount_percentage == 75
    # What a visitor subtracts on screen must equal the saving they are shown.
    assert result.compare_at_amount - result.discount_amount == Decimal("49.00")


@pytest.mark.parametrize(
    "price, compare_at",
    [
        (Decimal("49.00"), None),  # nobody recorded a list price
        (Decimal("49.00"), Decimal("49.00")),  # the same price is not a saving
        (Decimal("49.00"), Decimal("20.00")),  # a lower "was" price is not either
        (Decimal("0"), Decimal("0")),
    ],
)
def test_no_saving_without_a_higher_recorded_price(price, compare_at):
    assert course_discount(price=price, compare_at_price=compare_at) is None


# --- The course card ------------------------------------------------------
async def test_course_card_carries_the_saving(client: AsyncClient, db_session):
    await make_course(db_session, title="Discounted Course", price="39", compare_at_price="199")

    response = await client.get("/api/courses")
    assert response.status_code == 200
    card = response.json()["items"][0]

    assert card["compare_at_price"] == "199.00"
    assert card["price"] == "39.00"
    assert card["savings_amount"] == "160.00"
    assert card["discount_percentage"] == 80


async def test_undiscounted_course_advertises_nothing(client: AsyncClient, db_session):
    await make_course(db_session, title="Plain Course", price="39")

    card = (await client.get("/api/courses")).json()["items"][0]
    assert card["compare_at_price"] is None
    assert card["savings_amount"] is None
    assert card["discount_percentage"] is None


async def test_admin_can_set_and_clear_the_was_price(
    client: AsyncClient, db_session, admin
):
    course = await make_course(db_session, title="Editable Course", price="39")
    auth_override(admin)

    response = await client.put(
        f"/api/courses/{course.id}", json={"compare_at_price": "129.00"}
    )
    assert response.status_code == 200
    assert response.json()["discount_percentage"] == 70

    # Clearing it removes the saving rather than leaving a stale comparison.
    response = await client.put(f"/api/courses/{course.id}", json={"compare_at_price": None})
    assert response.status_code == 200
    assert response.json()["compare_at_price"] is None
    assert response.json()["discount_percentage"] is None


# --- The deals listing ----------------------------------------------------
async def test_deals_lists_both_catalogues_deepest_first(
    client: AsyncClient, db_session, admin
):
    provider = await make_provider(db_session)
    await make_certification(
        db_session,
        provider,
        name="Discounted Exam",
        exam_fee="200",
        discount_percentage="25",
        fee_checked_on=date(2026, 9, 12),
    )
    await make_course(db_session, title="Half Price Course", price="50", compare_at_price="100")
    await _set_pricing(client, admin, discountPercentage=0)

    response = await client.get("/api/deals")
    assert response.status_code == 200
    items = response.json()["items"]

    assert [item["discount_percentage"] for item in items] == [50, 25]
    assert [item["kind"] for item in items] == ["course", "certification"]

    exam = items[1]
    assert exam["original_price"] == "200.00"
    assert exam["savings_amount"] == "50.00"
    assert exam["last_verified_on"] == "2026-09-12"
    assert exam["exam_code"] == "EX-100"


async def test_unpriced_and_undiscounted_records_are_not_deals(
    client: AsyncClient, db_session, admin
):
    provider = await make_provider(db_session)
    # No vendor fee at all, so there is nothing to discount.
    await make_certification(db_session, provider, name="Unpriced Exam")
    # Priced, but explicitly excluded from the sale.
    await make_certification(
        db_session, provider, name="Full Price Exam", exam_fee="150", discount_percentage="0"
    )
    await make_course(db_session, title="Full Price Course", price="50")
    await _set_pricing(client, admin, discountPercentage=20)

    body = (await client.get("/api/deals")).json()
    assert body["total"] == 0
    assert body["items"] == []


async def test_unpublished_records_never_reach_the_deals_listing(
    client: AsyncClient, db_session, admin
):
    provider = await make_provider(db_session)
    await make_certification(
        db_session, provider, name="Draft Exam", exam_fee="200", published=False
    )
    await make_course(
        db_session, title="Draft Course", price="10", compare_at_price="100", published=False
    )
    await _set_pricing(client, admin, discountPercentage=30)

    assert (await client.get("/api/deals")).json()["total"] == 0


async def test_site_wide_discount_puts_every_priced_exam_on_offer(
    client: AsyncClient, db_session, admin
):
    provider = await make_provider(db_session)
    await make_certification(db_session, provider, name="Inheriting Exam", exam_fee="100")
    await _set_pricing(client, admin, discountPercentage=15)

    items = (await client.get("/api/deals")).json()["items"]
    assert len(items) == 1
    assert items[0]["discount_percentage"] == 15
    # Nobody recorded a check, so the card is given nothing to claim.
    assert items[0]["last_verified_on"] is None


async def test_deals_can_be_filtered_and_sorted(client: AsyncClient, db_session, admin):
    provider = await make_provider(db_session)
    await make_certification(
        db_session, provider, name="Small Discount", exam_fee="300", discount_percentage="10"
    )
    await make_course(db_session, title="Deep Discount", price="10", compare_at_price="100")
    await _set_pricing(client, admin, discountPercentage=0)

    only_deep = (await client.get("/api/deals", params={"min_discount": 50})).json()
    assert [item["title"] for item in only_deep["items"]] == ["Deep Discount"]

    only_exams = (await client.get("/api/deals", params={"kind": "certification"})).json()
    assert [item["kind"] for item in only_exams["items"]] == ["certification"]

    cheapest = (await client.get("/api/deals", params={"sort": "price"})).json()
    assert [item["title"] for item in cheapest["items"]] == ["Deep Discount", "Small Discount"]


async def test_homepage_carries_the_top_deals(client: AsyncClient, db_session, admin):
    provider = await make_provider(db_session)
    await make_certification(
        db_session, provider, name="Featured Exam", exam_fee="200", discount_percentage="40"
    )
    await _set_pricing(client, admin, discountPercentage=0)

    body = (await client.get("/api/home")).json()
    assert [deal["discount_percentage"] for deal in body["top_deals"]] == [40]


# --- Discovery ------------------------------------------------------------
async def test_certifications_can_be_filtered_by_discount(
    client: AsyncClient, db_session, admin
):
    provider = await make_provider(db_session)
    await make_certification(
        db_session, provider, name="Barely Discounted", exam_fee="100", discount_percentage="5"
    )
    await make_certification(
        db_session, provider, name="Heavily Discounted", exam_fee="100", discount_percentage="60"
    )
    await _set_pricing(client, admin, discountPercentage=0)

    body = (await client.get("/api/certifications", params={"min_discount": 50})).json()
    assert [item["name"] for item in body["items"]] == ["Heavily Discounted"]

    body = (await client.get("/api/certifications", params={"sort": "discount"})).json()
    assert [item["name"] for item in body["items"]] == [
        "Heavily Discounted",
        "Barely Discounted",
    ]


async def test_price_filter_matches_the_price_on_the_card(
    client: AsyncClient, db_session, admin
):
    """Tax is part of what a visitor pays, so it is part of what they filter on."""
    provider = await make_provider(db_session)
    await make_certification(db_session, provider, name="Near The Ceiling", exam_fee="100")
    await _set_pricing(client, admin, discountPercentage=0, taxEnabled=True, taxRate=18)

    # The card shows 118.00, so a ceiling of 110 must exclude it.
    assert (
        await client.get("/api/certifications", params={"max_price": 110})
    ).json()["total"] == 0
    body = (await client.get("/api/certifications", params={"max_price": 120})).json()
    assert body["total"] == 1
    assert body["items"][0]["pricing"]["total_price_amount"] == "118.00"


async def test_exact_exam_code_wins_the_search(client: AsyncClient, db_session):
    provider = await make_provider(db_session)
    await make_certification(
        db_session, provider, name="Architect Associate", exam_code="SAA-C03", exam_fee="150"
    )
    # A course whose title matches the query far more literally.
    await make_course(db_session, title="SAA-C03 Full Course", price="20")

    results = (await client.get("/api/search", params={"q": "SAA-C03"})).json()["results"]
    assert results[0]["type"] == "certification"
    assert results[0]["metadata"]["exam_code"] == "SAA-C03"


async def test_search_results_carry_prices(client: AsyncClient, db_session, admin):
    provider = await make_provider(db_session)
    await make_certification(
        db_session, provider, name="Priced Exam", exam_fee="200", discount_percentage="25"
    )
    await _set_pricing(client, admin, discountPercentage=0)

    results = (await client.get("/api/search", params={"q": "Priced"})).json()["results"]
    exam = next(item for item in results if item["type"] == "certification")
    assert exam["metadata"]["price"] == "150.00"
    assert exam["metadata"]["compare_at_price"] == "200.00"
    assert exam["metadata"]["discount_percentage"] == 25


async def test_certification_page_offers_only_a_price_it_has(
    client: AsyncClient, db_session, admin
):
    provider = await make_provider(db_session)
    priced = await make_certification(
        db_session, provider, name="Priced Exam", exam_fee="200", discount_percentage="25"
    )
    unpriced = await make_certification(db_session, provider, name="Unpriced Exam")
    await _set_pricing(client, admin, discountPercentage=0)

    body = (
        await client.get(f"/api/certifications/{provider.slug}/{priced.slug}")
    ).json()
    offers = [
        block.get("offers")
        for block in body["seo"]["structured_data"]
        if block.get("@type") == "Course"
    ]
    assert offers and offers[0]["price"] == "150.00"
    assert "25%" in body["seo"]["description"]

    body = (
        await client.get(f"/api/certifications/{provider.slug}/{unpriced.slug}")
    ).json()
    course_block = next(
        block for block in body["seo"]["structured_data"] if block.get("@type") == "Course"
    )
    assert "offers" not in course_block
    assert "%" not in body["seo"]["description"]
