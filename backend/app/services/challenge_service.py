"""The certification challenge: papers, proctoring and grading.

Everything that decides an outcome lives here and nowhere else. The browser
reports what happened -- an answer chosen, a tab switched away from -- and this
module decides what it means. Nothing the client sends is trusted as a fact
about the result:

  * the paper is drawn here and frozen onto the attempt, so a client cannot
    enlarge, reshuffle or re-roll its own questions;
  * correct answers are never serialised into an open paper, so the score
    cannot be computed (or forged) in the browser;
  * the deadline is a stored timestamp, so stopping the client-side timer buys
    no extra time;
  * warnings are counted on the row, so refreshing the page does not clear them.

Passing does not discount anything by itself. It records a promise -- captured
on the attempt as `discount_percentage` -- that the team honours on a call.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from random import SystemRandom

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.errors import NotFoundError, ValidationFailedError
from app.models.campaign import ChallengeAttempt, ChallengeQuestion
from app.models.certification import Certification, CertificationProvider
from app.models.enums import (
    ChallengeAttemptStatus,
    ChallengeLeadStatus,
    ChallengeViolationKind,
)
from app.models.user import User
from app.repositories import campaign_repo, misc_repo
from app.schemas.campaign import (
    ChallengeCertificationOption,
    ChallengeIntro,
    ChallengeOptionPublic,
    ChallengeQuestionPublic,
    ChallengeResult,
    ChallengeReviewItem,
    ChallengeSession,
    ChallengeStart,
    ChallengeSubmit,
    ChallengeTerms,
    ChallengeWarningReceipt,
)
from app.services import email as email_service
from app.services import pricing

logger = logging.getLogger(__name__)

SETTING_KEY = "challenge"

# Same alphabet as exam booking references: no vowels and no 0/1/I/O, because a
# code is read out over the phone as often as it is copied.
_CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY2345679"

# A submission that arrives within this window of the deadline is treated as
# on time. It absorbs network latency and a slow tab, not extra study.
_SUBMIT_GRACE_SECONDS = 90

_CENTS = Decimal("0.01")
_random = SystemRandom()


# --- Configuration -----------------------------------------------------------
@dataclass(frozen=True, slots=True)
class ChallengeConfig:
    """Campaign terms, editable from Admin > Settings under the `challenge` key."""

    enabled: bool = True
    provider_slug: str = "google-cloud"
    question_count: int = 20
    duration_minutes: int = 25
    pass_mark: Decimal = Decimal("70.00")
    reward_discount_percentage: Decimal = Decimal("20.00")
    max_warnings: int = 3
    retake_after_days: int = 7
    response_hours: int = 24

    @classmethod
    def from_setting(cls, value: dict | None) -> ChallengeConfig:
        if not value:
            return cls()
        default = cls()
        return cls(
            enabled=bool(value.get("enabled", default.enabled)),
            provider_slug=str(value.get("providerSlug") or default.provider_slug),
            question_count=_bounded(
                value.get("questionCount"), default.question_count, 1, 100
            ),
            duration_minutes=_bounded(
                value.get("durationMinutes"), default.duration_minutes, 1, 240
            ),
            pass_mark=_percent(value.get("passMark"), default=default.pass_mark),
            reward_discount_percentage=_percent(
                value.get("rewardDiscountPercentage"),
                default=default.reward_discount_percentage,
            ),
            max_warnings=_bounded(
                value.get("maxWarnings"), default.max_warnings, 1, 20
            ),
            retake_after_days=_bounded(
                value.get("retakeAfterDays"), default.retake_after_days, 0, 365
            ),
            response_hours=_bounded(
                value.get("responseHours"), default.response_hours, 1, 240
            ),
        )

    @property
    def terms(self) -> ChallengeTerms:
        return ChallengeTerms(
            enabled=self.enabled,
            question_count=self.question_count,
            duration_minutes=self.duration_minutes,
            pass_mark=self.pass_mark,
            reward_discount_percentage=self.reward_discount_percentage,
            max_warnings=self.max_warnings,
            retake_after_days=self.retake_after_days,
            response_hours=self.response_hours,
        )


def _plain(value: Decimal) -> str:
    """Render a percentage for humans: 80.00 -> "80", 87.50 -> "87.5".

    `Decimal.normalize()` alone is not usable here -- it renders an integral
    value in scientific notation ("8E+1"), which is how "80% off" reaches a
    candidate as "8E+1% off".
    """
    trimmed = value.normalize()
    if trimmed == trimmed.to_integral_value():
        trimmed = trimmed.quantize(Decimal(1))
    return f"{trimmed}"


def _bounded(value: object, default: int, low: int, high: int) -> int:
    try:
        result = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    return min(max(result, low), high)


def _percent(value: object, *, default: Decimal) -> Decimal:
    """Coerce a JSON number to a percentage clamped to 0-100, quantized to 2dp."""
    try:
        result = Decimal(str(value))
    except (TypeError, ValueError, ArithmeticError):
        return default
    if not result.is_finite():
        return default
    return min(max(result, Decimal(0)), Decimal(100)).quantize(
        _CENTS, rounding=ROUND_HALF_UP
    )


# Read on every landing-page view and every submission; an admin edit shows up
# within the TTL. Mirrors how `pricing` caches its own setting.
_CACHE_TTL_SECONDS = 30.0
_cache: tuple[float, ChallengeConfig] | None = None


async def load_config(db: AsyncSession) -> ChallengeConfig:
    global _cache
    now = time.monotonic()
    if _cache and now - _cache[0] < _CACHE_TTL_SECONDS:
        return _cache[1]

    setting = await misc_repo.get_setting(db, SETTING_KEY)
    config = ChallengeConfig.from_setting(setting.value if setting else None)
    _cache = (now, config)
    return config


def reset_cache() -> None:
    """Drop the cached config. Called when an admin saves the setting."""
    global _cache
    _cache = None


# --- Landing screen ----------------------------------------------------------
async def build_intro(db: AsyncSession) -> ChallengeIntro:
    config = await load_config(db)
    provider = await db.scalar(
        select(CertificationProvider).where(
            CertificationProvider.slug == config.provider_slug
        )
    )
    if provider is None:
        return ChallengeIntro(
            terms=config.terms, provider_name="Google Cloud", options=[]
        )

    price_config = await pricing.load_config(db)
    per_certification, shared = await campaign_repo.pool_sizes(
        db, provider_slug=config.provider_slug
    )
    rows = await db.scalars(
        select(Certification)
        .where(
            Certification.provider_id == provider.id,
            Certification.is_published.is_(True),
        )
        .order_by(Certification.position, Certification.name)
    )

    options: list[ChallengeCertificationOption] = []
    for row in rows:
        available = per_certification.get(row.id, 0) + shared
        # A certification with no drawable paper is not offered at all, rather
        # than offered and then failing at start time.
        if available <= 0:
            continue
        options.append(
            ChallengeCertificationOption(
                id=row.id,
                name=row.name,
                exam_code=row.exam_code,
                level=row.level,
                url=f"/certifications/{provider.slug}/{row.slug}",
                question_count=min(available, config.question_count),
                pricing=pricing.compute(
                    exam_fee_amount=row.exam_fee_amount,
                    currency=row.exam_fee_currency,
                    fee_checked_on=row.exam_fee_checked_on,
                    discount_override=row.discount_percentage,
                    config=price_config,
                ),
            )
        )

    return ChallengeIntro(
        terms=config.terms, provider_name=provider.name, options=options
    )


# --- Starting a paper --------------------------------------------------------
async def _unique_reference_code(db: AsyncSession) -> str:
    for _ in range(5):
        code = "GC-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
        if not await campaign_repo.reference_code_exists(db, code):
            return code
    raise ValidationFailedError("Could not allocate a reference code. Please try again.")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _draw_paper(
    pool: list[ChallengeQuestion], *, certification_id: uuid.UUID, wanted: int
) -> list[ChallengeQuestion]:
    """Pick the questions for one sitting.

    Exam-specific questions are exhausted before the provider-wide pool is used,
    so a paper is as close to its certification as the bank allows. Both groups
    are shuffled, which is what makes two sittings of the same exam differ.
    """
    specific = [q for q in pool if q.certification_id == certification_id]
    shared = [q for q in pool if q.certification_id is None]
    _random.shuffle(specific)
    _random.shuffle(shared)

    paper = specific[:wanted]
    if len(paper) < wanted:
        paper += shared[: wanted - len(paper)]
    # Interleave so the shared questions are not all at the end, which would
    # otherwise signal which ones are exam-specific.
    _random.shuffle(paper)
    return paper


async def start(
    db: AsyncSession,
    payload: ChallengeStart,
    *,
    user: User | None = None,
    source_ip: str | None = None,
) -> ChallengeSession:
    if payload.website:
        # Honeypot tripped -- almost certainly a bot.
        raise ValidationFailedError("Your request could not be submitted.")

    config = await load_config(db)
    if not config.enabled:
        raise ValidationFailedError("The challenge is not open at the moment.")

    certification = await db.scalar(
        select(Certification)
        .options(selectinload(Certification.provider))
        .where(Certification.id == payload.certification_id)
    )
    if (
        certification is None
        or not certification.is_published
        or certification.provider.slug != config.provider_slug
    ):
        raise NotFoundError("That certification is not part of this challenge.")

    email = str(payload.email).strip().lower()
    await _guard_retake(db, email, config)

    pool = await campaign_repo.pool_for(
        db, provider_slug=config.provider_slug, certification_id=certification.id
    )
    paper = _draw_paper(
        pool, certification_id=certification.id, wanted=config.question_count
    )
    if not paper:
        raise ValidationFailedError(
            "No questions are available for that certification yet."
        )

    token = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    attempt = ChallengeAttempt(
        user_id=user.id if user else None,
        full_name=payload.full_name.strip(),
        email=email,
        phone=payload.phone.strip(),
        country=payload.country.strip() if payload.country else None,
        certification_id=certification.id,
        certification_name=certification.name,
        exam_code=certification.exam_code,
        question_ids=[str(question.id) for question in paper],
        answers={},
        token_hash=_hash_token(token),
        started_at=now,
        expires_at=now + timedelta(minutes=config.duration_minutes),
        reference_code=await _unique_reference_code(db),
        question_count=len(paper),
        pass_mark=config.pass_mark,
        source_ip=source_ip,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    return ChallengeSession(
        attempt_id=attempt.id,
        token=token,
        reference_code=attempt.reference_code,
        certification_name=attempt.certification_name,
        exam_code=attempt.exam_code,
        started_at=attempt.started_at,
        expires_at=attempt.expires_at,
        duration_seconds=config.duration_minutes * 60,
        max_warnings=config.max_warnings,
        pass_mark=config.pass_mark,
        reward_discount_percentage=config.reward_discount_percentage,
        questions=[
            ChallengeQuestionPublic(
                id=question.id,
                position=index + 1,
                prompt=question.prompt,
                topic=question.topic,
                options=[
                    ChallengeOptionPublic(key=str(opt.get("key")), text=str(opt.get("text")))
                    for opt in question.options
                ],
            )
            for index, question in enumerate(paper)
        ],
    )


async def _guard_retake(
    db: AsyncSession, email: str, config: ChallengeConfig
) -> None:
    """Refuse a new paper while a cooldown or an open sitting is in the way.

    The cooldown runs from the last *submission*, so abandoning a paper to see
    a fresh set of questions does not reset it. An unexpired sitting blocks a
    second one outright, which stops the bank being farmed a paper at a time.
    """
    now = datetime.now(UTC)
    open_attempt = await db.scalar(
        select(ChallengeAttempt).where(
            ChallengeAttempt.email == email,
            ChallengeAttempt.status == ChallengeAttemptStatus.IN_PROGRESS.value,
            ChallengeAttempt.expires_at > now,
        )
    )
    if open_attempt is not None:
        raise ValidationFailedError(
            "You already have a test in progress. Finish it, or wait for it to "
            "time out before starting another."
        )

    if config.retake_after_days <= 0:
        return
    last = await campaign_repo.last_submission_for(db, email)
    if last is None:
        return
    if last.tzinfo is None:
        last = last.replace(tzinfo=UTC)
    next_allowed = last + timedelta(days=config.retake_after_days)
    if now < next_allowed:
        raise ValidationFailedError(
            f"You have already taken this test. You can try again after "
            f"{next_allowed.date().isoformat()}."
        )


# --- Proctoring --------------------------------------------------------------
async def _authorise(
    db: AsyncSession, attempt_id: uuid.UUID, token: str
) -> ChallengeAttempt:
    attempt = await campaign_repo.get_attempt(db, attempt_id)
    # The same error either way: a wrong id and a wrong token must not be
    # distinguishable, or the attempt id becomes an enumeration oracle.
    if attempt is None or not secrets.compare_digest(
        attempt.token_hash, _hash_token(token)
    ):
        raise NotFoundError("That test session could not be found.")
    return attempt


async def record_warning(
    db: AsyncSession,
    attempt_id: uuid.UUID,
    *,
    token: str,
    kind: ChallengeViolationKind,
) -> ChallengeWarningReceipt:
    """Count one proctoring violation and say what the browser should do next."""
    config = await load_config(db)
    attempt = await _authorise(db, attempt_id, token)

    if attempt.status != ChallengeAttemptStatus.IN_PROGRESS.value:
        # Already finished: report the final count rather than failing, so a
        # late event from a closing tab cannot error in the candidate's face.
        return _warning_receipt(attempt.warnings, config)

    attempt.warnings = min(attempt.warnings + 1, config.max_warnings)
    attempt.violations = [
        *attempt.violations,
        {"kind": kind.value, "at": datetime.now(UTC).isoformat()},
    ]
    await db.commit()
    await db.refresh(attempt)
    return _warning_receipt(attempt.warnings, config)


def _warning_receipt(warnings: int, config: ChallengeConfig) -> ChallengeWarningReceipt:
    remaining = max(config.max_warnings - warnings, 0)
    terminated = warnings >= config.max_warnings
    if terminated:
        message = (
            "Final warning reached. Your test has been submitted and will be "
            "graded on the answers you gave."
        )
    else:
        message = (
            f"Warning {warnings} of {config.max_warnings}. Leaving the test "
            f"window or copying text is not allowed. "
            f"{remaining} warning{'s' if remaining != 1 else ''} left."
        )
    return ChallengeWarningReceipt(
        warnings=warnings,
        max_warnings=config.max_warnings,
        remaining=remaining,
        message=message,
        terminated=terminated,
    )


# --- Grading -----------------------------------------------------------------
async def submit(
    db: AsyncSession, attempt_id: uuid.UUID, payload: ChallengeSubmit
) -> ChallengeResult:
    config = await load_config(db)
    attempt = await _authorise(db, attempt_id, payload.token)

    if attempt.status != ChallengeAttemptStatus.IN_PROGRESS.value:
        # Resubmission -- a double-clicked button, or a retry after a dropped
        # response. Return the result already recorded rather than regrading.
        return await _build_result(db, attempt, config)

    expires_at = attempt.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    now = datetime.now(UTC)
    late = now > expires_at + timedelta(seconds=_SUBMIT_GRACE_SECONDS)

    served = {qid for qid in attempt.question_ids}
    # Answers to questions that were never served are dropped rather than
    # rejected: the paper on the row is the only paper there is.
    answers = {
        str(item.question_id): item.option_key
        for item in payload.answers
        if str(item.question_id) in served
    }

    questions = await campaign_repo.questions_by_ids(
        db, [uuid.UUID(qid) for qid in attempt.question_ids]
    )
    correct = sum(
        1
        for qid, choice in answers.items()
        if (question := questions.get(uuid.UUID(qid))) is not None
        and question.correct_option == choice
    )

    total = attempt.question_count or len(attempt.question_ids) or 1
    score = (Decimal(correct) / Decimal(total) * 100).quantize(
        _CENTS, rounding=ROUND_HALF_UP
    )
    # Running out of time forfeits the reward; the score is still shown, and
    # still recorded, so the conversation with the team has something in it.
    passed = (not late) and score >= config.pass_mark

    attempt.answers = answers
    attempt.correct_count = correct
    attempt.score_percentage = score
    attempt.passed = passed
    attempt.pass_mark = config.pass_mark
    attempt.discount_percentage = (
        config.reward_discount_percentage if passed else None
    )
    attempt.auto_submitted = payload.auto_submitted or late
    attempt.submitted_at = now
    attempt.status = (
        ChallengeAttemptStatus.EXPIRED.value
        if late
        else ChallengeAttemptStatus.SUBMITTED.value
    )
    attempt.lead_status = ChallengeLeadStatus.NEW.value
    await db.commit()
    await db.refresh(attempt)

    result = await _build_result(db, attempt, config, questions=questions)
    await _send_result_emails(attempt, result, config)
    return result


async def _build_result(
    db: AsyncSession,
    attempt: ChallengeAttempt,
    config: ChallengeConfig,
    *,
    questions: dict[uuid.UUID, ChallengeQuestion] | None = None,
) -> ChallengeResult:
    if questions is None:
        questions = await campaign_repo.questions_by_ids(
            db, [uuid.UUID(qid) for qid in attempt.question_ids]
        )

    review: list[ChallengeReviewItem] = []
    for index, qid in enumerate(attempt.question_ids):
        question = questions.get(uuid.UUID(qid))
        if question is None:
            # The bank was edited after the sitting; the row keeps its score,
            # the review simply has one fewer line.
            continue
        selected = attempt.answers.get(qid)
        review.append(
            ChallengeReviewItem(
                question_id=question.id,
                position=index + 1,
                prompt=question.prompt,
                topic=question.topic,
                options=[
                    ChallengeOptionPublic(key=str(opt.get("key")), text=str(opt.get("text")))
                    for opt in question.options
                ],
                selected_option=selected,
                correct_option=question.correct_option,
                is_correct=selected == question.correct_option,
                explanation=question.explanation,
            )
        )

    quote = None
    rewarded_price = None
    if attempt.certification_id:
        certification = await db.scalar(
            select(Certification).where(Certification.id == attempt.certification_id)
        )
        if certification is not None:
            price_config = await pricing.load_config(db)
            quote = pricing.compute(
                exam_fee_amount=certification.exam_fee_amount,
                currency=certification.exam_fee_currency,
                fee_checked_on=certification.exam_fee_checked_on,
                discount_override=certification.discount_percentage,
                config=price_config,
            )
    if quote is not None and attempt.discount_percentage:
        # Quoted against the price the visitor is already shown, so the reward
        # reads as a further saving rather than a different set of numbers.
        reward = quote.total_price_amount * attempt.discount_percentage / 100
        rewarded_price = (quote.total_price_amount - reward).quantize(
            _CENTS, rounding=ROUND_HALF_UP
        )

    score = attempt.score_percentage or Decimal("0.00")
    passed = bool(attempt.passed)
    expired = attempt.status == ChallengeAttemptStatus.EXPIRED.value

    if passed:
        headline = f"You passed with {_plain(score)}%"
        message = (
            f"You have earned {_plain(attempt.discount_percentage)}% off the "
            f"{attempt.certification_name} exam. Our team will call you within "
            f"{config.response_hours} hours to confirm the discount and book your "
            "slot on the date you want."
        )
    elif expired:
        headline = "Your time ran out"
        message = (
            f"You scored {_plain(score)}%, but the test was submitted after the "
            f"time limit, so the discount was not applied. You can take it again "
            f"after {config.retake_after_days} days."
        )
    else:
        headline = f"You scored {_plain(score)}%"
        message = (
            f"The pass mark is {_plain(config.pass_mark)}%. You can take the test "
            f"again after {config.retake_after_days} days -- your review below shows "
            "exactly which topics to work on first."
        )

    return ChallengeResult(
        reference_code=attempt.reference_code,
        certification_name=attempt.certification_name,
        exam_code=attempt.exam_code,
        question_count=attempt.question_count,
        correct_count=attempt.correct_count,
        score_percentage=score,
        pass_mark=attempt.pass_mark or config.pass_mark,
        passed=passed,
        discount_percentage=attempt.discount_percentage,
        warnings=attempt.warnings,
        auto_submitted=attempt.auto_submitted,
        response_hours=config.response_hours,
        retake_after_days=config.retake_after_days,
        headline=headline,
        message=message,
        pricing=quote,
        rewarded_price=rewarded_price,
        review=review,
    )


async def _send_result_emails(
    attempt: ChallengeAttempt, result: ChallengeResult, config: ChallengeConfig
) -> None:
    """Mail the candidate, and the sales inbox when there is a lead to call.

    Delivery must not decide whether a graded attempt counts: the score is
    already committed, so a provider outage is logged and swallowed.
    """
    try:
        subject, body = email_service.challenge_result_email(
            name=attempt.full_name,
            certification_name=attempt.certification_name,
            reference_code=attempt.reference_code,
            score=f"{_plain(result.score_percentage)}%",
            correct_count=result.correct_count,
            question_count=result.question_count,
            passed=result.passed,
            discount_percentage=(
                f"{_plain(attempt.discount_percentage)}%"
                if attempt.discount_percentage
                else None
            ),
            response_hours=config.response_hours,
            retake_after_days=config.retake_after_days,
            warnings=attempt.warnings,
        )
        await email_service.send_email(attempt.email, subject, body)
    except Exception:
        logger.exception(
            "Could not email the challenge result for %s", attempt.reference_code
        )

    if not settings.sales_notification_email or not result.passed:
        return
    try:
        subject, body = email_service.challenge_lead_email(
            name=attempt.full_name,
            email=attempt.email,
            phone=attempt.phone,
            certification_name=attempt.certification_name,
            score=f"{_plain(result.score_percentage)}%",
            discount_percentage=f"{_plain(attempt.discount_percentage)}%",
            reference_code=attempt.reference_code,
            response_hours=config.response_hours,
        )
        await email_service.send_email(
            settings.sales_notification_email, subject, body
        )
    except Exception:
        logger.exception(
            "Could not notify sales about challenge lead %s", attempt.reference_code
        )


# --- Admin -------------------------------------------------------------------
async def update_attempt(
    db: AsyncSession, attempt_id: uuid.UUID, payload
) -> ChallengeAttempt:
    attempt = await campaign_repo.get_attempt(db, attempt_id)
    if attempt is None:
        raise NotFoundError("Test attempt not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(attempt, field, value.value if hasattr(value, "value") else value)
    await db.commit()
    await db.refresh(attempt)
    return attempt


async def delete_attempt(db: AsyncSession, attempt_id: uuid.UUID) -> None:
    attempt = await campaign_repo.get_attempt(db, attempt_id)
    if attempt is None:
        raise NotFoundError("Test attempt not found.")
    await db.delete(attempt)
    await db.commit()
