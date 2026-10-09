"""Request and response bodies for exam coupon codes.

A coupon is the second route to the discounted exam fee, beside a passed
challenge paper. It carries no rate of its own, so nothing here quotes a
percentage: the response hands back the same `ExamPricing` every other surface
shows, and the amount payable is that quote's total.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.certification import ExamPricing
from app.schemas.common import ORMModel

# Codes are compared and stored upper-case, so "launch50" and "LAUNCH50" are
# the same coupon however a visitor types it.
CODE_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$"


def _normalize(code: object) -> object:
    """Trim and upper-case before the pattern is checked, not after.

    A `mode="before"` validator is what lets a visitor paste " launch50 " and
    still match; an after-validator would run once the pattern had already
    rejected the spaces.
    """
    return code.strip().upper() if isinstance(code, str) else code


class ExamCouponRedeemRequest(BaseModel):
    """Check a code against one exam, before any money is involved."""

    code: str = Field(min_length=3, max_length=40, pattern=CODE_PATTERN)
    certification_id: uuid.UUID

    @field_validator("code", mode="before")
    @classmethod
    def _upper(cls, value: object) -> object:
        return _normalize(value)


class ExamCouponQuote(BaseModel):
    """What a valid code unlocks: the price the catalogue already advertises.

    `amount_payable` is `pricing.total_price_amount`, repeated so a caller
    never has to decide for itself which figure to charge.
    """

    code: str
    certification_id: uuid.UUID
    certification_name: str
    pricing: ExamPricing
    amount_payable: Decimal
    # False when the exam has no published fee, so the surface can say the team
    # will follow up instead of offering a button that charges nothing.
    can_pay: bool


class ExamCouponWrite(BaseModel):
    """Staff-side create and update body."""

    code: str = Field(min_length=3, max_length=40, pattern=CODE_PATTERN)
    description: str | None = Field(default=None, max_length=200)
    # Who the batch was handed to -- an influencer, a college, a community.
    # A label for attribution, not an account anybody signs in to.
    owner_name: str | None = Field(default=None, max_length=120)
    owner_email: EmailStr | None = None
    # None means the code works on every exam.
    certification_id: uuid.UUID | None = None
    is_active: bool = True
    # The custom validity window. Either end may be open.
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    max_redemptions: int | None = Field(default=None, gt=0)

    @field_validator("code", mode="before")
    @classmethod
    def _upper(cls, value: object) -> object:
        return _normalize(value)

    @model_validator(mode="after")
    def _window_ordered(self) -> ExamCouponWrite:
        """Refuse a window that closes before it opens.

        The database rejects it too; catching it here is what turns a 500 into
        a message beside the field that caused it.
        """
        if (
            self.starts_at is not None
            and self.expires_at is not None
            and self.starts_at >= self.expires_at
        ):
            raise ValueError("The end of the validity window must come after its start.")
        return self


class ExamCouponRow(ORMModel):
    """One coupon, as the admin table lists it."""

    id: uuid.UUID
    code: str
    description: str | None = None
    owner_name: str | None = None
    owner_email: str | None = None
    certification_id: uuid.UUID | None = None
    certification_name: str | None = None
    is_active: bool
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    max_redemptions: int | None = None
    redemption_count: int
    # What the code can do right now, decided by the same rules the redeem
    # endpoint applies, so the admin table never disagrees with the site.
    status: Literal["live", "scheduled", "expired", "spent", "off"]
    created_at: datetime


class GeneratedCode(BaseModel):
    """A code the server has confirmed is not in use."""

    code: str
