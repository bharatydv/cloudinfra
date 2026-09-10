from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"


async def test_register_creates_account_and_returns_tokens(client: AsyncClient):
    response = await client.post(
        REGISTER,
        json={
            "name": "Ada Lovelace",
            "email": "ada@example.com",
            "password": "Passw0rd!",
            "confirm_password": "Passw0rd!",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user"]["email"] == "ada@example.com"
    assert body["user"]["role"] == "student"
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]
    # The password hash must never leave the server.
    assert "password" not in str(body)


async def test_register_rejects_mismatched_passwords(client: AsyncClient):
    response = await client.post(
        REGISTER,
        json={
            "name": "Test",
            "email": "mismatch@example.com",
            "password": "Passw0rd!",
            "confirm_password": "Different1!",
        },
    )
    assert response.status_code == 422


async def test_register_rejects_weak_password(client: AsyncClient):
    response = await client.post(
        REGISTER,
        json={
            "name": "Test",
            "email": "weak@example.com",
            "password": "password",
            "confirm_password": "password",
        },
    )
    assert response.status_code == 422


async def test_register_rejects_duplicate_email(client: AsyncClient, student):
    response = await client.post(
        REGISTER,
        json={
            "name": "Duplicate",
            "email": student.email,
            "password": "Passw0rd!",
            "confirm_password": "Passw0rd!",
        },
    )
    assert response.status_code == 409


async def test_login_success(client: AsyncClient, student):
    response = await client.post(
        LOGIN, json={"email": student.email, "password": "Passw0rd!"}
    )
    assert response.status_code == 200
    assert response.json()["tokens"]["token_type"] == "bearer"


async def test_login_wrong_password_is_401(client: AsyncClient, student):
    response = await client.post(
        LOGIN, json={"email": student.email, "password": "wrong-password"}
    )
    assert response.status_code == 401


async def test_login_unknown_email_is_401(client: AsyncClient):
    response = await client.post(
        LOGIN, json={"email": "nobody@example.com", "password": "Passw0rd!"}
    )
    assert response.status_code == 401


async def test_me_requires_authentication(client: AsyncClient):
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_me_returns_current_user(client: AsyncClient, student):
    login = await client.post(
        LOGIN, json={"email": student.email, "password": "Passw0rd!"}
    )
    token = login.json()["tokens"]["access_token"]
    response = await client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == student.email


async def test_refresh_rotates_token(client: AsyncClient, student):
    login = await client.post(
        LOGIN, json={"email": student.email, "password": "Passw0rd!"}
    )
    original = login.json()["tokens"]["refresh_token"]

    first = await client.post("/api/auth/refresh", json={"refresh_token": original})
    assert first.status_code == 200
    assert first.json()["refresh_token"] != original

    # The presented token is single-use.
    replay = await client.post("/api/auth/refresh", json={"refresh_token": original})
    assert replay.status_code == 401


async def test_invalid_token_is_rejected(client: AsyncClient):
    response = await client.get(
        "/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


async def test_forgot_password_does_not_leak_account_existence(client: AsyncClient):
    known = await client.post(
        "/api/auth/forgot-password", json={"email": "student@example.com"}
    )
    unknown = await client.post(
        "/api/auth/forgot-password", json={"email": "ghost@example.com"}
    )
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
