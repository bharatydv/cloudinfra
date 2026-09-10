"""Payment provider abstraction.

Rules enforced here:
  * The browser never decides that a payment succeeded.
  * Only `handle_webhook` (signature-verified) may promote a payment to
    `successful`, which is what grants the enrollment.
  * Raw card data never reaches this service.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from dataclasses import dataclass
from decimal import Decimal
from functools import lru_cache
from typing import Any, Protocol

from app.core.config import settings
from app.core.errors import ValidationFailedError
from app.models.enums import PaymentStatus

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class CheckoutSession:
    provider: str
    reference: str
    status: PaymentStatus
    checkout_url: str | None = None
    client_secret: str | None = None


@dataclass(slots=True)
class WebhookResult:
    reference: str
    status: PaymentStatus
    transaction_id: str | None = None
    raw: dict[str, Any] | None = None


class PaymentProvider(Protocol):
    name: str

    async def create_checkout(
        self, *, amount: Decimal, currency: str, reference: str, description: str
    ) -> CheckoutSession: ...

    def verify_webhook(self, payload: bytes, signature: str | None) -> dict[str, Any]: ...

    def parse_webhook(self, event: dict[str, Any]) -> WebhookResult | None: ...


class NoopPaymentProvider:
    """Default provider for environments without payment credentials.

    Creates a pending payment and a local confirmation URL. It never marks a
    payment successful on its own, so free enrollment stays the only path that
    grants access until a real provider is configured.
    """

    name = "noop"

    async def create_checkout(
        self, *, amount: Decimal, currency: str, reference: str, description: str
    ) -> CheckoutSession:
        logger.info(
            "Noop checkout created reference=%s amount=%s %s (%s)",
            reference,
            amount,
            currency,
            description,
        )
        return CheckoutSession(
            provider=self.name,
            reference=reference,
            status=PaymentStatus.PENDING,
            checkout_url=f"{settings.public_site_url}/checkout/{reference}",
        )

    def verify_webhook(self, payload: bytes, signature: str | None) -> dict[str, Any]:
        secret = settings.payment_webhook_secret
        if not secret:
            raise ValidationFailedError("Payment webhooks are not configured.")
        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        if not signature or not hmac.compare_digest(expected, signature):
            raise ValidationFailedError("Invalid webhook signature.")
        import json

        return json.loads(payload.decode("utf-8"))

    def parse_webhook(self, event: dict[str, Any]) -> WebhookResult | None:
        reference = event.get("reference")
        status = event.get("status")
        if not reference or status not in set(PaymentStatus):
            return None
        return WebhookResult(
            reference=str(reference),
            status=PaymentStatus(status),
            transaction_id=event.get("transaction_id"),
            raw=event,
        )


class StripePaymentProvider(NoopPaymentProvider):
    """Placeholder for the real Stripe integration.

    Kept as a subclass so wiring, routes and webhook handling are already in
    place; only the two provider calls need real SDK code.
    """

    name = "stripe"

    async def create_checkout(
        self, *, amount: Decimal, currency: str, reference: str, description: str
    ) -> CheckoutSession:
        if not settings.payment_provider_secret:
            raise ValidationFailedError("Payments are not configured.")
        raise NotImplementedError(
            "Install stripe and create a Checkout Session here, passing "
            "client_reference_id=reference."
        )


@lru_cache
def get_payment_provider() -> PaymentProvider:
    if settings.payment_provider == "stripe":
        return StripePaymentProvider()
    return NoopPaymentProvider()
