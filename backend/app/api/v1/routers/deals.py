"""Current offers across certifications and courses."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession
from app.core.pagination import Page, PageParams, page_params
from app.schemas.deals import DealCard, DealKind
from app.services import deal_service

router = APIRouter(tags=["Deals"])
Params = Annotated[PageParams, Depends(page_params)]


@router.get("/deals", response_model=Page[DealCard])
async def list_deals(
    db: DbSession,
    params: Params,
    kind: DealKind | None = Query(None, description="Restrict to exams or courses"),
    provider: str | None = Query(None, description="Provider slug"),
    level: str | None = Query(None, description="Certification or course level"),
    min_discount: int | None = Query(
        None, ge=0, le=100, description="Only offers of at least this percent"
    ),
    sort: Literal["discount", "savings", "price", "newest"] = "discount",
) -> Page[DealCard]:
    """Everything currently discounted, deepest first by default.

    An exam with no quoted vendor fee and a course with no recorded list price
    are absent rather than shown at a notional saving.
    """
    items, total = await deal_service.list_deals(
        db,
        params,
        kind=kind,
        provider_slug=provider,
        level=level,
        min_discount=min_discount,
        sort=sort,
    )
    return Page.create(items, total, params)
