from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, computed_field

from app.models.enums import CourseLevel
from app.schemas.auth import UserPublic
from app.schemas.common import FaqItem, ORMModel, SeoMeta


# --------------------------------------------------------------------------
# Categories
# --------------------------------------------------------------------------
class CourseCategoryRead(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    position: int
    course_count: int = 0


class CourseCategoryWrite(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=140)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=60)
    position: int = 0
    is_published: bool = True


# --------------------------------------------------------------------------
# Lessons
# --------------------------------------------------------------------------
class LessonSummary(ORMModel):
    id: uuid.UUID
    title: str
    slug: str
    duration_minutes: int
    position: int
    is_preview: bool


class LessonRead(LessonSummary):
    module_id: uuid.UUID
    description: str | None = None
    video_url: str | None = None
    content: str
    resources: list[dict] = []


class LessonWrite(BaseModel):
    module_id: uuid.UUID
    title: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=220)
    description: str | None = None
    video_url: str | None = Field(default=None, max_length=500)
    content: str = ""
    resources: list[dict] = []
    duration_minutes: int = Field(default=0, ge=0, le=100000)
    position: int = 0
    is_preview: bool = False


class LessonUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    video_url: str | None = Field(default=None, max_length=500)
    content: str | None = None
    resources: list[dict] | None = None
    duration_minutes: int | None = Field(default=None, ge=0, le=100000)
    position: int | None = None
    is_preview: bool | None = None


# --------------------------------------------------------------------------
# Modules
# --------------------------------------------------------------------------
class CourseModuleRead(ORMModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: str | None = None
    position: int
    lessons: list[LessonSummary] = []


class CourseModuleWrite(BaseModel):
    course_id: uuid.UUID
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None
    position: int = 0


class CourseModuleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    position: int | None = None


class ReorderItem(BaseModel):
    id: uuid.UUID
    position: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem] = Field(min_length=1)


# --------------------------------------------------------------------------
# Courses
# --------------------------------------------------------------------------
class CourseCardCategory(ORMModel):
    id: uuid.UUID
    name: str
    slug: str


class CourseCard(ORMModel):
    id: uuid.UUID
    title: str
    slug: str
    short_description: str
    thumbnail: str | None = None
    icon: str | None = None
    level: CourseLevel
    duration_minutes: int
    price: Decimal
    currency: str
    rating_average: Decimal
    rating_count: int
    enrollment_count: int
    lesson_count: int = 0
    is_published: bool = True
    category: CourseCardCategory | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_free(self) -> bool:
        return self.price == 0


class CourseReviewRead(ORMModel):
    id: uuid.UUID
    rating: int
    comment: str | None = None
    created_at: datetime
    user: UserPublic


class CourseDetail(CourseCard):
    description: str
    language: str
    learning_outcomes: list[str] = []
    requirements: list[str] = []
    is_featured: bool
    created_at: datetime
    updated_at: datetime
    instructor: UserPublic | None = None
    modules: list[CourseModuleRead] = []
    faqs: list[FaqItem] = []
    reviews: list[CourseReviewRead] = []
    related_certifications: list[CertificationCardRef] = []
    related_courses: list[CourseCard] = []
    seo: SeoMeta | None = None
    # Present only for an authenticated viewer.
    is_enrolled: bool = False
    progress_percentage: int = 0


class CertificationCardRef(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    provider_slug: str
    provider_name: str
    level: str
    exam_code: str | None = None


class CourseWrite(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    slug: str | None = Field(default=None, max_length=220)
    short_description: str = Field(min_length=10, max_length=320)
    description: str = ""
    thumbnail: str | None = Field(default=None, max_length=500)
    icon: str | None = Field(default=None, max_length=60)
    category_id: uuid.UUID | None = None
    instructor_id: uuid.UUID | None = None
    level: CourseLevel = CourseLevel.BEGINNER
    duration_minutes: int = Field(default=0, ge=0, le=1000000)
    price: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    language: str = "en"
    learning_outcomes: list[str] = []
    requirements: list[str] = []
    is_published: bool = False
    is_featured: bool = False
    meta_title: str | None = Field(default=None, max_length=200)
    meta_description: str | None = Field(default=None, max_length=320)
    canonical_url: str | None = Field(default=None, max_length=500)
    certification_ids: list[uuid.UUID] = []


class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    slug: str | None = Field(default=None, max_length=220)
    short_description: str | None = Field(default=None, min_length=10, max_length=320)
    description: str | None = None
    thumbnail: str | None = Field(default=None, max_length=500)
    icon: str | None = Field(default=None, max_length=60)
    category_id: uuid.UUID | None = None
    instructor_id: uuid.UUID | None = None
    level: CourseLevel | None = None
    duration_minutes: int | None = Field(default=None, ge=0, le=1000000)
    price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    language: str | None = None
    learning_outcomes: list[str] | None = None
    requirements: list[str] | None = None
    is_published: bool | None = None
    is_featured: bool | None = None
    meta_title: str | None = Field(default=None, max_length=200)
    meta_description: str | None = Field(default=None, max_length=320)
    canonical_url: str | None = Field(default=None, max_length=500)
    certification_ids: list[uuid.UUID] | None = None


class CourseReviewWrite(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


CourseDetail.model_rebuild()
