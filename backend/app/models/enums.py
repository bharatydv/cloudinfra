"""String enums used across models, schemas and the API surface."""

from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    STUDENT = "student"
    INSTRUCTOR = "instructor"
    ADMIN = "admin"


class CourseLevel(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class CertificationLevel(StrEnum):
    FOUNDATIONAL = "foundational"
    ASSOCIATE = "associate"
    PROFESSIONAL = "professional"
    SPECIALTY = "specialty"
    EXPERT = "expert"


class ContentStatus(StrEnum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class EnrollmentStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    REFUNDED = "refunded"


class ContactStatus(StrEnum):
    NEW = "new"
    READ = "read"
    RESOLVED = "resolved"


class ResourceType(StrEnum):
    GUIDE = "guide"
    ROADMAP = "roadmap"
    PRACTICE = "practice"
    CHEATSHEET = "cheatsheet"
    EXAM_TOPIC = "exam_topic"
    EXTERNAL = "external"


class SearchEntity(StrEnum):
    COURSE = "course"
    CERTIFICATION = "certification"
    ARTICLE = "article"
    RESOURCE = "resource"
