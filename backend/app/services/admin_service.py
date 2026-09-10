from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.pagination import PageParams
from app.models.catalog import Course
from app.models.certification import Certification
from app.models.commerce import Payment
from app.models.content import Article
from app.models.engagement import Enrollment
from app.models.enums import ContactStatus, ContentStatus, PaymentStatus, UserRole
from app.models.system import ContactMessage
from app.models.user import User
from app.repositories import article_repo, misc_repo
from app.schemas.system import (
    AdminDashboard,
    AdminRecentEnrollment,
    AdminRecentUser,
    AdminStatCounts,
    ContactRead,
)


async def _count(db: AsyncSession, model, *conditions) -> int:
    stmt = select(func.count()).select_from(model)
    if conditions:
        stmt = stmt.where(*conditions)
    return await db.scalar(stmt) or 0


async def build_dashboard(db: AsyncSession) -> AdminDashboard:
    revenue = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.status == PaymentStatus.SUCCESSFUL.value
        )
    )

    stats = AdminStatCounts(
        users=await _count(db, User),
        students=await _count(db, User, User.role == UserRole.STUDENT.value),
        courses=await _count(db, Course),
        published_courses=await _count(db, Course, Course.is_published.is_(True)),
        certifications=await _count(db, Certification),
        articles=await _count(db, Article),
        published_articles=await _count(
            db, Article, Article.status == ContentStatus.PUBLISHED.value
        ),
        enrollments=await _count(db, Enrollment),
        active_enrollments=await _count(db, Enrollment, Enrollment.status == "active"),
        contact_messages=await _count(db, ContactMessage),
        new_contact_messages=await _count(
            db, ContactMessage, ContactMessage.status == ContactStatus.NEW.value
        ),
        revenue_total=Decimal(str(revenue or 0)),
        revenue_currency=settings.payment_currency,
    )

    recent_users = await db.scalars(
        select(User).order_by(User.created_at.desc()).limit(5)
    )
    recent_enrollment_rows = await db.scalars(
        select(Enrollment)
        .options(selectinload(Enrollment.user), selectinload(Enrollment.course))
        .order_by(Enrollment.enrolled_at.desc())
        .limit(5)
    )
    recent_messages, _ = await misc_repo.list_contact_messages(
        db, PageParams(page=1, page_size=5)
    )

    return AdminDashboard(
        stats=stats,
        recent_users=[AdminRecentUser.model_validate(user) for user in recent_users],
        recent_enrollments=[
            AdminRecentEnrollment(
                id=row.id,
                user_name=row.user.name if row.user else "Unknown",
                course_title=row.course.title if row.course else "Unknown",
                status=row.status,
                enrolled_at=row.enrolled_at,
            )
            for row in recent_enrollment_rows.unique()
        ],
        recent_messages=[ContactRead.model_validate(item) for item in recent_messages],
    )


async def list_draft_articles(db: AsyncSession, params: PageParams):
    return await article_repo.list_articles(
        db, params, public_only=False, status=ContentStatus.DRAFT.value
    )
