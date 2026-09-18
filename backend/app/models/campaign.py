"""The certification challenge: a scored test that earns a discount.

The campaign is lead generation, not commerce. A visitor answers a timed paper
about one Google Cloud certification; passing does not issue a coupon, it puts a
qualified row in the sales queue for a human to call back. That is why an
attempt carries contact details, a follow-up status and admin notes rather than
anything the checkout could redeem.

Grading is entirely server-side. The browser is told which questions to render
and nothing else -- the correct answers, the score and whether the reward was
earned are all decided here, from the paper frozen onto the row at start time.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ChallengeAttemptStatus, ChallengeLeadStatus


class ChallengeQuestion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One multiple-choice question in the campaign's bank.

    `certification_id` scopes a question to a single exam; NULL keeps it in the
    provider-wide pool, which is what makes a paper possible for a certification
    nobody has written specific questions for yet.

    `reference` is the natural key the seeder matches on, so re-running the seed
    edits a question in place instead of duplicating it -- and so the question
    ids stored on an attempt keep pointing at the wording it was sat under.
    """

    __tablename__ = "challenge_questions"
    __table_args__ = (
        CheckConstraint(
            "difficulty IN ('easy', 'medium', 'hard')", name="difficulty_valid"
        ),
        Index(
            "ix_challenge_questions_pool",
            "provider_slug",
            "certification_id",
            "is_active",
        ),
    )

    reference: Mapped[str] = mapped_column(
        String(80), unique=True, index=True, nullable=False
    )
    provider_slug: Mapped[str] = mapped_column(
        String(140), default="google-cloud", nullable=False, index=True
    )
    certification_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("certifications.id", ondelete="CASCADE"), index=True
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    # [{"key": "a", "text": "..."}] -- ordered, rendered as given.
    options: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)
    correct_option: Mapped[str] = mapped_column(String(4), nullable=False)
    # Shown only on the result screen, never while the paper is open.
    explanation: Mapped[str | None] = mapped_column(Text)
    topic: Mapped[str | None] = mapped_column(String(120))
    difficulty: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )


class ChallengeAttempt(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One sitting of the challenge, and the lead it becomes.

    Open to signed-out visitors -- capturing the email *is* the campaign -- so
    contact details live on the row. A signed-in sitting is still linked to the
    account so the admin console can group a learner's activity.

    `certification_name` and `discount_percentage` are snapshots: the row has to
    stay readable, and the promise made to the applicant has to stay honest,
    even after the certification is renamed or the campaign terms are changed.
    """

    __tablename__ = "challenge_attempts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('in_progress', 'submitted', 'expired')", name="status_valid"
        ),
        CheckConstraint(
            "lead_status IN ('new', 'contacted', 'scheduled', 'converted', 'lost')",
            name="lead_status_valid",
        ),
        CheckConstraint("warnings >= 0", name="warnings_non_negative"),
        CheckConstraint(
            "score_percentage IS NULL "
            "OR (score_percentage >= 0 AND score_percentage <= 100)",
            name="score_percentage_valid",
        ),
        Index("ix_challenge_attempts_lead_created", "lead_status", "created_at"),
        Index("ix_challenge_attempts_email_created", "email", "created_at"),
    )

    # --- Who ---------------------------------------------------------------
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    country: Mapped[str | None] = mapped_column(String(80))

    # --- Which exam --------------------------------------------------------
    certification_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("certifications.id", ondelete="SET NULL"), index=True
    )
    certification_name: Mapped[str] = mapped_column(String(220), nullable=False)
    exam_code: Mapped[str | None] = mapped_column(String(60))

    # --- The paper ---------------------------------------------------------
    # Question ids in served order, frozen at start. Grading reads this, never
    # the request, so a client cannot enlarge or reshuffle its own paper.
    question_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    # {question_id: option_key} as last submitted.
    answers: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # --- Proctoring --------------------------------------------------------
    # SHA-256 of the one-time token handed to the browser at start. Storing the
    # digest means a leaked database row cannot be used to submit someone's paper.
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    warnings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # [{"kind": "tab_hidden", "at": "2026-09-18T10:00:00Z"}] -- the audit trail
    # behind the warning count, kept for disputes.
    violations: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)
    auto_submitted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # --- Timing ------------------------------------------------------------
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # --- Result ------------------------------------------------------------
    reference_code: Mapped[str] = mapped_column(
        String(20), unique=True, index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default=ChallengeAttemptStatus.IN_PROGRESS.value,
        nullable=False,
        index=True,
    )
    question_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    score_percentage: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    passed: Mapped[bool | None] = mapped_column(Boolean)
    # What the applicant was actually promised, at the terms in force that day.
    discount_percentage: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    pass_mark: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    # --- Follow-up ---------------------------------------------------------
    lead_status: Mapped[str] = mapped_column(
        String(20), default=ChallengeLeadStatus.NEW.value, nullable=False, index=True
    )
    admin_notes: Mapped[str | None] = mapped_column(Text)
    source_ip: Mapped[str | None] = mapped_column(String(64))
