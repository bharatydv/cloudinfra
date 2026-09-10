from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import EnrollmentStatus
from app.schemas.catalog import CourseCard
from app.schemas.common import ORMModel


class EnrollmentCreate(BaseModel):
    course_id: uuid.UUID


class EnrollmentRead(ORMModel):
    id: uuid.UUID
    course_id: uuid.UUID
    status: EnrollmentStatus
    progress_percentage: int
    enrolled_at: datetime
    completed_at: datetime | None = None
    last_accessed_at: datetime | None = None
    course: CourseCard | None = None


class LessonProgressUpdate(BaseModel):
    completed: bool | None = None
    progress_percentage: int | None = Field(default=None, ge=0, le=100)


class LessonProgressRead(ORMModel):
    id: uuid.UUID
    lesson_id: uuid.UUID
    completed: bool
    progress_percentage: int
    last_accessed_at: datetime
    completed_at: datetime | None = None


class CourseProgressRead(BaseModel):
    course_id: uuid.UUID
    course_slug: str
    course_title: str
    total_lessons: int
    completed_lessons: int
    progress_percentage: int
    status: EnrollmentStatus
    last_accessed_at: datetime | None = None
    next_lesson_slug: str | None = None


class DashboardOverview(BaseModel):
    enrolled_courses: int
    completed_courses: int
    in_progress_courses: int
    total_lessons_completed: int
    saved_certifications: int
    certificates_earned: int
    overall_progress: int
    recent_courses: list[CourseProgressRead] = []


class CertificateRead(ORMModel):
    id: uuid.UUID
    serial: str
    issued_at: datetime
    course: CourseCard | None = None


class SaveCertificationRequest(BaseModel):
    certification_id: uuid.UUID
    notes: str | None = Field(default=None, max_length=1000)


class LearnLessonView(BaseModel):
    """Lesson payload for the authenticated learning experience."""

    id: uuid.UUID
    module_id: uuid.UUID
    title: str
    slug: str
    description: str | None = None
    video_url: str | None = None
    content: str
    resources: list[dict] = []
    duration_minutes: int
    position: int
    completed: bool = False
    progress_percentage: int = 0
    previous_lesson_slug: str | None = None
    next_lesson_slug: str | None = None


class LearnModuleView(BaseModel):
    id: uuid.UUID
    title: str
    position: int
    lessons: list[dict] = []


class LearnCourseView(BaseModel):
    course_id: uuid.UUID
    title: str
    slug: str
    progress_percentage: int
    total_lessons: int
    completed_lessons: int
    modules: list[LearnModuleView] = []
    current_lesson: LearnLessonView | None = None
