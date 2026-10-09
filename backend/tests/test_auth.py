from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.services import auth_service, google_oauth

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


async def _legacy_unverified_account(db, monkeypatch, code: str = "123456") -> User:
    """An account from before sign-up stopped confirming the address.

    Registration cannot produce one any more, so the tests that guard the
    verification path have to build it directly.
    """
    _fixed_code(monkeypatch, code)
    user = User(
        name="Ada Lovelace",
        email=VALID_REGISTRATION["email"],
        phone=VALID_REGISTRATION["phone"],
        password_hash=hash_password(VALID_REGISTRATION["password"]),
        role=UserRole.STUDENT.value,
        is_email_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await auth_service._send_verification_code(db, user)
    return user


async def test_register_signs_the_new_account_straight_in(client: AsyncClient):
    response = await client.post(REGISTER, json=VALID_REGISTRATION)
    assert response.status_code == 201, response.text

    body = response.json()
    assert body["user"]["email"] == "ada@example.com"
    # No code to type: the account is usable immediately.
    assert body["user"]["is_email_verified"] is True
    assert body["tokens"]["access_token"]
    # The credential itself never comes back, in either form.
    assert VALID_REGISTRATION["password"] not in str(body)
    assert "password_hash" not in str(body)

    me = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {body['tokens']['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "ada@example.com"


async def test_register_then_login_works_without_any_verification_step(
    client: AsyncClient,
):
    await client.post(REGISTER, json=VALID_REGISTRATION)
    response = await client.post(
        LOGIN,
        json={
            "email": VALID_REGISTRATION["email"],
            "password": VALID_REGISTRATION["password"],
        },
    )
    assert response.status_code == 200, response.text


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


async def test_verify_email_still_rescues_a_legacy_account(
    client: AsyncClient, db_session, monkeypatch
):
    await _legacy_unverified_account(db_session, monkeypatch)

    response = await client.post(
        VERIFY_EMAIL, json={"email": VALID_REGISTRATION["email"], "code": "123456"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["is_email_verified"] is True
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]


async def test_verify_email_rejects_wrong_code(
    client: AsyncClient, db_session, monkeypatch
):
    await _legacy_unverified_account(db_session, monkeypatch)

    response = await client.post(
        VERIFY_EMAIL, json={"email": VALID_REGISTRATION["email"], "code": "000000"}
    )
    assert response.status_code == 422


async def test_login_is_still_blocked_for_an_unverified_legacy_account(
    client: AsyncClient, db_session, monkeypatch
):
    """The gate stays: dropping it would open every account that never verified."""
    await _legacy_unverified_account(db_session, monkeypatch)

    response = await client.post(
        LOGIN,
        json={
            "email": VALID_REGISTRATION["email"],
            "password": VALID_REGISTRATION["password"],
        },
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


# --- Google sign-in ---------------------------------------------------------
GOOGLE = "/api/auth/google"
PROVIDERS = "/api/auth/providers"


def _google_identity(monkeypatch: pytest.MonkeyPatch, **overrides) -> None:
    """Stand in for Google: the signature check has its own tests upstream."""
    identity = google_oauth.GoogleIdentity(
        sub=overrides.get("sub", "google-subject-1"),
        email=overrides.get("email", "grace@example.com"),
        name=overrides.get("name", "Grace Hopper"),
        picture=overrides.get("picture", "https://lh3.example/photo.jpg"),
    )

    async def _verify(credential: str) -> google_oauth.GoogleIdentity:
        assert credential
        return identity

    monkeypatch.setattr(google_oauth, "verify_id_token", _verify)


async def test_providers_reports_google_off_when_unconfigured(client: AsyncClient):
    response = await client.get(PROVIDERS)
    assert response.status_code == 200
    assert response.json()["google"] == {"enabled": False, "client_id": None}


async def test_google_sign_in_creates_a_verified_account(client: AsyncClient, monkeypatch):
    _google_identity(monkeypatch)
    response = await client.post(GOOGLE, json={"credential": "an-id-token"})
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["user"]["email"] == "grace@example.com"
    assert body["user"]["name"] == "Grace Hopper"
    # Google vouched for the address, so there is no code to confirm.
    assert body["user"]["is_email_verified"] is True
    assert body["user"]["has_password"] is False
    assert body["tokens"]["access_token"]

    # The session works like any other.
    me = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {body['tokens']['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "grace@example.com"


async def test_google_sign_in_is_idempotent(client: AsyncClient, monkeypatch):
    _google_identity(monkeypatch)
    first = await client.post(GOOGLE, json={"credential": "an-id-token"})
    second = await client.post(GOOGLE, json={"credential": "another-id-token"})
    assert first.status_code == second.status_code == 200
    # The second visit signs the same person in rather than conflicting.
    assert first.json()["user"]["id"] == second.json()["user"]["id"]


async def test_google_sign_in_links_an_existing_password_account(
    client: AsyncClient, student, monkeypatch
):
    _google_identity(monkeypatch, email=student.email, name="Someone Else")
    response = await client.post(GOOGLE, json={"credential": "an-id-token"})
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["user"]["id"] == str(student.id)
    # Linking must not overwrite the name the person chose here.
    assert body["user"]["name"] == student.name
    # The password still works afterwards.
    assert body["user"]["has_password"] is True
    login = await client.post(LOGIN, json={"email": student.email, "password": "Passw0rd!"})
    assert login.status_code == 200


async def test_password_login_is_refused_for_a_google_only_account(
    client: AsyncClient, monkeypatch
):
    _google_identity(monkeypatch)
    await client.post(GOOGLE, json={"credential": "an-id-token"})

    response = await client.post(
        LOGIN, json={"email": "grace@example.com", "password": "Passw0rd!"}
    )
    assert response.status_code == 401


async def test_google_sign_in_refuses_a_deactivated_account(
    client: AsyncClient, db_session, student, monkeypatch
):
    student.is_active = False
    await db_session.commit()

    _google_identity(monkeypatch, email=student.email)
    response = await client.post(GOOGLE, json={"credential": "an-id-token"})
    assert response.status_code == 401


async def test_google_sign_in_is_refused_when_unconfigured(client: AsyncClient):
    # No GOOGLE_CLIENT_ID in the test environment, so verification never starts.
    response = await client.post(GOOGLE, json={"credential": "an-id-token"})
    assert response.status_code == 401
