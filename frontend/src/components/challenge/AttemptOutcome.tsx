/**
 * What a sat test earned, and what to do about it.
 *
 * One component for every surface that shows the outcome of a discount test --
 * the result screen, a certification page, a deal card, the dashboard -- so a
 * learner is told the same thing in the same words wherever they look.
 *
 * Nothing here decides anything. Whether a discount was earned, what it is
 * worth, whether a retake is allowed yet and whether the fee can be paid are
 * all server-side facts carried on the attempt (`can_pay`,
 * `retake_available_on`, `payment_status`); this only lays them out.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  RotateCcw,
  XCircle,
} from 'lucide-react'

import { startChallengeCheckout } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/primitives'
import { useExamCheckout } from '@/hooks/useExamCheckout'
import { canRetakeNow } from '@/hooks/useMyChallengeAttempts'
import { cn } from '@/lib/cn'
import { formatDate, formatPrice } from '@/lib/format'
import { hasTax } from '@/lib/pricing'
import { queryKeys } from '@/lib/queryClient'
import type { ChallengeAttemptSummary } from '@/types/api'

/* -------------------------------------------------------------------------- */
/* Paying the discounted fee                                                  */
/* -------------------------------------------------------------------------- */
/**
 * Opens checkout for the exam fee at the discount a passed paper earned.
 *
 * `token` is the session token from the sitting, which is how a signed-out
 * candidate proves the paper is theirs; a signed-in owner passes none and is
 * authorised by their account instead.
 */
export function PayExamButton({
  attemptId,
  token,
  amount,
  currency,
  discountPercentage,
  size = 'md',
  fullWidth,
  className,
}: {
  attemptId: string
  token?: string | null
  amount: string
  currency: string
  discountPercentage?: string | null
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  className?: string
}) {
  const queryClient = useQueryClient()
  const checkout = useExamCheckout()
  const [error, setError] = useState<string | null>(null)

  const start = useMutation({
    mutationFn: () => startChallengeCheckout(attemptId, token),
    onSuccess: async (session) => {
      setError(null)
      await checkout.open(session)
      // The webhook is what confirms it, so the row is re-read rather than
      // assumed: this picks up a payment that has already cleared.
      void queryClient.invalidateQueries({ queryKey: queryKeys.myChallengeAttempts })
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'We could not open the payment window. Please try again.',
      ),
  })

  const discount = discountPercentage ? ` · ${Number(discountPercentage)}% off` : ''

  return (
    <div className={cn('w-full', className)}>
      <Button
        size={size}
        fullWidth={fullWidth}
        loading={start.isPending || checkout.state === 'opening'}
        onClick={() => start.mutate()}
        leadingIcon={<CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" />}
      >
        Pay {formatPrice(amount, currency)}
        {discount}
      </Button>

      {checkout.state === 'submitted' && (
        <p className="mt-2 text-xs font-medium text-emerald-700">
          Thanks — your payment is being confirmed. We will email you once it clears.
        </p>
      )}
      {checkout.state === 'abandoned' && (
        <p className="mt-2 text-xs text-ink-500">
          Payment was not completed. Your discount is still held against{' '}
          this test — you can pay whenever you are ready.
        </p>
      )}
      {(checkout.state === 'unavailable' || error) && (
        <p className="mt-2 text-xs font-medium text-amber-800">
          {error ?? 'We could not open the payment window. Our team can take payment with you instead.'}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Sitting it again                                                           */
/* -------------------------------------------------------------------------- */
/**
 * Retake the test, or say when that becomes possible.
 *
 * The cooldown is enforced at the start endpoint, so the button is disabled
 * rather than allowed to fail: `retake_available_on` is the server's own answer
 * to when the next paper may be opened.
 */
export function RetakeTestButton({
  retakeAvailableOn,
  onRetake,
  to,
  size = 'md',
  fullWidth,
  variant = 'outline',
}: {
  retakeAvailableOn: string | null
  /** Opens the start form in place, for a page that has a popup for it. */
  onRetake?: () => void
  /** Where to send the candidate instead, when there is no popup here. */
  to?: string
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  variant?: 'primary' | 'outline'
}) {
  if (!canRetakeNow(retakeAvailableOn)) {
    return (
      <div className={cn(fullWidth && 'w-full')}>
        <Button
          size={size}
          variant="outline"
          fullWidth={fullWidth}
          disabled
          leadingIcon={<CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />}
        >
          Retake from {formatDate(retakeAvailableOn)}
        </Button>
        <p className="mt-2 text-xs text-ink-500">
          One sitting per cooldown window.
        </p>
      </div>
    )
  }

  const label = 'Retake the test'
  const icon = <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />

  if (onRetake) {
    return (
      <Button
        size={size}
        variant={variant}
        fullWidth={fullWidth}
        onClick={onRetake}
        leadingIcon={icon}
      >
        {label}
      </Button>
    )
  }
  return (
    <ButtonLink
      to={to ?? '/challenge'}
      size={size}
      variant={variant}
      fullWidth={fullWidth}
      leadingIcon={icon}
    >
      {label}
    </ButtonLink>
  )
}

/* -------------------------------------------------------------------------- */
/* The outcome itself                                                         */
/* -------------------------------------------------------------------------- */
function Score({ attempt }: { attempt: ChallengeAttemptSummary }) {
  const passed = attempt.passed === true
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-semibold',
        passed ? 'text-emerald-700' : 'text-ink-700',
      )}
    >
      {passed ? (
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 text-ink-400" aria-hidden="true" />
      )}
      {Number(attempt.score_percentage ?? 0)}%
      <span className="font-normal text-ink-500">
        ({attempt.correct_count}/{attempt.question_count})
      </span>
    </span>
  )
}

/**
 * One sitting, with the action it leads to.
 *
 * `compact` is the form that sits under a deal card; the default is the fuller
 * panel used on a certification page and in the dashboard.
 */
export function AttemptOutcome({
  attempt,
  onRetake,
  retakeTo,
  compact = false,
  showCertification = false,
  className,
}: {
  attempt: ChallengeAttemptSummary
  onRetake?: () => void
  retakeTo?: string
  compact?: boolean
  showCertification?: boolean
  className?: string
}) {
  const passed = attempt.passed === true
  const paid = attempt.payment_status === 'successful'
  const pending = attempt.payment_status === 'pending'

  return (
    <Card
      className={cn(
        'p-4',
        passed ? 'border-emerald-200 bg-emerald-50' : 'border-ink-200',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {showCertification && (
            <p className="truncate text-sm font-bold text-ink-900">
              {attempt.certification_url ? (
                <Link to={attempt.certification_url} className="hover:text-brand-700">
                  {attempt.certification_name}
                </Link>
              ) : (
                attempt.certification_name
              )}
            </p>
          )}
          <p className={cn('text-xs font-semibold uppercase tracking-wide text-ink-500', showCertification && 'mt-1')}>
            Your test result
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Score attempt={attempt} />
            <span className="text-xs text-ink-500">
              pass mark {Number(attempt.pass_mark ?? 0)}%
              {attempt.submitted_at ? ` · sat ${formatDate(attempt.submitted_at)}` : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {passed && attempt.discount_percentage && (
            <Badge tone="success">
              <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
              {Number(attempt.discount_percentage)}% off earned
            </Badge>
          )}
          {paid && <Badge tone="brand">Paid</Badge>}
          {pending && !paid && <Badge tone="outline">Payment started</Badge>}
        </div>
      </div>

      {/* --- What it is worth, and what happens next ---------------------- */}
      {passed ? (
        <div className="mt-3">
          {/* One figure, and it is the one the catalogue advertises: the
              discount is unlocked here, not applied a second time. */}
          {attempt.pricing && attempt.rewarded_price && !paid && (
            <p className="text-sm text-ink-700">
              Your exam fee:{' '}
              <span className="text-lg font-extrabold text-emerald-700">
                {formatPrice(attempt.rewarded_price, attempt.pricing.currency)}
              </span>{' '}
              {hasTax(attempt.pricing) ? `incl. ${attempt.pricing.tax_label}` : ''}
            </p>
          )}

          {paid ? (
            <p className="mt-1 text-sm text-ink-700">
              Your exam fee is paid. We are booking your slot with the provider and will
              email you the confirmed date and time.
            </p>
          ) : attempt.can_pay && attempt.rewarded_price && attempt.pricing ? (
            <PayExamButton
              attemptId={attempt.id}
              amount={attempt.rewarded_price}
              currency={attempt.pricing.currency}
              discountPercentage={attempt.discount_percentage}
              size={compact ? 'sm' : 'md'}
              fullWidth={compact}
              className="mt-3"
            />
          ) : (
            <p className="mt-1 text-sm text-ink-700">
              Our team will call you to confirm the discount and book your exam.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink-700">
            You did not reach the pass mark on this sitting, so no discount was earned.
          </p>
          <div className="mt-3">
            <RetakeTestButton
              retakeAvailableOn={attempt.retake_available_on}
              onRetake={onRetake}
              to={retakeTo}
              size={compact ? 'sm' : 'md'}
              fullWidth={compact}
            />
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">
        Reference <span className="font-semibold text-ink-700">{attempt.reference_code}</span>
      </p>
    </Card>
  )
}
