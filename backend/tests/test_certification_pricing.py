from __future__ import annotations

from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.services import pricing
from app.services.pricing import PricingConfig
from tests.conftest import auth_override
from tests.factories import make_certification, make_provider

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


async def _detail(client: AsyncClient, provider, certification) -> dict:
    response = await client.get(
        f"/api/certifications/{provider.slug}/{certification.slug}"
    )
    assert response.status_code == 200
    return response.json()


# --- The arithmetic, unit tested ------------------------------------------
def test_breakdown_steps_add_up_to_the_total():
    result = pricing.compute(
        exam_fee_amount=Decimal("125.00"),
        currency="USD",
        discount_override=None,
        config=PricingConfig(
            discount_percentage=Decimal(20), tax_enabled=True, tax_rate=Decimal(18)
        ),
    )
    assert result is not None
    assert result.discount_amount == Decimal("25.00")
    assert result.net_price_amount == Decimal("100.00")
    assert result.tax_amount == Decimal("18.00")
    assert result.total_price_amount == Decimal("118.00")
    # What a visitor adds up on screen must equal the total they are shown.
    assert result.net_price_amount + result.tax_amount == result.total_price_amount
    assert result.exam_fee_amount - result.discount_amount == result.net_price_amount
    assert result.savings_percentage == 20


def test_rounding_keeps_the_parts_consistent():
    # 99 at 20% off is 79.20, and 18% of that is 14.256 -- both need rounding.
    result = pricing.compute(
        exam_fee_amount=Decimal("99.00"),
        currency="USD",
        discount_override=None,
        config=PricingConfig(
            discount_percentage=Decimal(20), tax_enabled=True, tax_rate=Decimal(18)
        ),
    )
    assert result is not None
    assert result.discount_amount == Decimal("19.80")
    assert result.net_price_amount == Decimal("79.20")
    assert result.tax_amount == Decimal("14.26")
    assert result.total_price_amount == Decimal("93.46")
    assert result.net_price_amount + result.tax_amount == result.total_price_amount


def test_tax_disabled_leaves_the_total_untaxed():
    result = pricing.compute(
        exam_fee_amount=Decimal("100.00"),
        currency="USD",
        discount_override=None,
        config=PricingConfig(
            discount_percentage=Decimal(10), tax_enabled=False, tax_rate=Decimal(18)
        ),
    )
    assert result is not None
    assert result.tax_amount == Decimal("0.00")
    assert result.total_price_amount == result.net_price_amount == Decimal("90.00")


@pytest.mark.parametrize("fee", [None, Decimal("0.00")])
def test_no_fee_means_no_pricing_at_all(fee):
    assert (
        pricing.compute(
            exam_fee_amount=fee,
            currency="USD",
            discount_override=None,
            config=PricingConfig(discount_percentage=Decimal(20)),
        )
        is None
    )


def test_zero_discount_shows_no_savings_badge():
    result = pricing.compute(
        exam_fee_amount=Decimal("100.00"),
        currency="USD",
        discount_override=Decimal(0),
        config=PricingConfig(discount_percentage=Decimal(20)),
    )
    assert result is not None
    assert result.discount_amount == Decimal("0.00")
    assert result.savings_percentage is None


def test_override_of_zero_beats_the_site_default():
    """NULL inherits; an explicit 0 opts out. They must not be conflated."""
    config = PricingConfig(discount_percentage=Decimal(20))
    inherited = pricing.compute(
        exam_fee_amount=Decimal("100.00"), currency="USD",
        discount_override=None, config=config,
    )
    opted_out = pricing.compute(
        exam_fee_amount=Decimal("100.00"), currency="USD",
        discount_override=Decimal(0), config=config,
    )
    assert inherited is not None and opted_out is not None
    assert inherited.discount_percentage == Decimal(20)
    assert opted_out.discount_percentage == Decimal(0)


def test_out_of_range_config_is_clamped_not_trusted():
    config = PricingConfig.from_setting(
        {"discountPercentage": 999, "taxEnabled": True, "taxRate": -5}
    )
    assert config.discount_percentage == Decimal(100)
    assert config.tax_rate == Decimal(0)


def test_garbage_in_the_setting_falls_back_to_zero():
    config = PricingConfig.from_setting({"discountPercentage": "abc", "taxRate": None})
    assert config.discount_percentage == Decimal(0)
    assert config.tax_rate == Decimal(0)


# --- Through the API -------------------------------------------------------
async def test_detail_exposes_the_full_breakdown(client: AsyncClient, db_session, admin):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider, exam_fee="125.00")
    await _set_pricing(
        client, admin, discountPercentage=20, taxEnabled=True, taxRate=18, taxLabel="GST"
    )

    body = await _detail(client, provider, certification)
    assert body["pricing"]["exam_fee_amount"] == "125.00"
    assert body["pricing"]["discount_amount"] == "25.00"
    assert body["pricing"]["net_price_amount"] == "100.00"
    assert body["pricing"]["tax_label"] == "GST"
    assert body["pricing"]["tax_amount"] == "18.00"
    assert body["pricing"]["total_price_amount"] == "118.00"
    assert body["pricing"]["savings_percentage"] == 20


async def test_unpriced_certification_has_no_pricing(client: AsyncClient, db_session, admin):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider)
    await _set_pricing(client, admin, discountPercentage=20, taxEnabled=True, taxRate=18)

    body = await _detail(client, provider, certification)
    assert body["pricing"] is None


async def test_changing_the_site_discount_reprices_everything(
    client: AsyncClient, db_session, admin
):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider, exam_fee="100.00")

    await _set_pricing(client, admin, discountPercentage=20, taxEnabled=False)
    assert (await _detail(client, provider, certification))["pricing"][
        "total_price_amount"
    ] == "80.00"

    # The saved setting must invalidate the cache, not wait out its TTL.
    await _set_pricing(client, admin, discountPercentage=50, taxEnabled=False)
    assert (await _detail(client, provider, certification))["pricing"][
        "total_price_amount"
    ] == "50.00"


async def test_per_exam_override_wins_over_the_site_default(
    client: AsyncClient, db_session, admin
):
    provider = await make_provider(db_session)
    inherits = await make_certification(
        db_session, provider, name="Inherits", exam_fee="100.00"
    )
    overrides = await make_certification(
        db_session, provider, name="Overrides", exam_fee="100.00", discount_percentage="5"
    )
    await _set_pricing(client, admin, discountPercentage=20, taxEnabled=False)

    assert (await _detail(client, provider, inherits))["pricing"]["net_price_amount"] == (
        "80.00"
    )
    assert (await _detail(client, provider, overrides))["pricing"]["net_price_amount"] == (
        "95.00"
    )


async def test_listing_and_scheduling_options_agree(client: AsyncClient, db_session, admin):
    provider = await make_provider(db_session)
    await make_certification(db_session, provider, exam_fee="200.00")
    await _set_pricing(client, admin, discountPercentage=20, taxEnabled=True, taxRate=18)

    listing = await client.get("/api/certifications")
    card = listing.json()["items"][0]["pricing"]
    options = await client.get("/api/exam-bookings/options")
    option = options.json()[0]["pricing"]

    # The form prices the exam from its own payload; the two must not diverge.
    assert card == option
    assert card["total_price_amount"] == "188.80"


async def test_admin_sees_the_raw_override_not_the_effective_rate(
    client: AsyncClient, db_session, admin
):
    """Otherwise opening and saving an inheriting exam would silently pin it."""
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider, exam_fee="100.00")
    await _set_pricing(client, admin, discountPercentage=20, taxEnabled=False)

    auth_override(admin)
    body = (await client.get(f"/api/admin/certifications/{certification.id}")).json()
    # Stored: inherits. Computed: today's effective rate. The editor reads the
    # first, so opening and saving does not turn inheritance into an override.
    assert body["pricing_input"]["discount_percentage"] is None
    assert body["pricing_input"]["exam_fee_amount"] == "100.00"
    assert body["pricing"]["discount_percentage"] == "20.00"


async def test_admin_can_set_and_clear_the_override(client: AsyncClient, db_session, admin):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider, exam_fee="100.00")
    await _set_pricing(client, admin, discountPercentage=20, taxEnabled=False)

    auth_override(admin)
    pinned = await client.put(
        f"/api/certifications/{certification.id}", json={"discount_percentage": "35"}
    )
    assert pinned.status_code == 200
    assert pinned.json()["pricing"]["net_price_amount"] == "65.00"

    cleared = await client.put(
        f"/api/certifications/{certification.id}", json={"discount_percentage": None}
    )
    assert cleared.status_code == 200
    assert cleared.json()["pricing"]["net_price_amount"] == "80.00"


@pytest.mark.parametrize("bad", ["-1", "101"])
async def test_out_of_range_override_is_rejected(
    client: AsyncClient, db_session, admin, bad
):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider, exam_fee="100.00")
    auth_override(admin)

    response = await client.put(
        f"/api/certifications/{certification.id}", json={"discount_percentage": bad}
    )
    assert response.status_code == 422
