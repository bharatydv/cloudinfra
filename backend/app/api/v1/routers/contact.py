from fastapi import APIRouter, Depends, Request, status

from app.core.config import settings
from app.core.deps import DbSession, client_ip
from app.core.rate_limit import limiter
from app.schemas.common import Message
from app.schemas.system import AnalyticsEventCreate, ContactCreate
from app.services import analytics, contact_service

router = APIRouter(tags=["Contact"])


@router.post("/contact", response_model=Message, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def submit_contact(
    request: Request,
    payload: ContactCreate,
    db: DbSession,
    ip: str | None = Depends(client_ip),
) -> Message:
    """Store a contact enquiry and send the sender a confirmation."""
    await contact_service.submit(db, payload, ip)
    return Message(
        message="Thanks for reaching out. Our team will get back to you shortly."
    )


@router.post("/events", response_model=Message, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("120/minute")
async def track_event(
    request: Request, payload: AnalyticsEventCreate, db: DbSession
) -> Message:
    """Provider-agnostic analytics sink used by the frontend client."""
    user_id = None
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        from app.core.security import decode_token

        claims = decode_token(auth.split(" ", 1)[1], expected_type="access")
        user_id = claims.get("sub") if claims else None

    await analytics.track(
        db,
        analytics.TrackedEvent(
            name=payload.event_name,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            session_id=payload.session_id,
            user_id=user_id,
            path=payload.path,
            properties=payload.properties,
        ),
    )
    return Message(message="Recorded.")


@router.get("/config", include_in_schema=False)
async def public_config() -> dict[str, object]:
    """Non-secret runtime flags the frontend may need."""
    return {
        "analytics_provider": settings.analytics_provider,
        "payments_enabled": settings.payment_provider != "noop",
        "environment": settings.environment,
    }
