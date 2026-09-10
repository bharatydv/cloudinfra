from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import AdminUser, DbSession
from app.core.errors import NotFoundError, ValidationFailedError
from app.core.pagination import Page, PageParams, page_params
from app.models.commerce import Payment
from app.models.content import Faq, Testimonial
from app.models.enums import ContactStatus, PaymentStatus, UserRole
from app.repositories import engagement_repo, misc_repo, user_repo
from app.schemas.auth import AdminUserUpdate, UserRead
from app.schemas.common import Message
from app.schemas.content import (
    FaqRead,
    FaqUpdate,
    FaqWrite,
    TestimonialRead,
    TestimonialUpdate,
    TestimonialWrite,
)
from app.schemas.engagement import EnrollmentRead
from app.schemas.system import (
    AdminDashboard,
    ContactRead,
    ContactUpdate,
    PaymentRead,
    SiteSettingRead,
    SiteSettingWrite,
)
from app.services import admin_service, contact_service

router = APIRouter(prefix="/admin", tags=["Admin"])
Params = Annotated[PageParams, Depends(page_params)]


@router.get("/dashboard", response_model=AdminDashboard)
async def dashboard(db: DbSession, _: AdminUser) -> AdminDashboard:
    return await admin_service.build_dashboard(db)


# --- Users -----------------------------------------------------------------
@router.get("/users", response_model=Page[UserRead])
async def list_users(
    db: DbSession,
    params: Params,
    _: AdminUser,
    q: str | None = None,
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> Page[UserRead]:
    items, total = await user_repo.list_users(
        db, params, search=q, role=role.value if role else None, is_active=is_active
    )
    return Page.create([UserRead.model_validate(item) for item in items], total, params)


@router.put("/users/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID, payload: AdminUserUpdate, db: DbSession, admin: AdminUser
) -> UserRead:
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("User not found.")
    data = payload.model_dump(exclude_unset=True)
    # Guard against an admin locking themselves out.
    if user.id == admin.id:
        if data.get("role") and data["role"] != UserRole.ADMIN:
            raise ValidationFailedError("You cannot remove your own admin role.")
        if data.get("is_active") is False:
            raise ValidationFailedError("You cannot deactivate your own account.")
    for field, value in data.items():
        setattr(user, field, value.value if hasattr(value, "value") else value)
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


# --- Enrollments -----------------------------------------------------------
@router.get("/enrollments", response_model=Page[EnrollmentRead])
async def list_enrollments(
    db: DbSession, params: Params, _: AdminUser, enrollment_status: str | None = None
) -> Page[EnrollmentRead]:
    items, total = await engagement_repo.admin_list_enrollments(
        db, params, status=enrollment_status
    )
    return Page.create(
        [
            EnrollmentRead(
                id=row.id,
                course_id=row.course_id,
                status=row.status,
                progress_percentage=row.progress_percentage,
                enrolled_at=row.enrolled_at,
                completed_at=row.completed_at,
                last_accessed_at=row.last_accessed_at,
                course=None,
            )
            for row in items
        ],
        total,
        params,
    )


# --- Payments --------------------------------------------------------------
@router.get("/payments", response_model=Page[PaymentRead])
async def list_payments(
    db: DbSession, params: Params, _: AdminUser, payment_status: PaymentStatus | None = None
) -> Page[PaymentRead]:
    from sqlalchemy import func, select

    stmt = select(Payment)
    if payment_status:
        stmt = stmt.where(Payment.status == payment_status.value)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await db.scalars(
        stmt.order_by(Payment.created_at.desc()).offset(params.offset).limit(params.limit)
    )
    return Page.create(
        [PaymentRead.model_validate(row) for row in rows], total, params
    )


# --- Contact messages ------------------------------------------------------
@router.get("/messages", response_model=Page[ContactRead])
async def list_messages(
    db: DbSession, params: Params, _: AdminUser, message_status: ContactStatus | None = None
) -> Page[ContactRead]:
    items, total = await misc_repo.list_contact_messages(
        db, params, status=message_status.value if message_status else None
    )
    return Page.create([ContactRead.model_validate(item) for item in items], total, params)


@router.put("/messages/{message_id}", response_model=ContactRead)
async def update_message(
    message_id: uuid.UUID, payload: ContactUpdate, db: DbSession, _: AdminUser
) -> ContactRead:
    message = await contact_service.update_message(db, message_id, payload)
    return ContactRead.model_validate(message)


@router.delete("/messages/{message_id}", response_model=Message)
async def delete_message(message_id: uuid.UUID, db: DbSession, _: AdminUser) -> Message:
    await contact_service.delete_message(db, message_id)
    return Message(message="Message deleted.")


# --- FAQs ------------------------------------------------------------------
@router.get("/faqs", response_model=list[FaqRead])
async def admin_list_faqs(
    db: DbSession, _: AdminUser, category: str | None = Query(None)
) -> list[FaqRead]:
    rows = await misc_repo.list_faqs(db, category=category, published_only=False)
    return [FaqRead.model_validate(item) for item in rows]


@router.post("/faqs", response_model=FaqRead, status_code=status.HTTP_201_CREATED)
async def create_faq(payload: FaqWrite, db: DbSession, _: AdminUser) -> FaqRead:
    faq = Faq(**payload.model_dump())
    db.add(faq)
    await db.commit()
    await db.refresh(faq)
    return FaqRead.model_validate(faq)


@router.put("/faqs/{faq_id}", response_model=FaqRead)
async def update_faq(
    faq_id: uuid.UUID, payload: FaqUpdate, db: DbSession, _: AdminUser
) -> FaqRead:
    faq = await misc_repo.get_faq(db, faq_id)
    if faq is None:
        raise NotFoundError("FAQ not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(faq, field, value)
    await db.commit()
    await db.refresh(faq)
    return FaqRead.model_validate(faq)


@router.delete("/faqs/{faq_id}", response_model=Message)
async def delete_faq(faq_id: uuid.UUID, db: DbSession, _: AdminUser) -> Message:
    faq = await misc_repo.get_faq(db, faq_id)
    if faq is None:
        raise NotFoundError("FAQ not found.")
    await db.delete(faq)
    await db.commit()
    return Message(message="FAQ deleted.")


# --- Testimonials ----------------------------------------------------------
@router.get("/testimonials", response_model=list[TestimonialRead])
async def admin_list_testimonials(db: DbSession, _: AdminUser) -> list[TestimonialRead]:
    rows = await misc_repo.list_testimonials(db, published_only=False)
    return [TestimonialRead.model_validate(item) for item in rows]


@router.post(
    "/testimonials", response_model=TestimonialRead, status_code=status.HTTP_201_CREATED
)
async def create_testimonial(
    payload: TestimonialWrite, db: DbSession, _: AdminUser
) -> TestimonialRead:
    testimonial = Testimonial(**payload.model_dump())
    db.add(testimonial)
    await db.commit()
    await db.refresh(testimonial)
    return TestimonialRead.model_validate(testimonial)


@router.put("/testimonials/{testimonial_id}", response_model=TestimonialRead)
async def update_testimonial(
    testimonial_id: uuid.UUID, payload: TestimonialUpdate, db: DbSession, _: AdminUser
) -> TestimonialRead:
    testimonial = await misc_repo.get_testimonial(db, testimonial_id)
    if testimonial is None:
        raise NotFoundError("Testimonial not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(testimonial, field, value)
    await db.commit()
    await db.refresh(testimonial)
    return TestimonialRead.model_validate(testimonial)


@router.delete("/testimonials/{testimonial_id}", response_model=Message)
async def delete_testimonial(
    testimonial_id: uuid.UUID, db: DbSession, _: AdminUser
) -> Message:
    testimonial = await misc_repo.get_testimonial(db, testimonial_id)
    if testimonial is None:
        raise NotFoundError("Testimonial not found.")
    await db.delete(testimonial)
    await db.commit()
    return Message(message="Testimonial deleted.")


# --- Site settings ---------------------------------------------------------
@router.get("/settings", response_model=list[SiteSettingRead])
async def admin_list_settings(db: DbSession, _: AdminUser) -> list[SiteSettingRead]:
    rows = await misc_repo.list_settings(db, public_only=False)
    return [SiteSettingRead.model_validate(item) for item in rows]


@router.put("/settings/{key}", response_model=SiteSettingRead)
async def upsert_setting(
    key: str, payload: SiteSettingWrite, db: DbSession, _: AdminUser
) -> SiteSettingRead:
    setting = await misc_repo.upsert_setting(
        db,
        key,
        payload.value,
        description=payload.description,
        is_public=payload.is_public,
    )
    await db.commit()
    return SiteSettingRead.model_validate(setting)


# Re-exported for the admin course/certification pickers.
@router.get("/lookup/courses", response_model=list[dict])
async def lookup_courses(db: DbSession, _: AdminUser) -> list[dict]:
    from sqlalchemy import select

    from app.models.catalog import Course

    rows = await db.scalars(select(Course).order_by(Course.title))
    return [{"id": str(row.id), "title": row.title, "slug": row.slug} for row in rows]


@router.get("/lookup/certifications", response_model=list[dict])
async def lookup_certifications(db: DbSession, _: AdminUser) -> list[dict]:
    from sqlalchemy import select

    from app.models.certification import Certification

    rows = await db.scalars(select(Certification).order_by(Certification.name))
    return [{"id": str(row.id), "name": row.name, "slug": row.slug} for row in rows]
