from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import PaymentStatus

if TYPE_CHECKING:
    from app.models.catalog import Course
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

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), index=True
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

    user: Mapped[User] = relationship(back_populates="payments")
    course: Mapped[Course | None] = relationship()
