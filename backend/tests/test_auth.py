from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.services import auth_service

pytestmark = pytest.mark.asyncio

REGISTER = "/api/auth/register"
VERIFY_EMAIL = "/api/auth/verify-email"
RESEND_VERIFICATION = "/api/auth/resend-verification"
LOGIN = "/api/auth/login"

VALID_REGISTRATION = {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "phone": "+1 555-123-4567",
    "password": "Passw0rd!",
    "confirm_password": "Passw0rd!",
}


def _fixed_code(monkeypatch: pytest.MonkeyPatch, code: str = "123456") -> None:
    monkeypatch.setattr(auth_service, "generate_numeric_code", lambda: code)


async def test_register_creates_unverified_account_and_sends_a_code(
    client: AsyncClient, monkeypatch
):
    _fixed_code(monkeypatch)
    response = await client.post(REGISTER, json=VALID_REGISTRATION)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "ada@example.com"
    # No session until the code is confirmed.
    assert "tokens" not in body
    assert "password" not in str(body)


async def test_register_rejects_mismatched_passwords(client: AsyncClient):
    response = await client.post(
        REGISTER,
        json={**VALID_REGISTRATION, "email": "mismatch@example.com", "confirm_password": "Different1!"},
    )
    assert response.status_code == 422


async def test_register_rejects_weak_password(client: AsyncClient):
    response = await client.post(
        REGISTER,
        json={
            **VALID_REGISTRATION,
            "email": "weak@example.com",
            "password": "password",
            "confirm_password": "password",
        },
    )
    assert response.status_code == 422


async def test_register_rejects_invalid_phone(client: AsyncClient):
    response = await client.post(
        REGISTER, json={**VALID_REGISTRATION, "email": "nophone@example.com", "phone": "abc"}
    )
    assert response.status_code == 422


async def test_register_rejects_duplicate_email(client: AsyncClient, student):
    response = await client.post(REGISTER, json={**VALID_REGISTRATION, "email": student.email})
    assert response.status_code == 409


async def test_verify_email_issues_tokens(client: AsyncClient, monkeypatch):
    _fixed_code(monkeypatch)
    await client.post(REGISTER, json=VALID_REGISTRATION)

    response = await client.post(
        VERIFY_EMAIL, json={"email": VALID_REGISTRATION["email"], "code": "123456"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["is_email_verified"] is True
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]


async def test_verify_email_rejects_wrong_code(client: AsyncClient, monkeypatch):
    _fixed_code(monkeypatch)
    await client.post(REGISTER, json=VALID_REGISTRATION)

    response = await client.post(
        VERIFY_EMAIL, json={"email": VALID_REGISTRATION["email"], "code": "000000"}
    )
    assert response.status_code == 422


async def test_login_blocked_until_email_is_verified(client: AsyncClient, monkeypatch):
    _fixed_code(monkeypatch)
    await client.post(REGISTER, json=VALID_REGISTRATION)

    response = await client.post(
        LOGIN, json={"email": VALID_REGISTRATION["email"], "password": VALID_REGISTRATION["password"]}
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "email_not_verified"


async def test_resend_verification_does_not_leak_account_existence(client: AsyncClient):
    known = await client.post(RESEND_VERIFICATION, json={"email": "student@example.com"})
    unknown = await client.post(RESEND_VERIFICATION, json={"email": "ghost@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()


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
