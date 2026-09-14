import type { ExamPricing } from '@/types/api'

/**
 * Whether a tax line should be rendered.
 *
 * The API sends a zero-rate, zero-amount breakdown when tax is switched off,
 * so callers check this rather than testing for the field's presence.
 */
export function hasTax(pricing: ExamPricing): boolean {
  return Number(pricing.tax_amount) > 0
}
