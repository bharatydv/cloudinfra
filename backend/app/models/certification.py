from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import CertificationLevel, ContentStatus, ResourceType

if TYPE_CHECKING:
    from app.models.catalog import Course
    from app.models.engagement import SavedCertification


course_certifications = Table(
    "course_certifications",
    Base.metadata,
    Column(
        "course_id",
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "certification_id",
        UUID(as_uuid=True),
        ForeignKey("certifications.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class CertificationProvider(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A certification vendor (e.g. a cloud provider).

    This platform is independent: `is_official_partner` defaults to False and the
    UI must never imply affiliation unless an operator explicitly sets it.
    """

    __tablename__ = "certification_providers"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True, nullable=False)
    short_description: Mapped[str | None] = mapped_column(String(320))
    description: Mapped[str | None] = mapped_column(Text)
    website_url: Mapped[str | None] = mapped_column(String(500))
    logo: Mapped[str | None] = mapped_column(String(500))
    accent_color: Mapped[str | None] = mapped_column(String(20))
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_official_partner: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    meta_title: Mapped[str | None] = mapped_column(String(200))
    meta_description: Mapped[str | None] = mapped_column(String(320))

    certifications: Mapped[list[Certification]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )


class Certification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "certifications"
    __table_args__ = (
        UniqueConstraint("provider_id", "slug", name="uq_certification_slug_per_provider"),
        CheckConstraint(
            "level IN ('foundational', 'associate', 'professional', 'specialty', 'expert')",
            name="level_valid",
        ),
        Index("ix_certifications_published_provider", "is_published", "provider_id"),
    )

    provider_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("certification_providers.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), index=True, nullable=False)
    short_description: Mapped[str] = mapped_column(String(320), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    exam_code: Mapped[str | None] = mapped_column(String(60), index=True)
    level: Mapped[str] = mapped_column(
        String(20), default=CertificationLevel.ASSOCIATE.value, nullable=False, index=True
    )
    category: Mapped[str | None] = mapped_column(String(80), index=True)
    skills: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    exam_topics: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)
    audience: Mapped[str | None] = mapped_column(Text)
    recommended_experience: Mapped[str | None] = mapped_column(Text)
    preparation_roadmap: Mapped[list[dict]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    exam_duration_minutes: Mapped[int | None] = mapped_column(Integer)
    exam_format: Mapped[str | None] = mapped_column(String(160))
    # Link to the vendor's own page. Rendered as an outbound reference only.
    official_url: Mapped[str | None] = mapped_column(String(500))
    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    meta_title: Mapped[str | None] = mapped_column(String(200))
    meta_description: Mapped[str | None] = mapped_column(String(320))

    provider: Mapped[CertificationProvider] = relationship(back_populates="certifications")
    resources: Mapped[list[CertificationResource]] = relationship(
        back_populates="certification",
        cascade="all, delete-orphan",
        order_by="CertificationResource.position",
    )
    courses: Mapped[list[Course]] = relationship(
        secondary=course_certifications, back_populates="certifications"
    )
    saved_by: Mapped[list[SavedCertification]] = relationship(
        back_populates="certification", cascade="all, delete-orphan"
    )


class CertificationResource(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "certification_resources"
    __table_args__ = (
        UniqueConstraint("certification_id", "slug", name="uq_resource_slug_per_cert"),
        CheckConstraint(
            "resource_type IN "
            "('guide', 'roadmap', 'practice', 'cheatsheet', 'exam_topic', 'external')",
            name="resource_type_valid",
        ),
    )

    certification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("certifications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), nullable=False)
    resource_type: Mapped[str] = mapped_column(
        String(20), default=ResourceType.GUIDE.value, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    url: Mapped[str | None] = mapped_column(String(500))
    estimated_minutes: Mapped[int | None] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=ContentStatus.PUBLISHED.value, nullable=False, index=True
    )

    certification: Mapped[Certification] = relationship(back_populates="resources")
