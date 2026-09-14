"""Exam pricing: discount resolution and tax.

One module owns the arithmetic so the figures on a card, a detail page, the
scheduling form and any future receipt cannot disagree with each other.

The chain is deliberately explicit rather than collapsed into a single number:

    provider fee  ->  less discount  ->  net price  ->  plus tax  ->  total

A visitor can therefore see what they are being charged and what it is being
compared against, which is the whole point of quoting a vendor's price.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import misc_repo
from app.schemas.certification import ExamPricing

SETTING_KEY = "pricing"

# Money is rounded to cents at each displayed step, so the parts always add up
# to the total a visitor is shown.
_CENTS = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    return value.quantize(_CENTS, rounding=ROUND_HALF_UP)


def _percent(value: object, *, default: Decimal = Decimal(0)) -> Decimal:
    """Coerce a JSON number to a sane percentage, clamped to 0-100.

    Quantized to two places so a rate read from the settings JSON serialises
    identically to one read from a Numeric(5, 2) column -- otherwise the same
    field comes back as "20" from one source and "20.00" from the other.
    """
    try:
        result = Decimal(str(value))
    except (TypeError, ValueError, ArithmeticError):
        return default
    if not result.is_finite():
        return default
    return min(max(result, Decimal(0)), Decimal(100)).quantize(
        _CENTS, rounding=ROUND_HALF_UP
    )


@dataclass(frozen=True, slots=True)
class PricingConfig:
    """Site-wide pricing rules, editable from Admin > Settings."""

    discount_percentage: Decimal = Decimal(0)
    tax_enabled: bool = False
    tax_rate: Decimal = Decimal(0)
    tax_label: str = "GST"

    @classmethod
    def from_setting(cls, value: dict | None) -> PricingConfig:
        if not value:
            return cls()
        return cls(
            discount_percentage=_percent(value.get("discountPercentage")),
            tax_enabled=bool(value.get("taxEnabled", False)),
            tax_rate=_percent(value.get("taxRate")),
            tax_label=str(value.get("taxLabel") or "GST")[:20],
        )


# Settings change rarely and are read on nearly every catalogue request, so the
# lookup is cached briefly rather than run per request. An admin edit shows up
# within the TTL.
_CACHE_TTL_SECONDS = 30.0
_cache: tuple[float, PricingConfig] | None = None


async def load_config(db: AsyncSession) -> PricingConfig:
    global _cache
    now = time.monotonic()
    if _cache and now - _cache[0] < _CACHE_TTL_SECONDS:
        return _cache[1]

    setting = await misc_repo.get_setting(db, SETTING_KEY)
    config = PricingConfig.from_setting(setting.value if setting else None)
    _cache = (now, config)
    return config


def reset_cache() -> None:
    """Drop the cached config. Called when an admin saves the setting."""
    global _cache
    _cache = None


def compute(
    *,
    exam_fee_amount: Decimal | None,
    currency: str,
    fee_checked_on=None,
    discount_override: Decimal | None,
    config: PricingConfig,
) -> ExamPricing | None:
    """Build the full price breakdown, or None when no fee is quoted.

    Returning None rather than a zeroed breakdown is what lets every surface
    hide pricing entirely for a certification nobody has priced yet.
    """
    if exam_fee_amount is None or exam_fee_amount <= 0:
        return None

    # A per-certification percentage wins over the site-wide default, including
    # an explicit 0 -- that is how an operator excludes one exam from a sale.
    discount = (
        _percent(discount_override)
        if discount_override is not None
        else config.discount_percentage
    )

    fee = _money(exam_fee_amount)
    discount_amount = _money(fee * discount / 100)
    net = _money(fee - discount_amount)

    tax_rate = config.tax_rate if config.tax_enabled else Decimal("0.00")
    tax_amount = _money(net * tax_rate / 100)

    return ExamPricing(
        currency=currency or "USD",
        exam_fee_amount=fee,
        fee_checked_on=fee_checked_on,
        discount_percentage=discount,
        discount_amount=discount_amount,
        net_price_amount=net,
        tax_label=config.tax_label,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total_price_amount=_money(net + tax_amount),
    )
