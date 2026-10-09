"""Exam coupon codes: the second route to the discounted exam fee.

A learner reaches the same price two ways -- by passing the challenge paper, or
by holding a code. Both unlock the figure the catalogue already advertises, so
this module never computes a discount of its own: it validates the code, then
asks `pricing` for the very quote every card and detail page shows.

Keeping the rate out of the coupon is what stops the two routes drifting. A
code cannot be worth more or less than a pass, because it is not worth
anything -- it is a key.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.models.certification import Certification
from app.models.commerce import ExamCoupon
from app.models.user import User
from app.schemas.certification import ExamPricing
from app.schemas.commerce import ExamCouponQuote, ExamCouponRow, ExamCouponWrite
from app.schemas.system import ExamCheckout
from app.services import payment_service, pricing

# One message for every way a code can be refused. A code that does not exist,
# one that expired and one that is spent are indistinguishable to a visitor:
# otherwise the endpoint is an oracle for guessing live codes.
_REFUSED = "That code is not valid for this exam."


async def _coupon(db: AsyncSession, code: str) -> ExamCoupon | None:
    return await db.scalar(select(ExamCoupon).where(ExamCoupon.code == code.strip().upper()))


def _aware(moment: datetime | None) -> datetime | None:
    """Read a timestamp as UTC when the column hands one back naive."""
    if moment is None:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def _status(coupon: ExamCoupon) -> str:
    """What the code can do right now, ignoring which exam is being asked for.

    One function decides this, and both the redeem endpoint and the admin
    table read it, so the badge in the console can never disagree with what a
    visitor is told.
    """
    now = datetime.now(UTC)
    if not coupon.is_active:
        return "off"
    starts = _aware(coupon.starts_at)
    if starts is not None and starts > now:
        return "scheduled"
    expires = _aware(coupon.expires_at)
    if expires is not None and expires <= now:
        return "expired"
    if coupon.max_redemptions is not None and coupon.redemption_count >= coupon.max_redemptions:
        return "spent"
    return "live"


def _usable(coupon: ExamCoupon | None, certification_id: uuid.UUID) -> bool:
    """Whether this code may be redeemed against this exam, right now."""
    if coupon is None or _status(coupon) != "live":
        return False
    # A coupon with no certification works on any exam; one with a
    # certification works only on that exam.
    return coupon.certification_id is None or coupon.certification_id == certification_id


async def _priced(
    db: AsyncSession, certification_id: uuid.UUID
) -> tuple[Certification, ExamPricing | None]:
    certification = await db.scalar(
        select(Certification).where(
            Certification.id == certification_id, Certification.is_published.is_(True)
        )
    )
    if certification is None:
        raise NotFoundError("That certification could not be found.")
    quote = pricing.compute(
        exam_fee_amount=certification.exam_fee_amount,
        currency=certification.exam_fee_currency,
        fee_checked_on=certification.exam_fee_checked_on,
        discount_override=certification.discount_percentage,
        config=await pricing.load_config(db),
    )
    return certification, quote


async def redeem(
    db: AsyncSession, *, code: str, certification_id: uuid.UUID
) -> ExamCouponQuote:
    """Check a code and quote the price it unlocks. Nothing is spent here.

    A coupon is only counted as redeemed when the payment behind it clears, so
    a visitor may check the same code as often as they like.
    """
    certification, quote = await _priced(db, certification_id)
    coupon = await _coupon(db, code)
    if not _usable(coupon, certification_id):
        raise ValidationFailedError(_REFUSED)
    if quote is None:
        raise ValidationFailedError(
            "This exam does not have a published fee yet. Our team will confirm "
            "the price with you."
        )
    return ExamCouponQuote(
        code=coupon.code,
        certification_id=certification.id,
        certification_name=certification.name,
        pricing=quote,
        amount_payable=quote.total_price_amount,
        can_pay=payment_service.payments_enabled() and quote.total_price_amount > 0,
    )


async def start_checkout(
    db: AsyncSession,
    *,
    code: str,
    certification_id: uuid.UUID,
    user: User | None = None,
) -> ExamCheckout:
    """Open checkout for an exam at the price a code unlocks.

    The amount is recomputed here from the certification and the live pricing
    rules; nothing about the price comes from the request, so a holder of a
    valid code cannot name their own.

    Unlike the challenge route, an abandoned checkout is not reopened: this
    route asks for no contact details, so there is nobody to match a pending
    order back to and a shared order would let one visitor pay another's.
    """
    certification, quote = await _priced(db, certification_id)
    coupon = await _coupon(db, code)
    if not _usable(coupon, certification_id):
        raise ValidationFailedError(_REFUSED)
    if quote is None or quote.total_price_amount <= 0:
        raise ValidationFailedError(
            "This exam does not have a published fee yet, so it cannot be paid "
            "for online. Our team will confirm the price with you."
        )

    started = await payment_service.start_exam_checkout(
        db,
        amount=quote.total_price_amount,
        currency=quote.currency,
        description=f"{certification.name} exam (code {coupon.code})",
        # No contact step on this route, so the provider's own form collects
        # them. Empty prefills leave those fields blank rather than wrong.
        payer_name=user.name if user else "",
        payer_email=user.email if user else "",
        payer_phone=(user.phone or "") if user else "",
        user_id=user.id if user else None,
        certification_id=certification.id,
        exam_coupon_id=coupon.id,
        raise_on_failure=True,
    )
    if started is None:  # pragma: no cover -- raise_on_failure leaves no other path
        raise ValidationFailedError("We could not open the payment window.")
    _payment, checkout = started
    await db.commit()
    return checkout


# --- Staff -------------------------------------------------------------------
def _row(coupon: ExamCoupon) -> ExamCouponRow:
    return ExamCouponRow(
        id=coupon.id,
        code=coupon.code,
        description=coupon.description,
        owner_name=coupon.owner_name,
        owner_email=coupon.owner_email,
        certification_id=coupon.certification_id,
        certification_name=coupon.certification.name if coupon.certification else None,
        is_active=coupon.is_active,
        starts_at=coupon.starts_at,
        expires_at=coupon.expires_at,
        max_redemptions=coupon.max_redemptions,
        redemption_count=coupon.redemption_count,
        status=_status(coupon),
        created_at=coupon.created_at,
    )


async def list_coupons(db: AsyncSession) -> list[ExamCouponRow]:
    rows = await db.scalars(
        select(ExamCoupon)
        .options(selectinload(ExamCoupon.certification))
        .order_by(ExamCoupon.created_at.desc())
    )
    return [_row(row) for row in rows]


# Lookalike characters are left out on purpose: a code is read off a video,
# a story or a slide and typed from memory, so O/0 and I/1/L cost redemptions.
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_SUFFIX_LENGTH = 5


def _slug(name: str) -> str:
    """The owner's name, reduced to something that reads well in a code."""
    kept = [character for character in name.upper() if character.isalnum()]
    return "".join(kept)[:12]


async def generate_code(db: AsyncSession, owner_name: str | None = None) -> str:
    """A code that is not in use, prefixed with the owner's name when there is one.

    Checked against the table rather than trusted to be unique: the suffix is
    short by design, because a code nobody can retype is worth nothing, and
    short means collisions are possible.
    """
    prefix = _slug(owner_name or "")
    for _ in range(12):
        suffix = "".join(secrets.choice(_ALPHABET) for _ in range(_SUFFIX_LENGTH))
        candidate = f"{prefix}-{suffix}" if prefix else f"GC-{suffix}"
        if not await db.scalar(
            select(func.count()).select_from(ExamCoupon).where(ExamCoupon.code == candidate)
        ):
            return candidate
    # Every short candidate collided, which means this prefix is crowded.
    # Fall back to one long enough that it cannot.
    return f"{prefix or 'GC'}-{secrets.token_hex(6).upper()}"


async def _assert_code_free(
    db: AsyncSession, code: str, *, exclude: uuid.UUID | None = None
) -> None:
    query = select(func.count()).select_from(ExamCoupon).where(ExamCoupon.code == code)
    if exclude is not None:
        query = query.where(ExamCoupon.id != exclude)
    if await db.scalar(query):
        raise ConflictError("A coupon with that code already exists.")


async def create_coupon(db: AsyncSession, payload: ExamCouponWrite) -> ExamCouponRow:
    await _assert_code_free(db, payload.code)
    coupon = ExamCoupon(**payload.model_dump())
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon, ["certification"])
    return _row(coupon)


async def update_coupon(
    db: AsyncSession, coupon_id: uuid.UUID, payload: ExamCouponWrite
) -> ExamCouponRow:
    coupon = await db.get(ExamCoupon, coupon_id)
    if coupon is None:
        raise NotFoundError("That coupon could not be found.")
    await _assert_code_free(db, payload.code, exclude=coupon.id)
    for field, value in payload.model_dump().items():
        setattr(coupon, field, value)
    await db.commit()
    await db.refresh(coupon, ["certification"])
    return _row(coupon)


async def delete_coupon(db: AsyncSession, coupon_id: uuid.UUID) -> None:
    coupon = await db.get(ExamCoupon, coupon_id)
    if coupon is None:
        raise NotFoundError("That coupon could not be found.")
    await db.delete(coupon)
    await db.commit()
