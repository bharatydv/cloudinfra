import type { CertificationCard } from '@/types/api'

/** The pricing fields, so a card, a detail page and the form share one shape. */
export type ExamPricing = Pick<
  CertificationCard,
  | 'exam_fee_amount'
  | 'exam_fee_currency'
  | 'exam_fee_checked_on'
  | 'offer_price_amount'
  | 'savings_percentage'
>

/**
 * True only when both sides of the comparison are present.
 *
 * A struck-through price with nothing beside it, or our price with nothing to
 * compare against, is worse than showing no pricing at all.
 */
export function hasPricing(pricing: ExamPricing): boolean {
  return Boolean(pricing.exam_fee_amount && pricing.offer_price_amount)
}
