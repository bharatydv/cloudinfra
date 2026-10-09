"""The signature and claim checks on a Google ID token.

A token is signed here with a throwaway RSA key that is then published into the
module's key cache, so the real verification path runs without calling Google.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk, jwt

from app.core.config import settings
from app.core.errors import AuthenticationError
from app.services import google_oauth

pytestmark = pytest.mark.asyncio

CLIENT_ID = "test-client-id.apps.googleusercontent.com"
KID = "test-kid"


@pytest.fixture(scope="module")
def signing_key() -> tuple[str, dict]:
    """A private key in PEM form plus the matching public JWK."""
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem = (
        private.public_key()
        .public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    public_jwk = {**jwk.construct(public_pem, "RS256").to_dict(), "kid": KID}
    return pem, public_jwk


@pytest.fixture(autouse=True)
def _configured(monkeypatch: pytest.MonkeyPatch, signing_key) -> None:
    _, public_jwk = signing_key
    monkeypatch.setattr(settings, "google_client_id", CLIENT_ID)
    monkeypatch.setattr(google_oauth, "_keys", {KID: public_jwk})
    monkeypatch.setattr(google_oauth, "_fetched_at", datetime.now(UTC))

    async def _no_network() -> None:
        raise AssertionError("verification must not call Google when the key is cached")

    monkeypatch.setattr(google_oauth, "_fetch_keys", _no_network)


def _token(signing_key, *, kid: str = KID, **claims: object) -> str:
    pem, _ = signing_key
    now = datetime.now(UTC)
    payload = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "1234567890",
        "email": "Grace@Example.com",
        "email_verified": True,
        "name": "Grace Hopper",
        "picture": "https://lh3.example/photo.jpg",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=1)).timestamp()),
        **claims,
    }
    return jwt.encode(payload, pem, algorithm="RS256", headers={"kid": kid})


async def test_accepts_a_properly_signed_token(signing_key):
    identity = await google_oauth.verify_id_token(_token(signing_key))
    assert identity.sub == "1234567890"
    # Addresses are normalised, so the same account cannot be created twice.
    assert identity.email == "grace@example.com"
    assert identity.name == "Grace Hopper"
    assert identity.picture == "https://lh3.example/photo.jpg"


async def test_rejects_a_token_minted_for_another_audience(signing_key):
    with pytest.raises(AuthenticationError):
        await google_oauth.verify_id_token(_token(signing_key, aud="someone-else"))


async def test_rejects_a_token_from_another_issuer(signing_key):
    with pytest.raises(AuthenticationError):
        await google_oauth.verify_id_token(
            _token(signing_key, iss="https://accounts.evil.example")
        )


async def test_rejects_an_expired_token(signing_key):
    expired = int((datetime.now(UTC) - timedelta(minutes=5)).timestamp())
    with pytest.raises(AuthenticationError):
        await google_oauth.verify_id_token(_token(signing_key, exp=expired))


async def test_rejects_a_token_signed_by_an_unknown_key(signing_key, monkeypatch):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = other.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    forged = jwt.encode(
        {
            "iss": "https://accounts.google.com",
            "aud": CLIENT_ID,
            "sub": "1234567890",
            "email": "grace@example.com",
            "email_verified": True,
            "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
        },
        pem,
        algorithm="RS256",
        # Claims the cached key id, so only the signature check can catch it.
        headers={"kid": KID},
    )
    with pytest.raises(AuthenticationError):
        await google_oauth.verify_id_token(forged)


async def test_rejects_an_unverified_email(signing_key):
    with pytest.raises(AuthenticationError):
        await google_oauth.verify_id_token(_token(signing_key, email_verified=False))


async def test_falls_back_to_the_local_part_when_google_sends_no_name(signing_key):
    identity = await google_oauth.verify_id_token(_token(signing_key, name=""))
    assert identity.name == "grace"


async def test_refuses_when_no_client_id_is_configured(signing_key, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", None)
    with pytest.raises(AuthenticationError):
        await google_oauth.verify_id_token(_token(signing_key))


async def test_an_unknown_key_id_refetches_once_the_floor_has_passed(
    signing_key, monkeypatch
):
    calls = 0

    async def _fetch() -> None:
        nonlocal calls
        calls += 1

    monkeypatch.setattr(google_oauth, "_fetch_keys", _fetch)
    # Older than the refetch floor but well inside the cache TTL, so only the
    # unrecognised key id can be what prompts the call.
    monkeypatch.setattr(
        google_oauth, "_fetched_at", datetime.now(UTC) - timedelta(minutes=2)
    )
    with pytest.raises(AuthenticationError):
        await google_oauth.verify_id_token(_token(signing_key, kid="rotated-kid"))
    assert calls == 1


async def test_an_unknown_key_id_does_not_refetch_inside_the_floor(
    signing_key, monkeypatch
):
    """A stream of bogus key ids must not become a stream of calls to Google."""
    calls = 0

    async def _fetch() -> None:
        nonlocal calls
        calls += 1

    monkeypatch.setattr(google_oauth, "_fetch_keys", _fetch)
    monkeypatch.setattr(google_oauth, "_fetched_at", datetime.now(UTC))
    for _ in range(3):
        with pytest.raises(AuthenticationError):
            await google_oauth.verify_id_token(_token(signing_key, kid="bogus-kid"))
    assert calls == 0
