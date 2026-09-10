/**
 * Provider-agnostic analytics client.
 *
 * Components call `track(...)` with a semantic event; where that event ends up
 * is a deployment decision, not a code change. Events are posted to our own
 * API, which persists them and can forward to GA4 / Plausible / PostHog.
 */

import { trackEvent } from '@/api/endpoints'

export const AnalyticsEvent = {
  PageView: 'page_view',
  CourseViewed: 'course_viewed',
  CertificationViewed: 'certification_viewed',
  ArticleViewed: 'article_viewed',
  SearchPerformed: 'search_performed',
  CourseEnrolled: 'course_enrolled',
  CtaClicked: 'cta_clicked',
} as const

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent]

const SESSION_KEY = 'lb.session_id'

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

export interface TrackOptions {
  entityType?: string
  entityId?: string
  properties?: Record<string, unknown>
}

/** Fire-and-forget: analytics must never break a user interaction. */
export function track(name: AnalyticsEventName, options: TrackOptions = {}): void {
  void trackEvent({
    event_name: name,
    entity_type: options.entityType,
    entity_id: options.entityId,
    session_id: sessionId(),
    path: window.location.pathname + window.location.search,
    properties: options.properties ?? {},
  }).catch(() => {
    /* Swallowed by design. */
  })
}
