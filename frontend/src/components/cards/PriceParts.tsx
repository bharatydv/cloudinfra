/**
 * The pieces every discounted card is assembled from.
 *
 * Exams and courses are priced by different rules, but a visitor comparing
 * them should read the same four things in the same order: what it costs now,
 * what it used to cost, how much that saves, and when anyone last checked.
 * Keeping the pieces here is what stops each surface drifting into its own
 * dialect of "20% off".
 *
 * Every component returns null when the figure behind it is missing, so a card
 * that has no verified discount simply shows its price and says nothing more.
 */

import { BadgePercent, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import { lastVerified } from '@/lib/pricing'

/** The headline figure, the struck-out original, and the size of the saving. */
export function PriceRow({
  price,
  compareAtPrice,
  savings,
  discountPercentage,
  currency,
  note,
  size = 'md',
  className,
}: {
  price: string | number
  compareAtPrice?: string | number | null
  savings?: string | number | null
  discountPercentage?: number | null
  currency: string
  /** Small trailing qualifier, e.g. "incl. GST". */
  note?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const discounted = Number(compareAtPrice ?? 0) > Number(price)

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5', className)}>
      <span
        className={cn(
          'font-extrabold tracking-tight text-ink-900',
          size === 'sm' && 'text-lg',
          size === 'md' && 'text-2xl',
          size === 'lg' && 'text-3xl',
        )}
      >
        {formatPrice(price, currency)}
      </span>

      {/* Only strike a price out when it is genuinely higher than ours. */}
      {discounted && (
        <s className={cn('text-ink-500', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {formatPrice(compareAtPrice!, currency)}
        </s>
      )}

      {note && (
        <span className={cn('text-ink-500', size === 'sm' ? 'text-[0.6875rem]' : 'text-xs')}>
          {note}
        </span>
      )}

      {discounted && <DiscountBadge percentage={discountPercentage} />}

      {discounted && Number(savings ?? 0) > 0 && (
        <span
          className={cn(
            'font-semibold text-emerald-700',
            size === 'sm' ? 'text-xs' : 'text-sm',
          )}
        >
          Save {formatPrice(savings!, currency)}
        </span>
      )}
    </div>
  )
}

/** The "XX% OFF" flag. Renders nothing without a percentage from the API. */
export function DiscountBadge({
  percentage,
  className,
}: {
  percentage: number | null | undefined
  className?: string
}) {
  if (!percentage || percentage <= 0) return null
  return (
    <Badge tone="success" className={className}>
      <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
      {percentage}% OFF
    </Badge>
  )
}

/**
 * A corner flag, for cards where an inline badge would be lost among imagery
 * or below the fold. Sits over the card's top-left or top-right corner.
 */
export function DiscountFlag({
  percentage,
  align = 'left',
}: {
  percentage: number | null | undefined
  align?: 'left' | 'right'
}) {
  if (!percentage || percentage <= 0) return null
  return (
    <span
      className={cn(
        'absolute top-3 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-subtle',
        align === 'right' ? 'right-3' : 'left-3',
      )}
    >
      <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
      {percentage}% OFF
    </span>
  )
}

/**
 * When a human last confirmed the price.
 *
 * Vendor pricing moves and varies by region, so the date is shown wherever a
 * price is, and omitted entirely when no check has been recorded.
 */
export function LastVerified({
  date,
  className,
}: {
  date: string | null | undefined
  className?: string
}) {
  const label = lastVerified(date)
  if (!label) return null
  return (
    <p className={cn('flex items-center gap-1.5 text-xs text-ink-500', className)}>
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
      {label}
    </p>
  )
}

/** Stands in for a figure nobody has recorded, instead of guessing one. */
export function PriceUnavailable({ className }: { className?: string }) {
  return (
    <p className={cn('text-sm text-ink-500', className)}>Price information unavailable</p>
  )
}
