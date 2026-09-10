from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import ContactStatus, PaymentStatus, SearchEntity
from app.schemas.common import ORMModel


# --------------------------------------------------------------------------
# Contact
# --------------------------------------------------------------------------
class ContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=10, max_length=5000)
    # Honeypot: real users never fill this in.
    website: str | None = Field(default=None, max_length=200)


class ContactRead(ORMModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    subject: str
    message: str
    status: ContactStatus
    admin_notes: str | None = None
    created_at: datetime


class ContactUpdate(BaseModel):
    status: ContactStatus | None = None
    admin_notes: str | None = Field(default=None, max_length=2000)


# --------------------------------------------------------------------------
# Search
# --------------------------------------------------------------------------
class SearchResult(BaseModel):
    type: SearchEntity
    id: uuid.UUID
    title: str
    description: str
    url: str
    category: str | None = None
    metadata: dict[str, Any] = {}
    rank: float = 0.0


class SearchResponse(BaseModel):
    query: str
    total: int
    results: list[SearchResult] = []
    counts: dict[str, int] = {}


# --------------------------------------------------------------------------
# Payments
# --------------------------------------------------------------------------
class PaymentCreate(BaseModel):
    course_id: uuid.UUID


class PaymentRead(ORMModel):
    id: uuid.UUID
    course_id: uuid.UUID | None = None
    amount: Decimal
    currency: str
    payment_provider: str
    transaction_id: str | None = None
    status: PaymentStatus
    paid_at: datetime | None = None
    created_at: datetime


class PaymentIntentResponse(BaseModel):
    payment_id: uuid.UUID
    provider: str
    status: PaymentStatus
    # Where the browser should be sent. Success is never trusted from the client.
    checkout_url: str | None = None
    client_secret: str | None = None
    amount: Decimal
    currency: str


# --------------------------------------------------------------------------
# Analytics
# --------------------------------------------------------------------------
class AnalyticsEventCreate(BaseModel):
    event_name: str = Field(min_length=2, max_length=80)
    entity_type: str | None = Field(default=None, max_length=40)
    entity_id: str | None = Field(default=None, max_length=80)
    session_id: str | None = Field(default=None, max_length=80)
    path: str | None = Field(default=None, max_length=500)
    properties: dict[str, Any] = {}


# --------------------------------------------------------------------------
# Site settings / admin
# --------------------------------------------------------------------------
class SiteSettingRead(ORMModel):
    key: str
    value: dict[str, Any]
    description: str | None = None
    is_public: bool


class SiteSettingWrite(BaseModel):
    value: dict[str, Any]
    description: str | None = None
    is_public: bool = True


class AdminStatCounts(BaseModel):
    users: int
    students: int
    courses: int
    published_courses: int
    certifications: int
    articles: int
    published_articles: int
    enrollments: int
    active_enrollments: int
    contact_messages: int
    new_contact_messages: int
    revenue_total: Decimal
    revenue_currency: str


class AdminRecentUser(ORMModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    role: str
    created_at: datetime


class AdminRecentEnrollment(BaseModel):
    id: uuid.UUID
    user_name: str
    course_title: str
    status: str
    enrolled_at: datetime


class AdminDashboard(BaseModel):
    stats: AdminStatCounts
    recent_users: list[AdminRecentUser] = []
    recent_enrollments: list[AdminRecentEnrollment] = []
    recent_messages: list[ContactRead] = []
