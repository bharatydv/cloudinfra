"""SQLAlchemy models. Importing this package registers every table on Base."""

from app.db.base import Base
from app.models.catalog import Course, CourseCategory, CourseModule, Lesson
from app.models.certification import (
    Certification,
    CertificationProvider,
    CertificationResource,
    course_certifications,
)
from app.models.commerce import Payment
from app.models.content import (
    Article,
    ArticleCategory,
    Faq,
    Tag,
    Testimonial,
    article_tags,
)
from app.models.engagement import (
    Certificate,
    CourseReview,
    Enrollment,
    LessonProgress,
    SavedCertification,
)
from app.models.system import AnalyticsEvent, ContactMessage, MediaAsset, SiteSetting
from app.models.user import PasswordResetToken, RefreshToken, User

__all__ = [
    "AnalyticsEvent",
    "Article",
    "ArticleCategory",
    "Base",
    "Certificate",
    "Certification",
    "CertificationProvider",
    "CertificationResource",
    "ContactMessage",
    "Course",
    "CourseCategory",
    "CourseModule",
    "CourseReview",
    "Enrollment",
    "Faq",
    "Lesson",
    "LessonProgress",
    "MediaAsset",
    "PasswordResetToken",
    "Payment",
    "RefreshToken",
    "SavedCertification",
    "SiteSetting",
    "Tag",
    "Testimonial",
    "User",
    "article_tags",
    "course_certifications",
]
