import { Badge } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import { hasPricing, type ExamPricing } from '@/lib/pricing'

/**
 * Vendor exam fee against ours.
 *
 * Renders nothing unless both numbers exist.
 *
 * `savings_percentage` is computed by the API from these same two numbers, so
 * the badge cannot drift out of step with the figures next to it.
 */
export function ExamPriceComparison({
  pricing,
  size = 'md',
  className,
}: {
  pricing: ExamPricing
  size?: 'sm' | 'md'
  className?: string
}) {
  if (!hasPricing(pricing)) return null

  const currency = pricing.exam_fee_currency || 'USD'
  const small = size === 'sm'

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2.5 gap-y-1', className)}>
      <span
        className={cn(
          'font-extrabold tracking-tight text-ink-900',
          small ? 'text-lg' : 'text-2xl',
        )}
      >
        {formatPrice(pricing.offer_price_amount!, currency)}
      </span>

      <s className={cn('text-ink-500', small ? 'text-xs' : 'text-sm')}>
        {formatPrice(pricing.exam_fee_amount!, currency)}
      </s>

      {pricing.savings_percentage !== null && (
        <Badge tone="success">Save {pricing.savings_percentage}%</Badge>
      )}
    </div>
  )
}

/**
 * The same comparison as a labelled block, for the certification page's exam
 * information card where each figure needs saying in words.
 */
export function ExamPricePanel({ pricing }: { pricing: ExamPricing }) {
  if (!hasPricing(pricing)) return null

  const currency = pricing.exam_fee_currency || 'USD'

  return (
    <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <dl className="space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-600">Provider&rsquo;s exam fee</dt>
          <dd>
            <s className="text-ink-500">
              {formatPrice(pricing.exam_fee_amount!, currency)}
            </s>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-semibold text-ink-900">Your price with us</dt>
          <dd className="text-xl font-extrabold tracking-tight text-brand-700">
            {formatPrice(pricing.offer_price_amount!, currency)}
          </dd>
        </div>
      </dl>

      {pricing.savings_percentage !== null && (
        <p className="mt-3 border-t border-brand-200 pt-3 text-sm font-semibold text-brand-700">
          You save {pricing.savings_percentage}% &mdash;{' '}
          {formatPrice(
            String(Number(pricing.exam_fee_amount) - Number(pricing.offer_price_amount)),
            currency,
          )}{' '}
          off the provider&rsquo;s price.
        </p>
      )}

      {/* Vendor pricing moves and varies by region, so never present it as
          today's authoritative figure. */}
      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        {pricing.exam_fee_checked_on
          ? `Provider fee last checked on ${pricing.exam_fee_checked_on}.`
          : 'Provider fee is indicative.'}{' '}
        Exam fees vary by region and change without notice &mdash; confirm the current fee on
        the provider&rsquo;s official page before booking.
      </p>
    </div>
  )
}
