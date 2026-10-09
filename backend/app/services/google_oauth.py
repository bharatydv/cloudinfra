"""Verification of the ID token Google Identity Services hands the browser.

The browser is never trusted. The credential it posts to /auth/google is only
accepted once its signature has been checked against Google's published keys
and its audience confirmed to be this site's own OAuth client.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from jose import JWTError, jwt

from app.core.config import settings
from app.core.errors import AuthenticationError

logger = logging.getLogger(__name__)

JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
#: Google signs with either spelling of its issuer, so both are accepted.
ISSUERS = ("https://accounts.google.com", "accounts.google.com")

#: Google rotates its signing keys, so the cache is short-lived.
_CACHE_TTL = timedelta(hours=1)
#: A token naming an unknown key forces a refetch -- but at most this often, so
#: a stream of bogus credentials cannot turn into a stream of calls to Google.
_REFETCH_FLOOR = timedelta(minutes=1)

# One generic message for every rejection: which part of a forged token failed
# is not the client's business.
_REJECTED = "We could not verify that Google sign-in. Please try again."

_keys: dict[str, dict[str, Any]] = {}
_fetched_at: datetime | None = None


@dataclass(frozen=True)
class GoogleIdentity:
    """The claims we use, pulled from a verified ID token."""

    sub: str
    email: str
    name: str
    picture: str | None


async def _fetch_keys() -> None:
    global _keys, _fetched_at
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(JWKS_URL)
        response.raise_for_status()
        keys = response.json().get("keys", [])
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Could not fetch Google's signing keys: %s", exc)
        # Keep whatever is cached: a stale key still verifies tokens Google
        # signed with it, which beats failing every sign-in.
        _fetched_at = datetime.now(UTC) - _CACHE_TTL + _REFETCH_FLOOR
        return

    _keys = {key["kid"]: key for key in keys if isinstance(key, dict) and key.get("kid")}
    _fetched_at = datetime.now(UTC)


async def _key_for(kid: str) -> dict[str, Any]:
    now = datetime.now(UTC)
    age = None if _fetched_at is None else now - _fetched_at
    expired = age is None or age >= _CACHE_TTL
    unknown = kid not in _keys and (age is None or age >= _REFETCH_FLOOR)
    if expired or unknown:
        await _fetch_keys()

    key = _keys.get(kid)
    if key is None:
        logger.info("Google credential named signing key %s, which is not published", kid)
        raise AuthenticationError(_REJECTED)
    return key


def _reset_cache() -> None:
    """Drop the cached keys. Used by the tests."""
    global _keys, _fetched_at
    _keys = {}
    _fetched_at = None


async def verify_id_token(credential: str) -> GoogleIdentity:
    """Check a Google ID token and return the identity it asserts."""
    if not settings.google_client_id:
        raise AuthenticationError("Google sign-in is not enabled on this site.")

    try:
        kid = jwt.get_unverified_header(credential).get("kid")
    except JWTError:
        raise AuthenticationError(_REJECTED) from None
    if not kid:
        raise AuthenticationError(_REJECTED)

    key = await _key_for(str(kid))
    try:
        claims = jwt.decode(
            credential,
            key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=ISSUERS,
        )
    except JWTError as exc:
        # Expiry, a wrong audience and a bad signature all land here.
        logger.info("Rejected a Google credential: %s", exc)
        raise AuthenticationError(_REJECTED) from None

    sub = str(claims.get("sub") or "").strip()
    email = str(claims.get("email") or "").strip().lower()
    if not sub or not email:
        raise AuthenticationError(_REJECTED)

    # Without this an account could be claimed by anyone who adds the address
    # to a Google profile without proving they own it.
    if claims.get("email_verified") not in (True, "true"):
        raise AuthenticationError(
            "Google has not verified that email address, so we cannot sign you in with it."
        )

    name = str(claims.get("name") or "").strip() or email.split("@")[0]
    picture = str(claims.get("picture") or "").strip() or None
    return GoogleIdentity(
        sub=sub[:64],
        email=email,
        name=name[:120],
        picture=picture[:500] if picture else None,
    )
