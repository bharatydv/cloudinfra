from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import CertificationLevel, ContentStatus, ResourceType
from app.schemas.catalog import CourseCard
from app.schemas.common import FaqItem, ORMModel, SeoMeta


# --------------------------------------------------------------------------
# Providers
# --------------------------------------------------------------------------
class ProviderCard(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    short_description: str | None = None
    logo: str | None = None
    accent_color: str | None = None
    certification_count: int = 0


class ProviderDetail(ProviderCard):
    description: str | None = None
    website_url: str | None = None
    is_official_partner: bool = False
    certifications: list[CertificationCard] = []
    related_courses: list[CourseCard] = []
    related_articles: list[ArticleCardRef] = []
    faqs: list[FaqItem] = []
    seo: SeoMeta | None = None


class ProviderWrite(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=140)
    short_description: str | None = Field(default=None, max_length=320)
    description: str | None = None
    website_url: str | None = Field(default=None, max_length=500)
    logo: str | None = Field(default=None, max_length=500)
    accent_color: str | None = Field(default=None, max_length=20)
    position: int = 0
    is_published: bool = True
    # Only set when a real, documented partnership exists.
    is_official_partner: bool = False
    meta_title: str | None = Field(default=None, max_length=200)
    meta_description: str | None = Field(default=None, max_length=320)


class ProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=140)
    short_description: str | None = Field(default=None, max_length=320)
    description: str | None = None
    website_url: str | None = Field(default=None, max_length=500)
    logo: str | None = Field(default=None, max_length=500)
    accent_color: str | None = Field(default=None, max_length=20)
    position: int | None = None
    is_published: bool | None = None
    is_official_partner: bool | None = None
    meta_title: str | None = Field(default=None, max_length=200)
    meta_description: str | None = Field(default=None, max_length=320)


# --------------------------------------------------------------------------
# Certification resources
# --------------------------------------------------------------------------
class CertificationResourceCard(ORMModel):
    id: uuid.UUID
    certification_id: uuid.UUID
    title: str
    slug: str
    resource_type: ResourceType
    description: str | None = None
    url: str | None = None
    estimated_minutes: int | None = None
    position: int
    content: str = ""


class CertificationResourceRead(CertificationResourceCard):
    status: ContentStatus


class CertificationResourceWrite(BaseModel):
    certification_id: uuid.UUID
    title: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=220)
    resource_type: ResourceType = ResourceType.GUIDE
    description: str | None = None
    content: str = ""
    url: str | None = Field(default=None, max_length=500)
    estimated_minutes: int | None = Field(default=None, ge=0)
    position: int = 0
    status: ContentStatus = ContentStatus.PUBLISHED


class CertificationResourceUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    resource_type: ResourceType | None = None
    description: str | None = None
    content: str | None = None
    url: str | None = Field(default=None, max_length=500)
    estimated_minutes: int | None = Field(default=None, ge=0)
    position: int | None = None
    status: ContentStatus | None = None


# --------------------------------------------------------------------------
# Certifications
# --------------------------------------------------------------------------
class CertificationCard(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    short_description: str
    exam_code: str | None = None
    level: CertificationLevel
    category: str | None = None
    skills: list[str] = []
    provider_id: uuid.UUID
    provider_name: str = ""
    provider_slug: str = ""
    provider_logo: str | None = None
    course_count: int = 0
    is_saved: bool = False


class ExamTopic(BaseModel):
    title: str
    weight: int | None = None
    items: list[str] = []


class RoadmapStep(BaseModel):
    step: int
    title: str
    description: str | None = None
    estimated_weeks: int | None = None


class CertificationDetail(CertificationCard):
    description: str
    audience: str | None = None
    recommended_experience: str | None = None
    exam_topics: list[ExamTopic] = []
    preparation_roadmap: list[RoadmapStep] = []
    exam_duration_minutes: int | None = None
    exam_format: str | None = None
    official_url: str | None = None
    created_at: datetime
    updated_at: datetime
    provider: ProviderCard | None = None
    resources: list[CertificationResourceCard] = []
    practice_resources: list[CertificationResourceCard] = []
    related_courses: list[CourseCard] = []
    related_certifications: list[CertificationCard] = []
    faqs: list[FaqItem] = []
    seo: SeoMeta | None = None


class CertificationWrite(BaseModel):
    provider_id: uuid.UUID
    name: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=220)
    short_description: str = Field(default="", max_length=320)
    description: str = ""
    exam_code: str | None = Field(default=None, max_length=60)
    level: CertificationLevel = CertificationLevel.ASSOCIATE
    category: str | None = Field(default=None, max_length=80)
    skills: list[str] = []
    exam_topics: list[ExamTopic] = []
    audience: str | None = None
    recommended_experience: str | None = None
    preparation_roadmap: list[RoadmapStep] = []
    exam_duration_minutes: int | None = Field(default=None, ge=0)
    exam_format: str | None = Field(default=None, max_length=160)
    official_url: str | None = Field(default=None, max_length=500)
    is_published: bool = False
    is_featured: bool = False
    position: int = 0
    meta_title: str | None = Field(default=None, max_length=200)
    meta_description: str | None = Field(default=None, max_length=320)
    course_ids: list[uuid.UUID] = []


class CertificationUpdate(BaseModel):
    provider_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=220)
    short_description: str | None = Field(default=None, max_length=320)
    description: str | None = None
    exam_code: str | None = Field(default=None, max_length=60)
    level: CertificationLevel | None = None
    category: str | None = Field(default=None, max_length=80)
    skills: list[str] | None = None
    exam_topics: list[ExamTopic] | None = None
    audience: str | None = None
    recommended_experience: str | None = None
    preparation_roadmap: list[RoadmapStep] | None = None
    exam_duration_minutes: int | None = Field(default=None, ge=0)
    exam_format: str | None = Field(default=None, max_length=160)
    official_url: str | None = Field(default=None, max_length=500)
    is_published: bool | None = None
    is_featured: bool | None = None
    position: int | None = None
    meta_title: str | None = Field(default=None, max_length=200)
    meta_description: str | None = Field(default=None, max_length=320)
    course_ids: list[uuid.UUID] | None = None


class ArticleCardRef(ORMModel):
    id: uuid.UUID
    title: str
    slug: str
    excerpt: str
    reading_minutes: int
    published_at: datetime | None = None


class SavedCertificationRead(ORMModel):
    id: uuid.UUID
    created_at: datetime
    notes: str | None = None
    certification: CertificationCard


ProviderDetail.model_rebuild()
CertificationDetail.model_rebuild()
