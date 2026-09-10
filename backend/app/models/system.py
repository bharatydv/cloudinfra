from __future__ import annotations

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ContactStatus


class ContactMessage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "contact_messages"
    __table_args__ = (
        CheckConstraint("status IN ('new', 'read', 'resolved')", name="status_valid"),
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=ContactStatus.NEW.value, nullable=False, index=True
    )
    admin_notes: Mapped[str | None] = mapped_column(Text)
    source_ip: Mapped[str | None] = mapped_column(String(64))


class MediaAsset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Pointer to a file in object storage. Binaries never live in Postgres."""

    __tablename__ = "media_assets"

    file_key: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    url: Mapped[str] = mapped_column(String(700), nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(300))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    asset_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class SiteSetting(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Editable site content (brand, about page, contact details, legal pages).

    Keeps marketing copy out of the React bundle so it can be changed without a
    deploy.
    """

    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    description: Mapped[str | None] = mapped_column(String(300))
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AnalyticsEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """First-party event sink.

    The frontend posts through a provider-agnostic abstraction, so switching to
    GA4/Plausible/PostHog later does not touch business logic.
    """

    __tablename__ = "analytics_events"

    event_name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(40), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(80), index=True)
    session_id: Mapped[str | None] = mapped_column(String(80), index=True)
    user_id: Mapped[str | None] = mapped_column(String(80), index=True)
    path: Mapped[str | None] = mapped_column(String(500))
    properties: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
