"""One-time codes that prove a guest owns the email and phone they typed."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ContactVerification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A code sent to one address, and whether it was ever typed back.

    Keyed on the address rather than an account because the people verifying
    are guests: the whole point is to prove a contact detail before there is
    anything to attach it to. `attempts` counts wrong guesses so a code cannot
    be brute-forced within its lifetime.
    """

    __tablename__ = "contact_verifications"
    __table_args__ = (
        CheckConstraint("channel IN ('email', 'phone')", name="channel_valid"),
        Index("ix_contact_verifications_lookup", "channel", "target", "created_at"),
    )

    channel: Mapped[str] = mapped_column(String(10), nullable=False)
    target: Mapped[str] = mapped_column(String(255), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_ip: Mapped[str | None] = mapped_column(String(64))
