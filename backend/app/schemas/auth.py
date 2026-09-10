from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.enums import UserRole
from app.schemas.common import ORMModel

PASSWORD_MIN_LENGTH = 8
_HAS_LETTER = re.compile(r"[A-Za-z]")
_HAS_DIGIT = re.compile(r"\d")


def _validate_password_strength(value: str) -> str:
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")
    if not _HAS_LETTER.search(value) or not _HAS_DIGIT.search(value):
        raise ValueError("Password must contain at least one letter and one number.")
    return value


class UserPublic(ORMModel):
    id: uuid.UUID
    name: str
    headline: str | None = None
    profile_image: str | None = None


class UserRead(ORMModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    role: UserRole
    profile_image: str | None = None
    headline: str | None = None
    bio: str | None = None
    is_active: bool
    is_email_verified: bool
    created_at: datetime
    last_login_at: datetime | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    headline: str | None = Field(default=None, max_length=160)
    bio: str | None = Field(default=None, max_length=2000)
    profile_image: str | None = Field(default=None, max_length=500)


class AdminUserUpdate(UserUpdate):
    role: UserRole | None = None
    is_active: bool | None = None


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=128)
    confirm_password: str

    @field_validator("password")
    @classmethod
    def _strength(cls, value: str) -> str:
        return _validate_password_strength(value)

    @model_validator(mode="after")
    def _passwords_match(self) -> RegisterRequest:
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    user: UserRead
    tokens: TokenPair


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=128)
    confirm_password: str

    @field_validator("password")
    @classmethod
    def _strength(cls, value: str) -> str:
        return _validate_password_strength(value)

    @model_validator(mode="after")
    def _passwords_match(self) -> ResetPasswordRequest:
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _strength(cls, value: str) -> str:
        return _validate_password_strength(value)
