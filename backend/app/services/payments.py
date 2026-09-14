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
from decimal import ROUND_HALF_UP, Decimal
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


# Razorpay quotes every amount in the currency's smallest unit. Getting this
# wrong is a 100x money bug in either direction, so the conversion lives in one
# place and is unit tested.
_ZERO_DECIMAL_CURRENCIES = frozenset({"JPY", "KRW", "VND", "CLP", "ISK"})


def to_minor_units(amount: Decimal, currency: str) -> int:
    """Convert a decimal amount to the provider's integer minor units."""
    if currency.upper() in _ZERO_DECIMAL_CURRENCIES:
        return int(amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return int(
        (amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


class RazorpayPaymentProvider:
    """Razorpay Orders + webhook.

    Only the order is created server-side; the browser opens Razorpay Checkout
    with that order id and never sees the key secret. The handler response the
    browser posts back is *not* trusted -- as with every provider here, a
    payment becomes `successful` only when the signed webhook says so.
    """

    name = "razorpay"
    api_base = "https://api.razorpay.com/v1"

    def _auth(self) -> tuple[str, str]:
        key, secret = settings.payment_provider_key, settings.payment_provider_secret
        if not key or not secret:
            raise ValidationFailedError("Payments are not configured.")
        return key, secret

    async def create_checkout(
        self, *, amount: Decimal, currency: str, reference: str, description: str
    ) -> CheckoutSession:
        import httpx

        key, secret = self._auth()
        currency = currency.upper()
        payload = {
            "amount": to_minor_units(amount, currency),
            "currency": currency,
            # Razorpay caps receipt at 40 characters.
            "receipt": reference[:40],
            # Echoed back on the webhook, which is how the payment is matched.
            "notes": {"reference": reference, "description": description[:250]},
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    f"{self.api_base}/orders", json=payload, auth=(key, secret)
                )
        except httpx.HTTPError as exc:
            logger.exception("Razorpay order request failed for %s", reference)
            raise ValidationFailedError(
                "We could not reach the payment provider. Please try again."
            ) from exc

        if response.status_code >= 400:
            # Never surface the provider's message; it can contain account detail.
            logger.error(
                "Razorpay rejected order for %s: %s %s",
                reference,
                response.status_code,
                response.text[:500],
            )
            raise ValidationFailedError("We could not start the payment. Please try again.")

        order = response.json()
        return CheckoutSession(
            provider=self.name,
            reference=str(order["id"]),
            status=PaymentStatus.PENDING,
            # The browser needs the order id and the public key, nothing else.
            client_secret=str(order["id"]),
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
        """Map a Razorpay event to a payment outcome.

        Only captured counts as paid: an authorized-but-uncaptured payment is
        money held, not money taken.
        """
        event_name = event.get("event")
        outcomes = {
            "payment.captured": PaymentStatus.SUCCESSFUL,
            "order.paid": PaymentStatus.SUCCESSFUL,
            "payment.failed": PaymentStatus.FAILED,
            "refund.processed": PaymentStatus.REFUNDED,
        }
        status = outcomes.get(str(event_name))
        if status is None:
            return None

        entities = event.get("payload") or {}
        payment_entity = (entities.get("payment") or {}).get("entity") or {}
        order_entity = (entities.get("order") or {}).get("entity") or {}

        # The order id is the reference stored against the payment row.
        order_id = payment_entity.get("order_id") or order_entity.get("id")
        if not order_id:
            return None

        return WebhookResult(
            reference=str(order_id),
            status=status,
            transaction_id=payment_entity.get("id"),
            raw=event,
        )


@lru_cache
def get_payment_provider() -> PaymentProvider:
    if settings.payment_provider == "razorpay":
        return RazorpayPaymentProvider()
    if settings.payment_provider == "stripe":
        return StripePaymentProvider()
    return NoopPaymentProvider()
