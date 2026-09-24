import type { KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Clock, GraduationCap } from 'lucide-react'

import { DiscountFlag, LastVerified, PriceRow } from '@/components/cards/PriceParts'
import { Badge, Card, Rating } from '@/components/ui/primitives'
import { formatDuration, formatLevel } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DealCard as DealCardType } from '@/types/api'

/**
 * One current offer, whether it is an exam or a course.
 *
 * The API has already worked out which figure is the original and which is the
 * sale price, so the card only has to lay them out; nothing here recalculates
 * a discount, which is what keeps it agreeing with the detail page it links to.
 */
export function DealCard({
  deal,
  className,
  onQualify,
}: {
  deal: DealCardType
  className?: string
  /** When set, the whole card opens the test-qualification flow instead of
   * linking to the deal's detail page; "View deal" still links through. */
  onQualify?: () => void
}) {
  const isExam = deal.kind === 'certification'

  return (
    <Card
      interactive
      className={cn('group relative flex h-full flex-col p-5', onQualify && 'cursor-pointer', className)}
      {...(onQualify && {
        role: 'button',
        tabIndex: 0,
        onClick: onQualify,
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onQualify()
          }
        },
      })}
    >
      <DiscountFlag percentage={deal.discount_percentage} align="right" />

      <div className="mb-4 flex items-start gap-2.5 pr-24">
        {deal.provider_logo ? (
          <img
            src={deal.provider_logo}
            alt=""
            loading="lazy"
            className="h-9 w-9 rounded-lg object-contain"
          />
        ) : (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {isExam ? (
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
            ) : (
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-500">
            {deal.provider_name ?? deal.category ?? (isExam ? 'Certification' : 'Course')}
          </p>
          <p className="text-xs text-ink-400">
            {isExam ? (deal.exam_code ? `Exam ${deal.exam_code}` : 'Exam') : 'Course'}
          </p>
        </div>
      </div>

      <h3 className="text-base font-bold leading-snug text-ink-900">
        {onQualify ? (
          <span className="transition group-hover:text-brand-700">{deal.title}</span>
        ) : (
          <Link
            to={deal.url}
            className="transition after:absolute after:inset-0 group-hover:text-brand-700"
          >
            {deal.title}
          </Link>
        )}
      </h3>

      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600">
        {deal.short_description}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge tone={isExam ? 'brand' : 'neutral'}>
          {isExam ? 'Certification' : 'Course'}
        </Badge>
        {deal.level && <Badge tone="outline">{formatLevel(deal.level)}</Badge>}
        {deal.duration_minutes ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDuration(deal.duration_minutes)}
          </span>
        ) : null}
      </div>

      <PriceRow
        price={deal.sale_price}
        compareAtPrice={deal.original_price}
        savings={deal.savings_amount}
        discountPercentage={deal.discount_percentage}
        currency={deal.currency}
        note={deal.tax_label ? `incl. ${deal.tax_label}` : null}
        className="mt-4"
      />

      <LastVerified date={deal.last_verified_on} className="mt-2" />

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        {/* Ratings are shown only where real reviews exist behind them. */}
        {deal.rating_count ? (
          <Rating value={deal.rating_average ?? '0'} count={deal.rating_count} />
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
          {onQualify ? 'Take the test' : isExam ? 'View deal' : 'View course'}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Card>
  )
}
