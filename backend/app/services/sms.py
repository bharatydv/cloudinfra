"""Provider-agnostic transactional SMS, the mirror image of `email.py`.

Business logic depends on `SmsSender`, never on a vendor SDK. Swap providers
by changing SMS_PROVIDER; no call site changes.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SmsSender(Protocol):
    async def send(self, to: str, body: str) -> None: ...


class ConsoleSmsSender:
    """Development default: logs instead of sending."""

    async def send(self, to: str, body: str) -> None:
        logger.info("[sms:console] to=%s\n%s", to, body)


class NotConfiguredSmsSender:
    """Fails loudly rather than silently dropping messages in production."""

    def __init__(self, provider: str) -> None:
        self.provider = provider

    async def send(self, to: str, body: str) -> None:
        logger.error(
            "SMS provider %r is selected but not configured; dropping message to %s",
            self.provider,
            to,
        )


class TwilioSmsSender:
    """Twilio's Messages API, authenticated with the account SID and token."""

    async def send(self, to: str, body: str) -> None:
        sid = settings.sms_account_sid or ""
        async with httpx.AsyncClient(
            timeout=30, auth=(sid, settings.sms_auth_token or "")
        ) as client:
            response = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                data={"From": settings.sms_from_number, "To": to, "Body": body},
            )
            response.raise_for_status()


@lru_cache
def get_sms_sender() -> SmsSender:
    if settings.sms_provider == "console":
        return ConsoleSmsSender()
    if settings.sms_provider == "twilio":
        if not (settings.sms_account_sid and settings.sms_auth_token and settings.sms_from_number):
            return NotConfiguredSmsSender(
                "twilio (SMS_ACCOUNT_SID, SMS_AUTH_TOKEN and SMS_FROM_NUMBER are all required)"
            )
        return TwilioSmsSender()
    return NotConfiguredSmsSender(settings.sms_provider)


async def send_sms(to: str, body: str) -> None:
    await get_sms_sender().send(to, body)


# --- Templates ---------------------------------------------------------------
def verification_sms(code: str) -> str:
    return (
        f"Your {settings.email_from_name} verification code is {code}. "
        f"It expires in {settings.contact_verification_code_expire_minutes} minutes."
    )
