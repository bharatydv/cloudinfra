import uuid

from fastapi import APIRouter, Depends, Request, status

from app.core.deps import DbSession, OptionalUser, client_ip
from app.core.rate_limit import limiter
from app.schemas.campaign import (
    ChallengeIntro,
    ChallengeResult,
    ChallengeSession,
    ChallengeStart,
    ChallengeSubmit,
    ChallengeWarningReceipt,
    ChallengeWarningReport,
)
from app.services import challenge_service

router = APIRouter(prefix="/challenge", tags=["Certification challenge"])


@router.get("", response_model=ChallengeIntro)
async def challenge_intro(db: DbSession) -> ChallengeIntro:
    """Campaign terms and the certifications the test can be sat for."""
    return await challenge_service.build_intro(db)


@router.post(
    "/attempts", response_model=ChallengeSession, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minute")
async def start_attempt(
    request: Request,
    payload: ChallengeStart,
    db: DbSession,
    user: OptionalUser,
    ip: str | None = Depends(client_ip),
) -> ChallengeSession:
    """Open a paper and hand back the questions plus a one-time session token.

    Open to signed-out visitors -- the email captured here is the campaign's
    output. The token in the response is the only copy: it authorises the
    warning and submit calls for a guest who has no session to authenticate
    with, and is stored server-side only as a hash.
    """
    return await challenge_service.start(db, payload, user=user, source_ip=ip)


@router.post("/attempts/{attempt_id}/warnings", response_model=ChallengeWarningReceipt)
@limiter.limit("60/minute")
async def report_warning(
    request: Request,
    attempt_id: uuid.UUID,
    payload: ChallengeWarningReport,
    db: DbSession,
) -> ChallengeWarningReceipt:
    """Record one proctoring violation and say whether the paper is now over.

    Counted on the server so that reloading the page, or reopening the tab,
    does not reset a candidate's warnings.
    """
    return await challenge_service.record_warning(
        db, attempt_id, token=payload.token, kind=payload.kind
    )


@router.post("/attempts/{attempt_id}/submit", response_model=ChallengeResult)
@limiter.limit("20/minute")
async def submit_attempt(
    request: Request,
    attempt_id: uuid.UUID,
    payload: ChallengeSubmit,
    db: DbSession,
) -> ChallengeResult:
    """Grade the paper, email the result and record the lead.

    This is the first and only point at which correct answers are disclosed.
    """
    return await challenge_service.submit(db, attempt_id, payload)
