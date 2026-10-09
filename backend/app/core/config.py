"""Application configuration.

All values come from the environment (or a local .env file). Nothing secret is
ever hardcoded here -- see .env.example at the repository root.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Later files win in pydantic-settings, so the backend's own .env is
        # listed last: it overrides the repo-root .env that docker-compose uses.
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    # --- Core -----------------------------------------------------------
    environment: Literal["development", "test", "staging", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"
    project_name: str = "Inferacloud API"
    api_v1_prefix: str = "/api"

    # --- Database -------------------------------------------------------
    database_url: str = "postgresql+asyncpg://learnbase:learnbase@localhost:5432/learnbase"
    test_database_url: str | None = None
    db_echo: bool = False
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # --- Security -------------------------------------------------------
    jwt_secret: str = "insecure-development-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    password_hash_scheme: Literal["argon2", "bcrypt"] = "argon2"
    password_reset_token_expire_minutes: int = 60
    email_verification_code_expire_minutes: int = 15

    # --- Google sign-in -------------------------------------------------
    # The OAuth 2.0 Web client ID from the Google Cloud console. Leaving it
    # unset switches Google sign-in off: /auth/providers reports it as
    # disabled, the button never renders, and /auth/google refuses.
    # No client secret is needed -- the browser flow returns a signed ID token
    # which the backend verifies against Google's public keys.
    google_client_id: str | None = None

    # --- URLs / CORS ----------------------------------------------------
    frontend_url: str = "http://localhost:5173"
    public_site_url: str = "http://localhost:5173"
    # Comma-separated in the environment; parsed by `backend_cors_origins`.
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:8080",
        alias="BACKEND_CORS_ORIGINS",
    )

    # --- Rate limiting --------------------------------------------------
    rate_limit_enabled: bool = True
    rate_limit_default: str = "120/minute"
    rate_limit_auth: str = "10/minute"

    # --- Optional infrastructure ---------------------------------------
    redis_url: str | None = None

    payment_provider: Literal["noop", "stripe", "razorpay"] = "noop"
    payment_provider_key: str | None = None
    payment_provider_secret: str | None = None
    payment_webhook_secret: str | None = None
    payment_currency: str = "USD"

    email_provider: Literal["console", "smtp", "resend"] = "console"
    email_provider_key: str | None = None
    # Default sender: verification codes, password resets and other mail nobody
    # should reply to.
    email_from_address: str = "no-reply@example.com"
    email_from_name: str = "Inferacloud"
    # Sender for mail a person follows up on: test results, exam scheduling
    # receipts and the internal alerts about them. Falls back to the default.
    email_contact_address: str | None = None
    # SMTP transport, used when email_provider is "smtp". Any mailbox with an
    # SMTP relay works (Google Workspace, Zoho, Outlook, SES, Brevo...).
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    # STARTTLS on 587 is the common case; set smtp_use_ssl for implicit TLS on 465.
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    # Where a qualified challenge lead is announced so somebody calls it back
    # inside the window the result page promises. Unset means the admin
    # console queue is the only place a lead surfaces.
    sales_notification_email: str | None = None

    sms_provider: Literal["console", "twilio"] = "console"
    sms_account_sid: str | None = None
    sms_auth_token: str | None = None
    sms_from_number: str | None = None

    # --- Contact verification (guest sign-up for the challenge) ----------
    # Off where email or SMS cannot actually be delivered: a guest asked for a
    # code that never arrives cannot start the test at all.
    contact_verification_required: bool = True
    contact_verification_code_expire_minutes: int = 10
    # How long a confirmed address stays usable for starting a paper.
    contact_verification_valid_minutes: int = 60
    contact_verification_max_attempts: int = 5

    storage_provider: Literal["local", "s3"] = "local"
    storage_endpoint_url: str | None = None
    storage_region: str | None = None
    storage_access_key: str | None = None
    storage_secret_key: str | None = None
    storage_bucket: str | None = None
    storage_public_base_url: str | None = None

    analytics_provider: Literal["noop", "ga4", "plausible", "posthog"] = "noop"
    analytics_site_id: str | None = None

    # --- Seeding (development only) -------------------------------------
    seed_admin_email: str = "admin@example.com"
    seed_admin_password: str = "Admin123!change"
    seed_admin_name: str = "Platform Admin"

    @property
    def backend_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def google_sign_in_enabled(self) -> bool:
        return bool(self.google_client_id)

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def async_database_url(self) -> str:
        """Normalised async SQLAlchemy URL (Alembic uses the same async engine)."""
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
