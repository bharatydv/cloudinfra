"""The deal card: one shape for a discounted exam and a discounted course.

Certifications and courses are priced by different rules -- a vendor fee less a
percentage versus a list price an operator has recorded -- but a visitor
comparing offers wants the same four numbers either way: what it normally
costs, what it costs now, what that saves, and when anyone last checked.
Flattening both into one card is what lets /deals sort them together.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

DealKind = Literal["certification", "course"]


class DealCard(BaseModel):
    kind: DealKind
    id: uuid.UUID
    title: str
    short_description: str
    #: Where "View deal" goes -- an existing detail page, never an offsite link.
    url: str
    thumbnail: str | None = None

    # Certification-only context; None on a course deal.
    provider_name: str | None = None
    provider_slug: str | None = None
    provider_logo: str | None = None
    exam_code: str | None = None

    level: str | None = None
    category: str | None = None

    currency: str = "USD"
    #: The figure the discount comes off: a vendor's exam fee or a list price.
    original_price: Decimal
    #: What a visitor actually pays, tax included where tax is switched on.
    sale_price: Decimal
    savings_amount: Decimal
    discount_percentage: int
    #: Present only when tax is included in `sale_price`, so the card can say so.
    tax_label: str | None = None
    tax_amount: Decimal | None = None

    duration_minutes: int | None = None
    rating_average: Decimal | None = None
    rating_count: int | None = None

    #: When a human last confirmed the price. Never fabricated: a certification
    #: without a checked-on date sends null and the card stays silent.
    last_verified_on: date | None = None
    created_at: datetime
