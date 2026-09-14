import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Tag, X } from 'lucide-react'

import { Container } from '@/components/ui/primitives'
import { useSite } from '@/hooks/useSite'
import { AnalyticsEvent, track } from '@/lib/analytics'

/**
 * Dismissals are keyed by the offer text, so changing the copy in the admin
 * shows the banner again to people who dismissed the previous offer.
 */
const DISMISS_KEY = 'lb.promo_dismissed'

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY)
  } catch {
    // Private browsing: the banner simply reappears next visit.
    return null
  }
}

/**
 * Site-wide offer strip above the navigation.
 *
 * Renders nothing unless an operator has switched the promotion on in
 * Admin > Settings, so the markup costs nothing when there is no offer.
 */
export function PromoBanner() {
  const { promotion } = useSite()
  const [dismissed, setDismissed] = useState<string | null>(null)

  // Read after mount so the server-rendered and client markup agree.
  useEffect(() => setDismissed(readDismissed()), [])

  if (!promotion.enabled || dismissed === promotion.message) return null

  function dismiss() {
    setDismissed(promotion.message)
    try {
      localStorage.setItem(DISMISS_KEY, promotion.message)
    } catch {
      /* Nothing to persist to; the banner returns next visit. */
    }
  }

  return (
    <aside
      aria-label="Current offer"
      className="relative border-b border-brand-500/40 bg-brand-700 text-white"
    >
      <Container className="flex items-center gap-3 py-2.5 pr-10">
        <Tag className="hidden h-4 w-4 shrink-0 text-brand-200 sm:block" aria-hidden="true" />

        <p className="min-w-0 flex-1 text-sm font-medium">
          {promotion.message}
          {promotion.endsOn && (
            <span className="ml-2 text-brand-200">Ends {promotion.endsOn}.</span>
          )}
        </p>

        {promotion.linkLabel && (
          <Link
            to={promotion.linkTo}
            onClick={() => track(AnalyticsEvent.CtaClicked, { properties: { cta: 'promo_banner' } })}
            className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold transition hover:bg-white/25 sm:inline-flex"
          >
            {promotion.linkLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </Container>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss offer"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-brand-200 transition hover:bg-white/15 hover:text-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  )
}
