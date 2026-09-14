import { Badge } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import { hasTax } from '@/lib/pricing'
import type { ExamPricing } from '@/types/api'

/**
 * Headline price with the vendor's fee struck through beside it.
 *
 * Shows the tax-inclusive total, because that is the number a visitor actually
 * pays; the itemised breakdown lives in ExamPricePanel.
 */
export function ExamPriceComparison({
  pricing,
  size = 'md',
  className,
}: {
  pricing: ExamPricing | null
  size?: 'sm' | 'md'
  className?: string
}) {
  if (!pricing) return null

  const { currency } = pricing
  const small = size === 'sm'
  const discounted = Number(pricing.discount_amount) > 0

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2.5 gap-y-1', className)}>
      <span
        className={cn(
          'font-extrabold tracking-tight text-ink-900',
          small ? 'text-lg' : 'text-2xl',
        )}
      >
        {formatPrice(pricing.total_price_amount, currency)}
      </span>

      {/* Only strike a price out when it is genuinely higher than ours. */}
      {discounted && (
        <s className={cn('text-ink-500', small ? 'text-xs' : 'text-sm')}>
          {formatPrice(pricing.exam_fee_amount, currency)}
        </s>
      )}

      {hasTax(pricing) && (
        <span className={cn('text-ink-500', small ? 'text-[0.6875rem]' : 'text-xs')}>
          incl. {pricing.tax_label}
        </span>
      )}

      {pricing.savings_percentage !== null && (
        <Badge tone="success">Save {pricing.savings_percentage}%</Badge>
      )}
    </div>
  )
}

/**
 * The itemised breakdown: vendor fee, discount, tax and what you pay.
 *
 * Every line comes from the API already rounded, so the arithmetic a visitor
 * does in their head matches the total exactly.
 */
export function ExamPricePanel({ pricing }: { pricing: ExamPricing | null }) {
  if (!pricing) return null

  const { currency } = pricing
  const discounted = Number(pricing.discount_amount) > 0

  return (
    <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <dl className="space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-600">Provider&rsquo;s exam fee</dt>
          <dd className={discounted ? 'text-ink-500' : 'text-ink-800'}>
            {discounted ? (
              <s>{formatPrice(pricing.exam_fee_amount, currency)}</s>
            ) : (
              formatPrice(pricing.exam_fee_amount, currency)
            )}
          </dd>
        </div>

        {discounted && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-600">
              Discount ({Number(pricing.discount_percentage)}%)
            </dt>
            <dd className="font-semibold text-emerald-700">
              &minus;{formatPrice(pricing.discount_amount, currency)}
            </dd>
          </div>
        )}

        {hasTax(pricing) && (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-600">Subtotal</dt>
              <dd className="text-ink-800">
                {formatPrice(pricing.net_price_amount, currency)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-600">
                {pricing.tax_label} ({Number(pricing.tax_rate)}%)
              </dt>
              <dd className="text-ink-800">{formatPrice(pricing.tax_amount, currency)}</dd>
            </div>
          </>
        )}

        <div className="flex items-baseline justify-between gap-4 border-t border-brand-200 pt-2">
          <dt className="font-semibold text-ink-900">
            Total payable
            {hasTax(pricing) && (
              <span className="ml-1 font-normal text-ink-500">
                (incl. {pricing.tax_label})
              </span>
            )}
          </dt>
          <dd className="text-xl font-extrabold tracking-tight text-brand-700">
            {formatPrice(pricing.total_price_amount, currency)}
          </dd>
        </div>
      </dl>

      {pricing.savings_percentage !== null && (
        <p className="mt-3 border-t border-brand-200 pt-3 text-sm font-semibold text-brand-700">
          You save {pricing.savings_percentage}% &mdash;{' '}
          {formatPrice(pricing.discount_amount, currency)} off the provider&rsquo;s price.
        </p>
      )}

      {/* Vendor pricing moves and varies by region, so never present it as
          today's authoritative figure. */}
      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        {pricing.fee_checked_on
          ? `Provider fee last checked on ${pricing.fee_checked_on}.`
          : 'Provider fee is indicative.'}{' '}
        Exam fees vary by region and change without notice &mdash; confirm the current fee on
        the provider&rsquo;s official page before booking.
      </p>
    </div>
  )
}
