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


class ExamBookingStatus(StrEnum):
    """Lifecycle of an exam scheduling request submitted from the public site."""

    NEW = "new"
    CONTACTED = "contacted"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ExamDeliveryMode(StrEnum):
    ONLINE_PROCTORED = "online_proctored"
    TEST_CENTER = "test_center"


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


class ChallengeAttemptStatus(StrEnum):
    """Lifecycle of a sitting of the certification challenge."""

    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    EXPIRED = "expired"


class ChallengeLeadStatus(StrEnum):
    """Follow-up state of the lead a completed challenge creates.

    The reward is granted by a human on a call, not by a coupon at checkout,
    so the sales queue -- not the payment flow -- is what tracks it.
    """

    NEW = "new"
    CONTACTED = "contacted"
    SCHEDULED = "scheduled"
    CONVERTED = "converted"
    LOST = "lost"


class ChallengeViolationKind(StrEnum):
    """Proctoring events the browser reports while a test is open."""

    TAB_HIDDEN = "tab_hidden"
    WINDOW_BLUR = "window_blur"
    FULLSCREEN_EXIT = "fullscreen_exit"
    COPY = "copy"
    CUT = "cut"
    PASTE = "paste"
    CONTEXT_MENU = "context_menu"
