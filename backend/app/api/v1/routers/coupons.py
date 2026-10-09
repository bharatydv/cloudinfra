import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Request, status

from app.core.deps import AdminUser, DbSession, OptionalUser
from app.core.rate_limit import limiter
from app.schemas.commerce import (
    ExamCouponQuote,
    ExamCouponRedeemRequest,
    ExamCouponRow,
    ExamCouponWrite,
    GeneratedCode,
)
from app.schemas.common import Message
from app.schemas.system import ExamCheckout
from app.services import coupon_service

router = APIRouter(prefix="/exam-coupons", tags=["Exam coupons"])


@router.post("/redeem", response_model=ExamCouponQuote)
# Tighter than the checkout limit below: this endpoint answers "is this code
# real", so it is the one worth guessing against.
@limiter.limit("10/minute")
async def redeem_coupon(
    request: Request, payload: ExamCouponRedeemRequest, db: DbSession
) -> ExamCouponQuote:
    """Check a code against one exam and quote the price it unlocks.

    Spends nothing: a code is only counted as redeemed once the payment behind
    it clears. Every refusal gives the same message, so the endpoint cannot be
    used to tell a wrong code from an expired one.
    """
    return await coupon_service.redeem(
        db, code=payload.code, certification_id=payload.certification_id
    )


@router.post("/checkout", response_model=ExamCheckout)
@limiter.limit("20/minute")
async def start_coupon_checkout(
    request: Request,
    payload: ExamCouponRedeemRequest,
    db: DbSession,
    user: OptionalUser,
) -> ExamCheckout:
    """Pay the exam fee at the price a code unlocks.

    Open to signed-out visitors: the code is the authorisation. The amount is
    recomputed server-side from the certification and the live pricing rules,
    so a holder of a valid code cannot name their own price, and only the
    signed provider webhook can mark it paid.
    """
    return await coupon_service.start_checkout(
        db, code=payload.code, certification_id=payload.certification_id, user=user
    )


# --- Staff -------------------------------------------------------------------
@router.get("/admin", response_model=list[ExamCouponRow], tags=["Admin"])
async def admin_list_coupons(db: DbSession, _: AdminUser) -> list[ExamCouponRow]:
    return await coupon_service.list_coupons(db)


@router.get("/admin/generate", response_model=GeneratedCode, tags=["Admin"])
async def admin_generate_code(
    db: DbSession,
    _: AdminUser,
    owner_name: Annotated[str | None, Query(max_length=120)] = None,
) -> GeneratedCode:
    """Suggest an unused code, prefixed with the owner's name when given.

    Generated here rather than in the browser so the suggestion can be checked
    against the table before it is offered.
    """
    return GeneratedCode(code=await coupon_service.generate_code(db, owner_name))


@router.post(
    "/admin",
    response_model=ExamCouponRow,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin"],
)
async def admin_create_coupon(
    payload: ExamCouponWrite, db: DbSession, _: AdminUser
) -> ExamCouponRow:
    return await coupon_service.create_coupon(db, payload)


@router.put("/admin/{coupon_id}", response_model=ExamCouponRow, tags=["Admin"])
async def admin_update_coupon(
    coupon_id: uuid.UUID, payload: ExamCouponWrite, db: DbSession, _: AdminUser
) -> ExamCouponRow:
    return await coupon_service.update_coupon(db, coupon_id, payload)


@router.delete("/admin/{coupon_id}", response_model=Message, tags=["Admin"])
async def admin_delete_coupon(
    coupon_id: uuid.UUID, db: DbSession, _: AdminUser
) -> Message:
    await coupon_service.delete_coupon(db, coupon_id)
    return Message(message="Coupon deleted.")
