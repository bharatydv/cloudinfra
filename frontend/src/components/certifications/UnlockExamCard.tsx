/**
 * The two ways to reach the discounted exam fee.
 *
 * A visitor either holds a code or earns one by passing the free test. Both
 * routes end at the same figure -- the price the catalogue already advertises
 * -- which is why they are shown side by side rather than as competing
 * offers. A code is a key, not a second discount, so nothing here quotes a
 * percentage of its own.
 *
 * The coupon route asks for no contact details: the code is the
 * authorisation, and the payment provider's own form collects the name and
 * address it needs.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CreditCard, Ticket, Trophy } from 'lucide-react'

import { ApiError } from '@/api/client'
import { redeemExamCoupon, startCouponCheckout } from '@/api/endpoints'
import { Button } from '@/components/ui/Button'
import { Card, Input } from '@/components/ui/primitives'
import { useExamCheckout } from '@/hooks/useExamCheckout'
import { formatPrice } from '@/lib/format'
import type { ExamCouponQuote } from '@/types/api'

export function UnlockExamCard({
  certificationId,
  onStartTest,
}: {
  certificationId: string
  /** Opens the test's rules popup, which the page owns. */
  onStartTest: () => void
}) {
  const [code, setCode] = useState('')
  const [quote, setQuote] = useState<ExamCouponQuote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checkout = useExamCheckout()

  const apply = useMutation({
    mutationFn: () => redeemExamCoupon(code.trim(), certificationId),
    onSuccess: (result) => {
      setError(null)
      setQuote(result)
    },
    onError: (err) => {
      setQuote(null)
      setError(
        err instanceof ApiError ? err.message : 'We could not check that code.',
      )
    },
  })

  const pay = useMutation({
    mutationFn: () => startCouponCheckout(code.trim(), certificationId),
    onSuccess: (session) => {
      setError(null)
      return checkout.open(session)
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'We could not open the payment window. Please try again.',
      ),
  })

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
        Two ways to unlock this price
      </h2>

      {/* --- 1. A code ----------------------------------------------------- */}
      <div className="mt-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Ticket className="h-4 w-4 text-brand-600" aria-hidden="true" />
          Have a coupon code?
        </p>
        <form
          className="mt-2.5 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (code.trim()) apply.mutate()
          }}
        >
          <label className="sr-only" htmlFor="exam-coupon-code">
            Coupon code
          </label>
          <Input
            id="exam-coupon-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              // A changed code invalidates whatever the last one quoted.
              setQuote(null)
              setError(null)
            }}
            placeholder="Enter your code"
            autoComplete="off"
            spellCheck={false}
            // Codes are matched case-insensitively; this only saves the
            // visitor from wondering whether it mattered.
            className="uppercase placeholder:normal-case"
            invalid={Boolean(error)}
            maxLength={40}
          />
          <Button
            type="submit"
            variant="outline"
            loading={apply.isPending}
            disabled={!code.trim()}
          >
            Apply
          </Button>
        </form>

        {error && <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>}

        {quote && (
          <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/60 p-3.5">
            <p className="text-sm text-ink-800">
              Code <span className="font-bold">{quote.code}</span> applied &mdash;{' '}
              <span className="font-extrabold text-emerald-700">
                {formatPrice(quote.amount_payable, quote.pricing.currency)}
              </span>{' '}
              for {quote.certification_name}
            </p>
            {quote.can_pay ? (
              <Button
                className="mt-3"
                fullWidth
                loading={pay.isPending || checkout.state === 'opening'}
                onClick={() => pay.mutate()}
                leadingIcon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
              >
                Pay {formatPrice(quote.amount_payable, quote.pricing.currency)}
              </Button>
            ) : (
              <p className="mt-2 text-xs text-ink-700">
                Our team will take payment with you directly.
              </p>
            )}
            {checkout.state === 'submitted' && (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Thanks &mdash; your payment is being confirmed. We will email you once it
                clears.
              </p>
            )}
            {checkout.state === 'abandoned' && (
              <p className="mt-2 text-xs text-ink-600">
                Payment was not completed. Your code still works &mdash; pay whenever you
                are ready.
              </p>
            )}
            {checkout.state === 'unavailable' && (
              <p className="mt-2 text-xs font-medium text-amber-800">
                We could not open the payment window. Our team can take payment with you
                instead.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-200" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          or
        </span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      {/* --- 2. The test --------------------------------------------------- */}
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Trophy className="h-4 w-4 text-brand-600" aria-hidden="true" />
          Take the free test
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
          Pass it and the same price unlocks, no code needed.
        </p>
        <Button variant="outline" fullWidth className="mt-3" onClick={onStartTest}>
          Start the test
        </Button>
      </div>
    </Card>
  )
}
