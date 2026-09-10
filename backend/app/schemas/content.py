from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ContentStatus
from app.schemas.auth import UserPublic
from app.schemas.catalog import CourseCard
from app.schemas.certification import CertificationCard
from app.schemas.common import FaqItem, ORMModel, SeoMeta, TocEntry


class ArticleCategoryRead(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    position: int
    article_count: int = 0


class ArticleCategoryWrite(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=140)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=60)
    position: int = 0


class TagRead(ORMModel):
    id: uuid.UUID
    name: str
    slug: str


class ArticleCard(ORMModel):
    id: uuid.UUID
    title: str
    slug: str
    excerpt: str
    featured_image: str | None = None
    reading_minutes: int
    is_featured: bool
    published_at: datetime | None = None
    updated_at: datetime
    author: UserPublic | None = None
    category: ArticleCategoryRead | None = None
    tags: list[TagRead] = []


class ArticleDetail(ArticleCard):
    content: str
    view_count: int
    status: ContentStatus
    created_at: datetime
    canonical_url: str | None = None
    table_of_contents: list[TocEntry] = []
    faq: list[FaqItem] = []
    related_articles: list[ArticleCard] = []
    related_courses: list[CourseCard] = []
    related_certifications: list[CertificationCard] = []
    seo: SeoMeta | None = None


class ArticleWrite(BaseModel):
    title: str = Field(min_length=3, max_length=220)
    slug: str | None = Field(default=None, max_length=240)
    excerpt: str = Field(default="", max_length=400)
    content: str = ""
    featured_image: str | None = Field(default=None, max_length=500)
    category_id: uuid.UUID | None = None
    author_id: uuid.UUID | None = None
    tag_ids: list[uuid.UUID] = []
    tag_names: list[str] = []
    is_featured: bool = False
    status: ContentStatus = ContentStatus.DRAFT
    published_at: datetime | None = None
    meta_title: str | None = Field(default=None, max_length=200)
    meta_description: str | None = Field(default=None, max_length=320)
    canonical_url: str | None = Field(default=None, max_length=500)
    og_image: str | None = Field(default=None, max_length=500)
    faq: list[FaqItem] = []


class ArticleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=220)
    slug: str | None = Field(default=None, max_length=240)
    excerpt: str | None = Field(default=None, max_length=400)
    content: str | None = None
    featured_image: str | None = Field(default=None, max_length=500)
    category_id: uuid.UUID | None = None
    author_id: uuid.UUID | None = None
    tag_ids: list[uuid.UUID] | None = None
    tag_names: list[str] | None = None
    is_featured: bool | None = None
    status: ContentStatus | None = None
    published_at: datetime | None = None
    meta_title: str | None = Field(default=None, max_length=200)
    meta_description: str | None = Field(default=None, max_length=320)
    canonical_url: str | None = Field(default=None, max_length=500)
    og_image: str | None = Field(default=None, max_length=500)
    faq: list[FaqItem] | None = None


class FaqRead(ORMModel):
    id: uuid.UUID
    question: str
    answer: str
    category: str
    position: int
    is_published: bool


class FaqWrite(BaseModel):
    question: str = Field(min_length=3, max_length=320)
    answer: str = Field(min_length=3)
    category: str = Field(default="general", max_length=120)
    position: int = 0
    is_published: bool = True


class FaqUpdate(BaseModel):
    question: str | None = Field(default=None, min_length=3, max_length=320)
    answer: str | None = Field(default=None, min_length=3)
    category: str | None = Field(default=None, max_length=120)
    position: int | None = None
    is_published: bool | None = None


class TestimonialRead(ORMModel):
    id: uuid.UUID
    user_name: str
    role: str | None = None
    content: str
    rating: int
    image: str | None = None
    position: int
    # True for seeded placeholder rows. The UI labels these as demo content.
    is_demo: bool


class TestimonialWrite(BaseModel):
    user_name: str = Field(min_length=2, max_length=120)
    role: str | None = Field(default=None, max_length=160)
    content: str = Field(min_length=10)
    rating: int = Field(default=5, ge=1, le=5)
    image: str | None = Field(default=None, max_length=500)
    position: int = 0
    is_published: bool = False
    is_demo: bool = False


class TestimonialUpdate(BaseModel):
    user_name: str | None = Field(default=None, min_length=2, max_length=120)
    role: str | None = Field(default=None, max_length=160)
    content: str | None = Field(default=None, min_length=10)
    rating: int | None = Field(default=None, ge=1, le=5)
    image: str | None = Field(default=None, max_length=500)
    position: int | None = None
    is_published: bool | None = None
    is_demo: bool | None = None
