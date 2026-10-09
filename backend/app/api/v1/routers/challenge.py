import uuid

from fastapi import APIRouter, Depends, Request, status

from app.core.deps import CurrentUser, DbSession, OptionalUser, client_ip
from app.core.rate_limit import limiter
from app.schemas.campaign import (
    ChallengeAttemptSummary,
    ChallengeCheckoutRequest,
    ChallengeIntro,
    ChallengeResult,
    ChallengeSession,
    ChallengeStart,
    ChallengeSubmit,
    ChallengeWarningReceipt,
    ChallengeWarningReport,
    ContactVerificationConfirm,
    ContactVerificationReceipt,
    ContactVerificationRequest,
    ContactVerificationStatus,
)
from app.schemas.system import ExamCheckout
from app.services import challenge_service, verification_service

router = APIRouter(prefix="/challenge", tags=["Certification challenge"])


@router.get("", response_model=ChallengeIntro)
async def challenge_intro(db: DbSession) -> ChallengeIntro:
    """Campaign terms and the certifications the test can be sat for."""
    return await challenge_service.build_intro(db)


@router.post("/verification/request", response_model=ContactVerificationReceipt)
@limiter.limit("5/minute")
async def request_contact_code(
    request: Request,
    payload: ContactVerificationRequest,
    db: DbSession,
    ip: str | None = Depends(client_ip),
) -> ContactVerificationReceipt:
    """Send a one-time code to an email address or phone number.

    A guest proves both before a paper is issued; a fresh request retires any
    code still pending for the same address.
    """
    target = verification_service.normalize_target(payload.channel, payload.target)
    minutes = await verification_service.request_code(
        db, payload.channel, target, source_ip=ip
    )
    return ContactVerificationReceipt(
        channel=payload.channel, target=target, expires_in_minutes=minutes
    )


@router.post("/verification/confirm", response_model=ContactVerificationStatus)
@limiter.limit("10/minute")
async def confirm_contact_code(
    request: Request, payload: ContactVerificationConfirm, db: DbSession
) -> ContactVerificationStatus:
    """Check a code against the latest one sent to that address."""
    target = verification_service.normalize_target(payload.channel, payload.target)
    await verification_service.confirm_code(db, payload.channel, target, payload.code)
    return ContactVerificationStatus(channel=payload.channel, target=target, verified=True)


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


@router.get("/attempts/mine", response_model=list[ChallengeAttemptSummary])
async def my_attempts(db: DbSession, user: CurrentUser) -> list[ChallengeAttemptSummary]:
    """Every test this learner has sat, with what each one earned.

    Includes papers sat before registering, matched on the account's email, so
    the dashboard does not lose a result to having been a guest at the time.
    """
    return await challenge_service.list_my_attempts(db, user)


@router.post("/attempts/{attempt_id}/checkout", response_model=ExamCheckout)
@limiter.limit("20/minute")
async def start_attempt_checkout(
    request: Request,
    attempt_id: uuid.UUID,
    payload: ChallengeCheckoutRequest,
    db: DbSession,
    user: OptionalUser,
) -> ExamCheckout:
    """Pay the exam fee at the discount a passed paper earned.

    Open to signed-out candidates, who authorise with the session token from
    their sitting; a signed-in owner needs none. The amount is recomputed
    server-side, and only the signed provider webhook can mark it paid.
    """
    return await challenge_service.start_checkout(
        db, attempt_id, token=payload.token, user=user
    )
