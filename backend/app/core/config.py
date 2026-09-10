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
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    # --- Core -----------------------------------------------------------
    environment: Literal["development", "test", "staging", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"
    project_name: str = "LearnBase API"
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

    payment_provider: Literal["noop", "stripe"] = "noop"
    payment_provider_key: str | None = None
    payment_provider_secret: str | None = None
    payment_webhook_secret: str | None = None
    payment_currency: str = "USD"

    email_provider: Literal["console", "smtp", "resend"] = "console"
    email_provider_key: str | None = None
    email_from_address: str = "no-reply@example.com"
    email_from_name: str = "LearnBase"

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
