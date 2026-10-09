from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import PaymentStatus

if TYPE_CHECKING:
    from app.models.catalog import Course
    from app.models.certification import Certification
    from app.models.user import User


class Payment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Payment record.

    Only provider references are stored -- raw card data never touches this
    system. `status` is authoritative only when written by a verified provider
    webhook, never by the browser.
    """

    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'successful', 'failed', 'refunded')",
            name="status_valid",
        ),
        CheckConstraint("amount >= 0", name="amount_non_negative"),
    )

    # Nullable: exam bookings are open to signed-out visitors, so a payment can
    # belong to a booking rather than an account. RESTRICT still protects rows
    # that do belong to a user.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )
    # SET NULL rather than CASCADE: a financial record outlives the request it
    # paid for.
    exam_booking_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("exam_bookings.id", ondelete="SET NULL"), index=True
    )
    # Set when the exam fee is being paid at the discount a challenge attempt
    # earned. SET NULL for the same reason as above: deleting a test sitting
    # must not take the money it was paid against with it.
    challenge_attempt_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("challenge_attempts.id", ondelete="SET NULL"), index=True
    )
    # The other way to reach the discounted fee: a coupon code instead of a
    # passed paper. That route asks for no contact details, so the
    # certification is recorded here rather than on a booking.
    exam_coupon_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("exam_coupons.id", ondelete="SET NULL"), index=True
    )
    certification_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("certifications.id", ondelete="SET NULL"), index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    payment_provider: Mapped[str] = mapped_column(String(40), default="noop", nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(200), index=True)
    transaction_id: Mapped[str | None] = mapped_column(String(200), unique=True)
    status: Mapped[str] = mapped_column(
        String(20), default=PaymentStatus.PENDING.value, nullable=False, index=True
    )
    provider_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User | None] = relationship(back_populates="payments")
    course: Mapped[Course | None] = relationship()


class ExamCoupon(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A code that unlocks the exam fee a passed challenge paper unlocks.

    Deliberately not a discount of its own: the catalogue already advertises a
    price, and a coupon is a key to it rather than a second rate to keep in
    step. That is what stops a code and a passed paper quoting two different
    figures for the same exam.

    `certification_id` is NULL for a code that works on any exam. Redemptions
    are counted by the payment webhook, which is the only thing that knows a
    code was actually used rather than merely typed.

    `owner_name` is who the batch was handed to -- an influencer, a college, a
    community. It is a label, not an account: nobody signs in as the owner of
    a coupon, and `redemption_count` is what their code is judged on.
    """

    __tablename__ = "exam_coupons"
    __table_args__ = (
        CheckConstraint("max_redemptions IS NULL OR max_redemptions > 0", name="limit_positive"),
        CheckConstraint("redemption_count >= 0", name="redemptions_non_negative"),
        # A window that closes before it opens would be live for nobody, and
        # is far more likely a typo than an intention.
        CheckConstraint(
            "starts_at IS NULL OR expires_at IS NULL OR starts_at < expires_at",
            name="window_ordered",
        ),
    )

    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(200))
    # Who the code was given to. Indexed because the admin table groups by it
    # once one influencer has several batches.
    owner_name: Mapped[str | None] = mapped_column(String(120), index=True)
    owner_email: Mapped[str | None] = mapped_column(String(255))
    certification_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("certifications.id", ondelete="CASCADE"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # The custom validity window. NULL at either end means open-ended, so a
    # code with neither works from the moment it is created until switched off.
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    max_redemptions: Mapped[int | None] = mapped_column(Integer)
    redemption_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    certification: Mapped[Certification | None] = relationship()
