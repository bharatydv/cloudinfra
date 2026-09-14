import { useEffect, useRef, useState } from 'react'

import { ScheduleExamLink } from '@/components/scheduling/ScheduleExamCta'
import { Container } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import { hasTax } from '@/lib/pricing'
import type { ExamPricing } from '@/types/api'

/**
 * Price and action pinned to the bottom once the main offer scrolls away.
 *
 * Certification pages are long -- objectives, roadmap, resources -- and the
 * decision is usually made partway down, by which point the price and the
 * button are both off screen. This keeps them one tap away without another
 * scroll back up.
 *
 * It is driven by an IntersectionObserver on the real offer card rather than a
 * scroll offset, so it never duplicates a CTA that is already visible.
 */
export function StickyExamCta({
  pricing,
  certificationId,
  certificationName,
  watchRef,
}: {
  pricing: ExamPricing | null
  certificationId: string
  certificationName: string
  /** The in-page offer block. The bar shows only while this is out of view. */
  watchRef: React.RefObject<HTMLElement | null>
}) {
  const [visible, setVisible] = useState(false)
  // Avoids a flash of the bar before the observer has reported anything.
  const settled = useRef(false)

  useEffect(() => {
    const target = watchRef.current
    if (!target || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        settled.current = true
        setVisible(!entry!.isIntersecting)
      },
      { rootMargin: '-80px 0px 0px 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [watchRef])

  if (!pricing) return null

  return (
    <div
      // `visibility: hidden` rather than aria-hidden alone: it also takes the
      // duplicate button out of the tab order while the bar is off screen,
      // and unlike `display: none` it still animates.
      aria-hidden={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 shadow-lifted backdrop-blur',
        'transition-[transform,visibility] duration-200',
        visible && settled.current
          ? 'visible translate-y-0'
          : 'invisible translate-y-full',
      )}
    >
      <Container className="flex items-center justify-between gap-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">
            {certificationName}
          </p>
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-extrabold text-ink-900">
              {formatPrice(pricing.total_price_amount, pricing.currency)}
            </span>
            {Number(pricing.discount_amount) > 0 && (
              <>
                <s className="text-xs text-ink-400">
                  {formatPrice(pricing.exam_fee_amount, pricing.currency)}
                </s>
                <span className="text-xs font-semibold text-emerald-700">
                  Save {formatPrice(pricing.discount_amount, pricing.currency)}
                </span>
              </>
            )}
            {hasTax(pricing) && (
              <span className="text-xs text-ink-500">incl. {pricing.tax_label}</span>
            )}
          </p>
        </div>

        <ScheduleExamLink
          certificationId={certificationId}
          size="md"
          className="shrink-0"
          cta="cert_sticky_bar"
          showBadge={false}
        >
          Schedule Exam
        </ScheduleExamLink>
      </Container>
    </div>
  )
}
