"""Test fixtures.

Tests run against a real PostgreSQL database (the schema uses JSONB and
full-text search, so SQLite is not a valid substitute). The database named by
TEST_DATABASE_URL is created and dropped around the session.

    docker compose up -d postgres
    cd backend && pytest
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator
from urllib.parse import urlsplit, urlunsplit

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")

from app.core.config import settings  # noqa: E402
from app.core.deps import get_current_user  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import *  # noqa: E402,F401,F403  (registers every table)
from app.models.enums import UserRole  # noqa: E402
from app.models.user import User  # noqa: E402


def _test_url() -> str:
    url = settings.test_database_url or settings.async_database_url
    if url == settings.async_database_url:
        parts = urlsplit(url)
        url = urlunsplit(parts._replace(path=parts.path + "_test"))
    return url


TEST_URL = _test_url()


def _admin_url(url: str) -> tuple[str, str]:
    """Return a connection URL to the maintenance DB plus the target DB name."""
    parts = urlsplit(url)
    db_name = parts.path.lstrip("/")
    return urlunsplit(parts._replace(path="/postgres")), db_name


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_database() -> AsyncGenerator[None, None]:
    admin_url, db_name = _admin_url(TEST_URL)
    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        await conn.exec_driver_sql(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)')
        await conn.exec_driver_sql(f'CREATE DATABASE "{db_name}"')
    await admin_engine.dispose()

    engine = create_async_engine(TEST_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()

    yield

    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        await conn.exec_driver_sql(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)')
    await admin_engine.dispose()


async def _truncate_all(conn) -> None:
    """Give every test an empty database without re-running DDL."""
    tables = ", ".join(f'"{table.name}"' for table in reversed(Base.metadata.sorted_tables))
    await conn.exec_driver_sql(f"TRUNCATE {tables} RESTART IDENTITY CASCADE")


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(TEST_URL)
    async with engine.begin() as conn:
        await _truncate_all(conn)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _override_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
    app.dependency_overrides.clear()


async def _make_user(db: AsyncSession, email: str, role: str, password: str) -> User:
    user = User(
        name=email.split("@")[0].title(),
        email=email,
        password_hash=hash_password(password),
        role=role,
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def student(db_session: AsyncSession) -> User:
    return await _make_user(
        db_session, "student@example.com", UserRole.STUDENT.value, "Passw0rd!"
    )


@pytest_asyncio.fixture
async def admin(db_session: AsyncSession) -> User:
    return await _make_user(
        db_session, "admin@example.com", UserRole.ADMIN.value, "Passw0rd!"
    )


def auth_override(user: User):
    """Bypass token issuance when a test only needs an authenticated identity."""

    async def _current_user() -> User:
        return user

    app.dependency_overrides[get_current_user] = _current_user


@pytest.fixture(autouse=True)
def _clear_auth_override():
    yield
    app.dependency_overrides.pop(get_current_user, None)
