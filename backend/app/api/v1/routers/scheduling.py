from fastapi import APIRouter, Depends, Request, status

from app.core.deps import DbSession, OptionalUser, client_ip
from app.core.rate_limit import limiter
from app.schemas.scheduling import (
    CertificationOption,
    ExamBookingCreate,
    ExamBookingReceipt,
)
from app.services import scheduling_service

router = APIRouter(tags=["Exam scheduling"])


@router.get("/exam-bookings/options", response_model=list[CertificationOption])
async def scheduling_options(db: DbSession) -> list[CertificationOption]:
    """Published certifications the scheduling form can be submitted against."""
    return await scheduling_service.list_options(db)


@router.post(
    "/exam-bookings",
    response_model=ExamBookingReceipt,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def submit_exam_booking(
    request: Request,
    payload: ExamBookingCreate,
    db: DbSession,
    user: OptionalUser,
    ip: str | None = Depends(client_ip),
) -> ExamBookingReceipt:
    """Record an exam scheduling request.

    Open to signed-out visitors; a signed-in request is linked to the account so
    the admin console can group requests by learner.
    """
    booking, url = await scheduling_service.submit(db, payload, user=user, source_ip=ip)
    return scheduling_service.build_receipt(booking, url)
