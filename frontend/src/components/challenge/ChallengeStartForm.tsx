import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, ShieldAlert } from 'lucide-react'

import {
  confirmContactCode,
  getChallengeIntro,
  requestContactCode,
  startChallenge,
  type ContactChannel,
} from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Card, Field, Input, Select } from '@/components/ui/primitives'
import { ErrorState, InlineSpinner } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice, pluralize } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import type { ChallengeBookingPreferences, ChallengeIntro, ChallengeSession } from '@/types/api'

export interface ChallengePrefill {
  full_name?: string
  email?: string
  phone?: string
  country?: string
}

const CHANNELS: ContactChannel[] = ['email', 'phone']

type Step = 'details' | 'verify' | 'rules'

/**
 * The gate in front of every test. A guest registers, proves the email and
 * phone they typed with one-time codes, then reads the rules; an account
 * skips straight to the rules.
 *
 * Grading and the reward are decided server-side; this only starts the
 * attempt and hands the session back so the caller can open the paper.
 */
export function ChallengeStartForm({
  intro,
  certificationId,
  prefill,
  bookingPreferences,
  onStarted,
}: {
  intro: ChallengeIntro
  certificationId?: string
  prefill?: ChallengePrefill
  bookingPreferences?: ChallengeBookingPreferences | null
  /** The chosen certification rides along, so the result can link to its booking. */
  onStarted: (session: ChallengeSession, certificationId: string) => void
}) {
  const { user } = useAuth()
  const { terms, options } = intro
  /**
   * The certification the caller chose (a deal, the scheduling form). Without
   * one the candidate picks: defaulting silently to the first option seated
   * people for an exam they had not chosen, and the paper runs for
   * `terms.duration_minutes` with a retake window behind it.
   */
  const [chosenId, setChosenId] = useState(certificationId ?? options[0]?.id ?? '')
  const selected = options.find((option) => option.id === chosenId) ?? options[0] ?? null
  // Only when the caller did not name one -- a deal's own test never asks.
  const canChoose = !certificationId && options.length > 1

  const [form, setForm] = useState({
    full_name: prefill?.full_name ?? '',
    email: prefill?.email ?? '',
    phone: prefill?.phone ?? '',
    country: prefill?.country ?? '',
    website: '',
  })
  const [accepted, setAccepted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [step, setStep] = useState<Step>(user ? 'rules' : 'details')
  // The exact values that have been proven, so editing one address only
  // asks for that one again.
  const [verified, setVerified] = useState<Partial<Record<ContactChannel, string>>>({})
  // Where the codes went, as the server canonicalised the addresses.
  const [sentTo, setSentTo] = useState<Partial<Record<ContactChannel, string>>>({})
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!user) return
    // A signed-in learner's contact details come straight from the account.
    setForm((current) => ({
      ...current,
      full_name: current.full_name || user.name,
      email: current.email || user.email,
      phone: current.phone || user.phone,
    }))
    setStep('rules')
  }, [user])

  const mutation = useMutation({
    mutationFn: startChallenge,
    onSuccess: (session, variables) => onStarted(session, variables.certification_id),
    onError: (error) => {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors)
        setFormError(error.message)
        // A rejected detail has to be shown on the step that holds it, and a
        // lapsed verification has to be redone rather than skipped.
        if (Object.keys(error.fieldErrors).some((key) => key in form)) {
          setVerified({})
          setStep('details')
        }
      } else {
        setFormError('The test could not be started. Please try again.')
      }
    },
  })

  if (!selected) return null

  async function sendCodes() {
    const pending = terms.verification_required
      ? CHANNELS.filter((channel) => verified[channel] !== form[channel])
      : []
    if (pending.length === 0) {
      setStep('rules')
      return
    }
    setSending(true)
    try {
      const receipts = await Promise.all(
        pending.map((channel) => requestContactCode({ channel, target: form[channel] })),
      )
      setSentTo((current) => ({
        ...current,
        ...Object.fromEntries(receipts.map((receipt) => [receipt.channel, receipt.target])),
      }))
      setStep('verify')
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors)
        setFormError(error.message)
      } else {
        setFormError('We could not send the codes. Please try again.')
      }
    } finally {
      setSending(false)
    }
  }

  function markVerified(channel: ContactChannel) {
    const next = { ...verified, [channel]: form[channel] }
    setVerified(next)
    if (CHANNELS.every((each) => next[each] === form[each])) setStep('rules')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setFormError(null)
    setFieldErrors({})
    if (step === 'details') {
      void sendCodes()
      return
    }
    if (step === 'verify') return
    if (!accepted) {
      setFormError('Please accept the test rules before starting.')
      return
    }
    mutation.mutate({
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      country: form.country.trim() || null,
      certification_id: selected.id,
      accept_rules: accepted,
      booking_preferences: bookingPreferences ?? null,
      website: form.website,
    })
  }

  const minReward = Number(terms.reward_discount_min_percentage)
  const maxReward = Number(terms.reward_discount_max_percentage)
  const maxSaving =
    selected.pricing && maxReward > 0
      ? (Number(selected.pricing.total_price_amount) * maxReward) / 100
      : null

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {canChoose ? (
        <Field
          label="Which certification are you testing on?"
          htmlFor="challenge-certification"
          required
          hint={`${pluralize(selected.question_count, 'question')} in ${
            selected.duration_minutes
          } minutes, on this exam's published objectives.`}
        >
          <Select
            id="challenge-certification"
            value={chosenId}
            onChange={(event) => setChosenId(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.exam_code ? ` (${option.exam_code})` : ''}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-ink-900">{selected.name}</span>
          {selected.exam_code && <> &middot; {selected.exam_code}</>} &middot;{' '}
          {pluralize(selected.question_count, 'question')} in {selected.duration_minutes} minutes
        </p>
      )}

      {step === 'details' && (
        /* --- Step 1: register ----------------------------------------------- */
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900">Your details</h3>
            <p className="mt-1 text-sm text-ink-600">
              We email your result here, and call you if you win the discount.
              {terms.verification_required &&
                ' We’ll send a code to both to make sure they’re right.'}
            </p>
          </div>
          <Field label="Full name" htmlFor="full_name" required error={fieldErrors.full_name}>
            <Input
              id="full_name"
              value={form.full_name}
              autoComplete="name"
              required
              invalid={Boolean(fieldErrors.full_name)}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <Field label="Email" htmlFor="email" required error={fieldErrors.email}>
            <Input
              id="email"
              type="email"
              value={form.email}
              autoComplete="email"
              required
              invalid={Boolean(fieldErrors.email)}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field
            label="Phone"
            htmlFor="phone"
            required
            hint="With country code, so we can call you."
            error={fieldErrors.phone}
          >
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              autoComplete="tel"
              required
              invalid={Boolean(fieldErrors.phone)}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Country" htmlFor="country" error={fieldErrors.country}>
            <Input
              id="country"
              value={form.country}
              autoComplete="country-name"
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </Field>

          {/* Honeypot: hidden from people, irresistible to bots. */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm font-medium text-rose-700">
              {formError}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" loading={sending}>
            {terms.verification_required ? 'Send verification codes' : 'Continue'}
          </Button>
        </div>
      )}

      {step === 'verify' && (
        /* --- Step 2: prove the email and phone ------------------------------- */
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900">Verify your details</h3>
            <p className="mt-1 text-sm text-ink-600">
              Enter the 6-digit codes we just sent. Each one expires in a few minutes.
            </p>
          </div>
          {CHANNELS.map((channel) => (
            <CodeEntry
              key={channel}
              channel={channel}
              target={sentTo[channel] ?? form[channel]}
              verified={verified[channel] === form[channel]}
              onVerified={() => markVerified(channel)}
            />
          ))}
          <button
            type="button"
            onClick={() => setStep('details')}
            className="text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            Wrong email or number? Go back
          </button>
        </div>
      )}

      {step === 'rules' && (
        /* --- Step 3: rules, then start --------------------------------------- */
        <>
          {user ? (
            <p className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700">
              Testing as <span className="font-semibold text-ink-900">{user.name}</span>. We
              email your result to {user.email} and call {user.phone} if you win the discount.
            </p>
          ) : (
            <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{form.full_name}</span> &middot;{' '}
                  {sentTo.email ?? form.email} &middot; {sentTo.phone ?? form.phone}
                  {terms.verification_required && <> &middot; verified</>}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setStep('details')}
                className="font-semibold text-brand-700 hover:text-brand-800"
              >
                Change
              </button>
            </p>
          )}

          <Card className="border-amber-200 bg-amber-50 p-5">
            <h3 className="flex items-center gap-2 text-base font-semibold text-amber-900">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              Test rules &mdash; please read
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-amber-900">
              <li>
                <strong>Stay in this window.</strong> Switching tabs or applications is
                detected and costs a warning.
              </li>
              <li>
                <strong>No copying or pasting.</strong> The questions cannot be selected,
                copied or right-clicked, and trying costs a warning.
              </li>
              <li>
                <strong>{terms.max_warnings} warnings and the test ends.</strong> On the final
                warning it submits automatically and is marked on the answers you have given
                up to that point.
              </li>
              <li>
                <strong>One sitting.</strong> The timer keeps running if you leave, and you
                can retake the test after {pluralize(terms.retake_after_days, 'day')}.
              </li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-amber-800">
              These are study questions written from published exam objectives. They are not
              real exam questions and are not supplied by the certification provider.
            </p>
          </Card>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-600"
            />
            <span>
              I have read the test rules and agree the test may end after {terms.max_warnings}{' '}
              warnings.
            </span>
          </label>

          {maxSaving !== null && selected.pricing && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Pass and save {minReward}%&ndash;{maxReward}% on {selected.name} &mdash; up to{' '}
              {formatPrice(maxSaving, selected.pricing.currency)} for a perfect score.
            </p>
          )}

          {formError && (
            <p role="alert" className="text-sm font-medium text-rose-700">
              {formError}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" loading={mutation.isPending}>
            Start the test
          </Button>
          <p className="text-center text-xs text-ink-500">
            The timer starts as soon as you press this.
          </p>
        </>
      )}
    </form>
  )
}

/** One code box: typed, checked, and marked done in place. */
function CodeEntry({
  channel,
  target,
  verified,
  onVerified,
}: {
  channel: ContactChannel
  target: string
  verified: boolean
  onVerified: () => void
}) {
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const label = channel === 'email' ? 'Email code' : 'Phone code'
  const id = `${channel}-code`

  const confirm = useMutation({
    mutationFn: () => confirmContactCode({ channel, target, code }),
    onSuccess: () => {
      setNotice(null)
      onVerified()
    },
    onError: (error) => {
      setNotice(
        error instanceof ApiError
          ? (error.fieldErrors.code ?? error.message)
          : 'We could not check that code. Please try again.',
      )
    },
  })
  const resend = useMutation({
    mutationFn: () => requestContactCode({ channel, target }),
    onSuccess: () => {
      setCode('')
      setNotice('A new code is on its way.')
    },
    onError: () => setNotice('We could not send a new code. Please try again.'),
  })

  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (code.length === 6) confirm.mutate()
  }

  if (verified) {
    return (
      <p className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {target} verified
      </p>
    )
  }

  return (
    <Field
      label={label}
      htmlFor={id}
      required
      error={notice && !notice.startsWith('A new code') ? notice : undefined}
    >
      <p className="mb-1.5 text-xs text-ink-500">Sent to {target}</p>
      <div className="flex gap-2">
        <Input
          id={id}
          value={code}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="flex-1"
          invalid={Boolean(notice) && !notice?.startsWith('A new code')}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={submitOnEnter}
        />
        <Button
          type="button"
          onClick={() => confirm.mutate()}
          disabled={code.length !== 6}
          loading={confirm.isPending}
        >
          Verify
        </Button>
      </div>
      <button
        type="button"
        onClick={() => resend.mutate()}
        disabled={resend.isPending}
        className="mt-1.5 text-xs font-medium text-brand-700 hover:underline disabled:opacity-60"
      >
        {resend.isPending ? 'Sending...' : notice?.startsWith('A new code') ? notice : 'Resend code'}
      </button>
    </Field>
  )
}

/**
 * The same gate as a popup, for pages that list deals: the visitor reads the
 * rules and starts without leaving, and the caller decides where the paper
 * opens.
 */
export function ChallengeStartModal({
  open,
  certificationId,
  onClose,
  onStarted,
}: {
  open: boolean
  certificationId?: string
  onClose: () => void
  onStarted: (session: ChallengeSession, certificationId: string) => void
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.challengeIntro,
    queryFn: getChallengeIntro,
    enabled: open,
  })

  const closed = data && (!data.terms.enabled || data.options.length === 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Take the test to qualify"
      description={
        data && !closed
          ? `Score ${Number(data.terms.pass_mark)}% or more to win ${Number(
              data.terms.reward_discount_min_percentage,
            )}%–${Number(data.terms.reward_discount_max_percentage)}% off your exam.`
          : undefined
      }
    >
      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <InlineSpinner label="Loading the test" />
      ) : closed ? (
        <div className="py-6 text-center">
          <p className="text-base font-semibold text-ink-900">The test is closed right now</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
            It will reopen soon. In the meantime you can browse the certifications and book an
            exam at our usual price.
          </p>
          <div className="mt-5">
            <ButtonLink to="/certifications">Browse certifications</ButtonLink>
          </div>
        </div>
      ) : (
        <ChallengeStartForm intro={data} certificationId={certificationId} onStarted={onStarted} />
      )}
    </Modal>
  )
}
