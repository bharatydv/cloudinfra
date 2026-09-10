from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ContentStatus

if TYPE_CHECKING:
    from app.models.user import User


article_tags = Table(
    "article_tags",
    Base.metadata,
    Column(
        "article_id",
        UUID(as_uuid=True),
        ForeignKey("articles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class ArticleCategory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "article_categories"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(60))
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    articles: Mapped[list[Article]] = relationship(back_populates="category")


class Tag(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "tags"

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)

    articles: Mapped[list[Article]] = relationship(
        secondary=article_tags, back_populates="tags"
    )


class Article(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "articles"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'scheduled', 'published', 'archived')",
            name="status_valid",
        ),
        Index("ix_articles_status_published_at", "status", "published_at"),
    )

    title: Mapped[str] = mapped_column(String(220), nullable=False)
    slug: Mapped[str] = mapped_column(String(240), unique=True, index=True, nullable=False)
    excerpt: Mapped[str] = mapped_column(String(400), nullable=False, default="")
    # Markdown. Never stored in the frontend bundle.
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    featured_image: Mapped[str | None] = mapped_column(String(500))
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("article_categories.id", ondelete="SET NULL"), index=True
    )
    reading_minutes: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=ContentStatus.DRAFT.value, nullable=False, index=True
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    meta_title: Mapped[str | None] = mapped_column(String(200))
    meta_description: Mapped[str | None] = mapped_column(String(320))
    canonical_url: Mapped[str | None] = mapped_column(String(500))
    og_image: Mapped[str | None] = mapped_column(String(500))
    faq: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)

    author: Mapped[User | None] = relationship(back_populates="articles")
    category: Mapped[ArticleCategory | None] = relationship(back_populates="articles")
    tags: Mapped[list[Tag]] = relationship(
        secondary=article_tags, back_populates="articles"
    )


class Faq(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "faqs"

    question: Mapped[str] = mapped_column(String(320), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    # Scope key: "home", "about", "courses", "certifications:<slug>", ...
    category: Mapped[str] = mapped_column(
        String(120), default="general", nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Testimonial(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "testimonials"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="rating_range"),
    )

    user_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str | None] = mapped_column(String(160))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    image: Mapped[str | None] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Seeded/demo rows are flagged so they are never mistaken for real outcomes.
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
