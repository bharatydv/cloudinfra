from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import CourseLevel

if TYPE_CHECKING:
    from app.models.certification import Certification
    from app.models.engagement import CourseReview, Enrollment, LessonProgress
    from app.models.user import User


class CourseCategory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "course_categories"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(60))
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    courses: Mapped[list[Course]] = relationship(back_populates="category")


class Course(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "courses"
    __table_args__ = (
        CheckConstraint(
            "level IN ('beginner', 'intermediate', 'advanced')", name="level_valid"
        ),
        CheckConstraint("price >= 0", name="price_non_negative"),
        Index("ix_courses_published_created", "is_published", "created_at"),
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True, nullable=False)
    short_description: Mapped[str] = mapped_column(String(320), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    thumbnail: Mapped[str | None] = mapped_column(String(500))
    icon: Mapped[str | None] = mapped_column(String(60))
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("course_categories.id", ondelete="SET NULL"), index=True
    )
    instructor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    level: Mapped[str] = mapped_column(
        String(20), default=CourseLevel.BEGINNER.value, nullable=False, index=True
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    language: Mapped[str] = mapped_column(String(20), default="en", nullable=False)
    learning_outcomes: Mapped[list[str]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    requirements: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Denormalised aggregates, recomputed when reviews/enrollments change.
    rating_average: Mapped[float] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enrollment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # SEO
    meta_title: Mapped[str | None] = mapped_column(String(200))
    meta_description: Mapped[str | None] = mapped_column(String(320))
    canonical_url: Mapped[str | None] = mapped_column(String(500))

    category: Mapped[CourseCategory | None] = relationship(back_populates="courses")
    instructor: Mapped[User | None] = relationship()
    modules: Mapped[list[CourseModule]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseModule.position",
    )
    enrollments: Mapped[list[Enrollment]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    reviews: Mapped[list[CourseReview]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    certifications: Mapped[list[Certification]] = relationship(
        secondary="course_certifications", back_populates="courses"
    )

    @property
    def lesson_count(self) -> int:
        return sum(len(module.lessons) for module in self.modules)


class CourseModule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "course_modules"
    __table_args__ = (
        UniqueConstraint("course_id", "position", name="uq_module_position"),
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    course: Mapped[Course] = relationship(back_populates="modules")
    lessons: Mapped[list[Lesson]] = relationship(
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="Lesson.position",
    )


class Lesson(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "lessons"
    __table_args__ = (
        UniqueConstraint("module_id", "slug", name="uq_lesson_slug_per_module"),
        Index("ix_lessons_module_position", "module_id", "position"),
    )

    module_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("course_modules.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    video_url: Mapped[str | None] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    resources: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_preview: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    module: Mapped[CourseModule] = relationship(back_populates="lessons")
    progress: Mapped[list[LessonProgress]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan"
    )
