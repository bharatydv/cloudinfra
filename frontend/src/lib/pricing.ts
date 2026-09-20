import { formatDate } from '@/lib/format'
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

/**
 * The date a price was last confirmed, formatted for display.
 *
 * Returns null when nothing is recorded, so a card renders no line at all
 * rather than an empty or invented "last verified" claim.
 */
export function lastVerified(value: string | null | undefined): string | null {
  if (!value) return null
  const formatted = formatDate(value)
  return formatted ? `Last verified: ${formatted}` : null
}

/**
 * Percentage saved, rounded the same way the API rounds it.
 *
 * Only used for figures the API has not already derived; anything that
 * arrives with a `discount_percentage` uses that instead, so the badge can
 * never disagree with the amounts beside it.
 */
export function discountPercentage(
  originalPrice: string | number,
  salePrice: string | number,
): number | null {
  const original = Number(originalPrice)
  const sale = Number(salePrice)
  if (!Number.isFinite(original) || !Number.isFinite(sale)) return null
  if (original <= 0 || sale >= original) return null
  return Math.round(((original - sale) / original) * 100)
}
