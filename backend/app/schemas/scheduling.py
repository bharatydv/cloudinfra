from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.enums import ExamBookingStatus, ExamDeliveryMode
from app.schemas.certification import ExamPricing
from app.schemas.common import ORMModel

# Kept short and fixed so the admin console can group requests by slot rather
# than parsing free text.
TIME_SLOTS = ("morning", "afternoon", "evening")


class ExamBookingCreate(BaseModel):
    # --- Contact ---
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=40)
    country: str = Field(min_length=2, max_length=80)
    city: str | None = Field(default=None, max_length=120)

    # --- Exam ---
    certification_id: uuid.UUID

    # --- Scheduling ---
    preferred_date: date
    alternate_date: date | None = None
    preferred_time_slot: str = Field(default="morning", max_length=40)
    timezone: str = Field(min_length=2, max_length=80)
    delivery_mode: ExamDeliveryMode = ExamDeliveryMode.ONLINE_PROCTORED

    # Honeypot: real users never fill this in.
    website: str | None = Field(default=None, max_length=200)

    @field_validator("preferred_time_slot")
    @classmethod
    def _known_slot(cls, value: str) -> str:
        slot = value.strip().lower()
        if slot not in TIME_SLOTS:
            raise ValueError(f"Choose one of: {', '.join(TIME_SLOTS)}.")
        return slot

    @field_validator("preferred_date")
    @classmethod
    def _not_in_the_past(cls, value: date) -> date:
        # Compared against UTC so a request is never rejected for a timezone
        # the applicant is not in.
        if value < datetime.now(UTC).date():
            raise ValueError("Choose a date that is not in the past.")
        return value

    @model_validator(mode="after")
    def _alternate_after_preferred(self) -> ExamBookingCreate:
        if self.alternate_date and self.alternate_date <= self.preferred_date:
            raise ValueError("The alternate date must be later than the preferred date.")
        return self


class ExamBookingRead(ORMModel):
    id: uuid.UUID
    reference_code: str
    user_id: uuid.UUID | None = None
    full_name: str
    email: EmailStr
    phone: str
    country: str
    city: str | None = None
    certification_id: uuid.UUID | None = None
    certification_name: str
    exam_code: str | None = None
    preferred_date: date
    alternate_date: date | None = None
    preferred_time_slot: str
    timezone: str
    delivery_mode: ExamDeliveryMode
    status: ExamBookingStatus
    admin_notes: str | None = None
    created_at: datetime


class ExamBookingUpdate(BaseModel):
    status: ExamBookingStatus | None = None
    admin_notes: str | None = Field(default=None, max_length=2000)


class ExamBookingReceipt(BaseModel):
    """What the confirmation screen needs to route the applicant onwards."""

    message: str
    reference_code: str
    certification_name: str
    # Deep link back to the certification the request was made against, so the
    # success screen can offer it without a second round trip.
    certification_url: str | None = None


class CertificationOption(BaseModel):
    """Minimal certification record used to populate the scheduling form."""

    id: uuid.UUID
    name: str
    exam_code: str | None = None
    provider_name: str
    url: str
    # Carried so the form can price the exam the moment one is picked, without
    # a second request per selection. None when the exam has no quoted price.
    pricing: ExamPricing | None = None
