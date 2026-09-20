"""Assembling the /deals listing.

Every figure here is derived from the same helpers the certification and course
cards use, so a deal can never advertise a saving the detail page then fails to
honour. Nothing is invented: an exam with no quoted vendor fee and a course
with no recorded list price simply do not appear.

Both catalogues are small and the discount on an exam depends on a site-wide
setting rather than a column, so the merge, sort and slice happen in Python.
If the catalogue ever outgrows that, the two halves are already separate
queries and can be pushed back into SQL independently.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.models.catalog import Course
from app.models.certification import Certification
from app.repositories import certification_repo, course_repo
from app.schemas.deals import DealCard, DealKind
from app.services import pricing
from app.services.pricing import PricingConfig

DealSort = str


def _certification_deal(
    certification: Certification, config: PricingConfig
) -> DealCard | None:
    breakdown = pricing.compute(
        exam_fee_amount=certification.exam_fee_amount,
        currency=certification.exam_fee_currency,
        fee_checked_on=certification.exam_fee_checked_on,
        discount_override=certification.discount_percentage,
        config=config,
    )
    # No fee, or a fee nobody is discounting, is not a deal.
    if breakdown is None or breakdown.savings_percentage is None:
        return None

    provider = certification.provider
    return DealCard(
        kind="certification",
        id=certification.id,
        title=certification.name,
        short_description=certification.short_description,
        url=(
            f"/certifications/{provider.slug}/{certification.slug}"
            if provider
            else f"/certifications/{certification.slug}"
        ),
        provider_name=provider.name if provider else None,
        provider_slug=provider.slug if provider else None,
        provider_logo=provider.logo if provider else None,
        exam_code=certification.exam_code,
        level=certification.level,
        category=certification.category,
        currency=breakdown.currency,
        original_price=breakdown.exam_fee_amount,
        sale_price=breakdown.total_price_amount,
        savings_amount=breakdown.discount_amount,
        discount_percentage=breakdown.savings_percentage,
        tax_label=breakdown.tax_label if breakdown.tax_amount > 0 else None,
        tax_amount=breakdown.tax_amount if breakdown.tax_amount > 0 else None,
        duration_minutes=certification.exam_duration_minutes,
        last_verified_on=certification.exam_fee_checked_on,
        created_at=certification.created_at,
    )


def _course_deal(course: Course) -> DealCard | None:
    discount = pricing.course_discount(
        price=course.price, compare_at_price=course.compare_at_price
    )
    if discount is None:
        return None

    return DealCard(
        kind="course",
        id=course.id,
        title=course.title,
        short_description=course.short_description,
        url=f"/courses/{course.slug}",
        thumbnail=course.thumbnail,
        level=course.level,
        category=course.category.name if course.category else None,
        currency=course.currency,
        original_price=discount.compare_at_amount,
        sale_price=course.price,
        savings_amount=discount.discount_amount,
        discount_percentage=discount.discount_percentage,
        duration_minutes=course.duration_minutes,
        rating_average=course.rating_average if course.rating_count else None,
        rating_count=course.rating_count or None,
        # Courses carry no separate price-check column; the row's own last edit
        # is the honest answer to "when was this last looked at".
        last_verified_on=course.updated_at.date() if course.updated_at else None,
        created_at=course.created_at,
    )


async def list_deals(
    db: AsyncSession,
    params: PageParams,
    *,
    kind: DealKind | None = None,
    provider_slug: str | None = None,
    level: str | None = None,
    min_discount: int | None = None,
    sort: DealSort = "discount",
) -> tuple[list[DealCard], int]:
    config = await pricing.load_config(db)

    deals: list[DealCard] = []
    if kind != "course":
        certifications = await certification_repo.priced(db)
        deals += [
            deal
            for deal in (_certification_deal(item, config) for item in certifications)
            if deal is not None
        ]
    if kind != "certification":
        courses = await course_repo.discounted(db)
        deals += [
            deal for deal in (_course_deal(item) for item in courses) if deal is not None
        ]

    if provider_slug:
        deals = [deal for deal in deals if deal.provider_slug == provider_slug]
    if level:
        deals = [deal for deal in deals if deal.level == level]
    if min_discount:
        deals = [deal for deal in deals if deal.discount_percentage >= min_discount]

    match sort:
        case "price":
            deals.sort(key=lambda deal: (deal.sale_price, deal.title))
        case "savings":
            deals.sort(key=lambda deal: (-deal.savings_amount, deal.title))
        case "newest":
            deals.sort(key=lambda deal: deal.created_at, reverse=True)
        case _:
            deals.sort(key=lambda deal: (-deal.discount_percentage, deal.title))

    total = len(deals)
    return deals[params.offset : params.offset + params.limit], total


async def top_deals(db: AsyncSession, limit: int = 6) -> list[DealCard]:
    """The deepest discounts, for the homepage strip."""
    items, _ = await list_deals(db, PageParams(page=1, page_size=limit))
    return items


def latest_verified_on(deals: list[DealCard]) -> date | None:
    """The most recent check across a set of deals, for a listing-level line."""
    dates = [deal.last_verified_on for deal in deals if deal.last_verified_on]
    return max(dates) if dates else None
