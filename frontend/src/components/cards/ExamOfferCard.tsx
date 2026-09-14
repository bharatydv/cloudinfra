import type { ReactNode } from 'react'
import { Check, ShieldCheck } from 'lucide-react'

import { ScheduleExamLink } from '@/components/scheduling/ScheduleExamCta'
import { Card } from '@/components/ui/primitives'
import { useSite } from '@/hooks/useSite'
import { formatPrice } from '@/lib/format'
import { hasTax } from '@/lib/pricing'
import type { ExamPricing } from '@/types/api'

/**
 * The commercial block on a certification page: price, what it saves, what it
 * includes, and the action.
 *
 * Ordered the way the decision is actually made -- what it costs, what that
 * saves against the vendor's own price, what you get, then the button. The
 * itemised breakdown is kept visible rather than hidden behind a toggle,
 * because a discount you can check is more persuasive than one you cannot.
 */
export function ExamOfferCard({
  pricing,
  certificationId,
}: {
  pricing: ExamPricing
  certificationId: string
}) {
  const { promotion } = useSite()
  const { currency } = pricing
  const discounted = Number(pricing.discount_amount) > 0

  return (
    <Card className="overflow-hidden p-0">
      {/* The saving leads, in money rather than only a percentage -- "$25 off"
          lands harder than "20% off" and both are shown. */}
      {discounted && (
        <p className="bg-emerald-600 px-5 py-2 text-center text-sm font-bold text-white">
          Save {formatPrice(pricing.discount_amount, currency)}
          {pricing.savings_percentage !== null && ` · ${pricing.savings_percentage}% off`}
        </p>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="text-4xl font-extrabold tracking-tight text-ink-900">
            {formatPrice(pricing.total_price_amount, currency)}
          </span>
          {discounted && (
            <s className="pb-1 text-lg text-ink-400">
              {formatPrice(pricing.exam_fee_amount, currency)}
            </s>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-500">
          {hasTax(pricing)
            ? `Total payable, ${pricing.tax_label} included.`
            : 'Total payable.'}{' '}
          {discounted && 'Provider’s own price shown struck through.'}
        </p>

        <dl className="mt-5 space-y-2 border-t border-ink-200 pt-4 text-sm">
          <Row label={<>Provider&rsquo;s exam fee</>}>
            {formatPrice(pricing.exam_fee_amount, currency)}
          </Row>
          {discounted && (
            <Row
              label={`Discount (${Number(pricing.discount_percentage)}%)`}
              tone="positive"
            >
              &minus;{formatPrice(pricing.discount_amount, currency)}
            </Row>
          )}
          {hasTax(pricing) && (
            <>
              <Row label="Subtotal">
                {formatPrice(pricing.net_price_amount, currency)}
              </Row>
              <Row label={`${pricing.tax_label} (${Number(pricing.tax_rate)}%)`}>
                {formatPrice(pricing.tax_amount, currency)}
              </Row>
            </>
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-ink-200 pt-2.5">
            <dt className="font-bold text-ink-900">You pay</dt>
            <dd className="text-lg font-extrabold tracking-tight text-brand-700">
              {formatPrice(pricing.total_price_amount, currency)}
            </dd>
          </div>
        </dl>

        {/* Price in the button: the visitor never has to scroll back to check
            what they are committing to. */}
        <ScheduleExamLink
          certificationId={certificationId}
          className="mt-5 w-full"
          cta="cert_offer_card"
          showBadge={false}
        >
          Schedule Exam &middot; {formatPrice(pricing.total_price_amount, currency)}
        </ScheduleExamLink>

        {promotion.reassurance && (
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-600">
            <ShieldCheck
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            {promotion.reassurance}
          </p>
        )}

        {promotion.benefits.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-ink-200 pt-4">
            {promotion.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm text-ink-700">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                {benefit}
              </li>
            ))}
          </ul>
        )}

        {promotion.enabled && promotion.endsOn && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            Offer ends {promotion.endsOn}.
          </p>
        )}

        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          {pricing.fee_checked_on
            ? `Provider fee last checked on ${pricing.fee_checked_on}.`
            : 'Provider fee is indicative.'}{' '}
          Exam fees vary by region and change without notice &mdash; confirm the current fee
          on the provider&rsquo;s official page.
        </p>
      </div>
    </Card>
  )
}

function Row({
  label,
  tone,
  children,
}: {
  label: ReactNode
  tone?: 'positive'
  children: ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-600">{label}</dt>
      <dd className={tone === 'positive' ? 'font-semibold text-emerald-700' : 'text-ink-800'}>
        {children}
      </dd>
    </div>
  )
}
