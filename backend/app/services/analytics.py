"""Analytics abstraction.

The frontend posts semantic events to one endpoint; the provider is a
deployment detail. Events are always persisted first-party so no data is lost
when the provider changes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.system import AnalyticsEvent

logger = logging.getLogger(__name__)

# Canonical event names shared with the frontend analytics client.
EVENT_PAGE_VIEW = "page_view"
EVENT_COURSE_VIEWED = "course_viewed"
EVENT_CERTIFICATION_VIEWED = "certification_viewed"
EVENT_ARTICLE_VIEWED = "article_viewed"
EVENT_SEARCH_PERFORMED = "search_performed"
EVENT_COURSE_ENROLLED = "course_enrolled"
EVENT_CTA_CLICKED = "cta_clicked"

KNOWN_EVENTS = frozenset(
    {
        EVENT_PAGE_VIEW,
        EVENT_COURSE_VIEWED,
        EVENT_CERTIFICATION_VIEWED,
        EVENT_ARTICLE_VIEWED,
        EVENT_SEARCH_PERFORMED,
        EVENT_COURSE_ENROLLED,
        EVENT_CTA_CLICKED,
    }
)


@dataclass(slots=True)
class TrackedEvent:
    name: str
    entity_type: str | None = None
    entity_id: str | None = None
    session_id: str | None = None
    user_id: str | None = None
    path: str | None = None
    properties: dict[str, Any] = field(default_factory=dict)


class AnalyticsSink(Protocol):
    async def emit(self, event: TrackedEvent) -> None: ...


class NoopAnalyticsSink:
    async def emit(self, event: TrackedEvent) -> None:
        logger.debug("[analytics] %s %s", event.name, event.properties)


@lru_cache
def get_analytics_sink() -> AnalyticsSink:
    # GA4 / Plausible / PostHog adapters slot in here without touching routes.
    if settings.analytics_provider != "noop" and not settings.analytics_site_id:
        logger.warning(
            "Analytics provider %r selected without ANALYTICS_SITE_ID",
            settings.analytics_provider,
        )
    return NoopAnalyticsSink()


async def track(db: AsyncSession, event: TrackedEvent) -> None:
    db.add(
        AnalyticsEvent(
            event_name=event.name,
            entity_type=event.entity_type,
            entity_id=event.entity_id,
            session_id=event.session_id,
            user_id=event.user_id,
            path=event.path,
            properties=event.properties,
        )
    )
    await db.commit()
    await get_analytics_sink().emit(event)
