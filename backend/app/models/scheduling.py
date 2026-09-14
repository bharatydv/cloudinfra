from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ExamBookingStatus, ExamDeliveryMode


class ExamBooking(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A request to schedule a certification exam, submitted from the public site.

    Open to signed-out visitors, so contact details are stored on the row rather
    than read through `user_id`. When somebody is signed in we still link the
    account, which lets an admin see every request a learner has made.

    `certification_name` is a snapshot: the request has to stay readable in the
    admin console even if the certification is later renamed or deleted, which
    is also why the foreign key is SET NULL rather than CASCADE.
    """

    __tablename__ = "exam_bookings"
    __table_args__ = (
        CheckConstraint(
            "status IN ('new', 'contacted', 'scheduled', 'completed', 'cancelled')",
            name="status_valid",
        ),
        CheckConstraint(
            "delivery_mode IN ('online_proctored', 'test_center')",
            name="delivery_mode_valid",
        ),
        Index("ix_exam_bookings_status_created", "status", "created_at"),
    )

    # --- Who ---------------------------------------------------------------
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    country: Mapped[str] = mapped_column(String(80), nullable=False)
    city: Mapped[str | None] = mapped_column(String(120))

    # --- Which exam --------------------------------------------------------
    certification_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("certifications.id", ondelete="SET NULL"), index=True
    )
    certification_name: Mapped[str] = mapped_column(String(220), nullable=False)
    exam_code: Mapped[str | None] = mapped_column(String(60))

    # --- When --------------------------------------------------------------
    preferred_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    alternate_date: Mapped[date | None] = mapped_column(Date)
    preferred_time_slot: Mapped[str] = mapped_column(String(40), nullable=False)
    timezone: Mapped[str] = mapped_column(String(80), nullable=False)
    delivery_mode: Mapped[str] = mapped_column(
        String(30), default=ExamDeliveryMode.ONLINE_PROCTORED.value, nullable=False
    )

    # --- Handling ----------------------------------------------------------
    # Short, human-quotable handle shown on the confirmation screen and in email.
    reference_code: Mapped[str] = mapped_column(
        String(20), unique=True, index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default=ExamBookingStatus.NEW.value, nullable=False, index=True
    )
    admin_notes: Mapped[str | None] = mapped_column(Text)
    source_ip: Mapped[str | None] = mapped_column(String(64))
