"""Request and response bodies for the certification challenge.

The split between `ChallengeQuestionPublic` and `ChallengeReviewItem` is the
security boundary of the whole feature: the first is what a browser may see
while the paper is open, the second only ever appears in a graded result. The
correct answer has no schema that can reach an unsubmitted attempt.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import ChallengeLeadStatus, ChallengeViolationKind
from app.schemas.certification import ExamPricing
from app.schemas.common import ORMModel


class ChallengeTerms(BaseModel):
    """The campaign rules, as quoted to the visitor before they start.

    Sent to the browser so the start screen, the timer and the warning counter
    all read from the same numbers the grader will use.
    """

    enabled: bool
    question_count: int
    duration_minutes: int
    pass_mark: Decimal
    reward_discount_percentage: Decimal
    max_warnings: int
    retake_after_days: int
    response_hours: int


class ChallengeCertificationOption(BaseModel):
    """A certification the challenge can be sat for."""

    id: uuid.UUID
    name: str
    exam_code: str | None = None
    level: str
    url: str
    question_count: int
    # Carried so the start screen can show what the reward is worth in money
    # without a second request per selection. None when the exam has no price.
    pricing: ExamPricing | None = None


class ChallengeIntro(BaseModel):
    """Everything the landing screen needs in one request."""

    terms: ChallengeTerms
    provider_name: str
    options: list[ChallengeCertificationOption]


class ChallengeStart(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=40)
    country: str | None = Field(default=None, max_length=80)
    certification_id: uuid.UUID
    # The applicant has to accept the proctoring rules to sit the paper; the
    # warnings are only defensible if they were disclosed up front.
    accept_rules: bool = False

    # Honeypot: real users never fill this in.
    website: str | None = Field(default=None, max_length=200)

    @field_validator("accept_rules")
    @classmethod
    def _must_accept(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Please accept the test rules before starting.")
        return value


class ChallengeOptionPublic(BaseModel):
    key: str
    text: str


class ChallengeQuestionPublic(BaseModel):
    """A question as the candidate sees it. No correct answer, by construction."""

    id: uuid.UUID
    position: int
    prompt: str
    topic: str | None = None
    options: list[ChallengeOptionPublic]


class ChallengeSession(BaseModel):
    """The open paper, returned once at start and never re-fetchable.

    `token` is shown to nobody but this browser: it authorises the warning and
    submit calls for a guest who has no account to authenticate with. It is
    stored only as a hash, so it cannot be recovered if the tab is lost.
    """

    attempt_id: uuid.UUID
    token: str
    reference_code: str
    certification_name: str
    exam_code: str | None = None
    started_at: datetime
    expires_at: datetime
    duration_seconds: int
    max_warnings: int
    pass_mark: Decimal
    reward_discount_percentage: Decimal
    questions: list[ChallengeQuestionPublic]


class ChallengeAnswer(BaseModel):
    question_id: uuid.UUID
    option_key: str = Field(min_length=1, max_length=4)


class ChallengeWarningReport(BaseModel):
    token: str = Field(min_length=10, max_length=128)
    kind: ChallengeViolationKind


class ChallengeWarningReceipt(BaseModel):
    """What the browser does next after a violation is recorded."""

    warnings: int
    max_warnings: int
    remaining: int
    message: str
    # True once the limit is reached: the browser stops the paper and submits
    # whatever has been answered. The server will not accept further warnings.
    terminated: bool


class ChallengeSubmit(BaseModel):
    token: str = Field(min_length=10, max_length=128)
    answers: list[ChallengeAnswer] = Field(default_factory=list, max_length=200)
    # Set when the browser submitted on the candidate's behalf, because the
    # timer ran out or the warning limit was reached.
    auto_submitted: bool = False


class ChallengeReviewItem(BaseModel):
    """Per-question feedback, only ever part of a graded result."""

    question_id: uuid.UUID
    position: int
    prompt: str
    topic: str | None = None
    options: list[ChallengeOptionPublic]
    selected_option: str | None = None
    correct_option: str
    is_correct: bool
    explanation: str | None = None


class ChallengeResult(BaseModel):
    reference_code: str
    certification_name: str
    exam_code: str | None = None
    question_count: int
    correct_count: int
    score_percentage: Decimal
    pass_mark: Decimal
    passed: bool
    discount_percentage: Decimal | None = None
    warnings: int
    auto_submitted: bool
    response_hours: int
    retake_after_days: int
    headline: str
    message: str
    # What the reward is worth against this exam's quoted fee, when it is priced.
    pricing: ExamPricing | None = None
    rewarded_price: Decimal | None = None
    review: list[ChallengeReviewItem] = []


# --- Admin -------------------------------------------------------------------
class ChallengeAttemptRead(ORMModel):
    """The lead queue row. Answers and question ids are deliberately omitted."""

    id: uuid.UUID
    reference_code: str
    user_id: uuid.UUID | None = None
    full_name: str
    email: EmailStr
    phone: str
    country: str | None = None
    certification_id: uuid.UUID | None = None
    certification_name: str
    exam_code: str | None = None
    status: str
    question_count: int
    correct_count: int
    score_percentage: Decimal | None = None
    pass_mark: Decimal | None = None
    passed: bool | None = None
    discount_percentage: Decimal | None = None
    warnings: int
    auto_submitted: bool
    lead_status: ChallengeLeadStatus
    admin_notes: str | None = None
    started_at: datetime
    submitted_at: datetime | None = None
    created_at: datetime


class ChallengeAttemptUpdate(BaseModel):
    lead_status: ChallengeLeadStatus | None = None
    admin_notes: str | None = Field(default=None, max_length=2000)
