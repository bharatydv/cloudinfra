import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  ClipboardX,
  Clock,
  PhoneCall,
  ShieldAlert,
  Timer,
  Trophy,
  XCircle,
} from 'lucide-react'

import {
  getChallengeIntro,
  reportChallengeWarning,
  startChallenge,
  submitChallenge,
} from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { ExamPriceComparison } from '@/components/cards/ExamPrice'
import { Button, ButtonLink } from '@/components/ui/Button'
import {
  Badge,
  Card,
  Container,
  Field,
  Input,
  ProgressBar,
  Section,
  SectionHeading,
} from '@/components/ui/primitives'
import { ErrorState, InlineSpinner } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useProctor } from '@/hooks/useProctor'
import { useSeo } from '@/hooks/useSeo'
import { cn } from '@/lib/cn'
import { formatLevel, formatPrice, pluralize } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import type {
  ChallengeIntro,
  ChallengeResult,
  ChallengeSession,
  ChallengeViolationKind,
} from '@/types/api'

type Phase = 'intro' | 'test' | 'result'

export default function ChallengePage() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [session, setSession] = useState<ChallengeSession | null>(null)
  const [result, setResult] = useState<ChallengeResult | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.challengeIntro,
    queryFn: getChallengeIntro,
  })

  useSeo({
    title: 'Google Cloud Certification Challenge',
    description:
      'Take a short proctored test on any Google Cloud certification. Pass it and our team calls you within 24 hours with a discount on your exam.',
    // Indexed deliberately: this is the campaign's landing page and carries
    // commercial intent ("google cloud certification discount").
  })

  if (isError) return <ChallengeShell><ErrorState onRetry={() => void refetch()} /></ChallengeShell>
  if (isLoading || !data) {
    return <ChallengeShell><InlineSpinner label="Loading the challenge" /></ChallengeShell>
  }

  if (!data.terms.enabled || data.options.length === 0) {
    return (
      <ChallengeShell>
        <Card className="px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-ink-900">The challenge is closed right now</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
            It will reopen soon. In the meantime you can browse the certifications and book an
            exam at our usual price.
          </p>
          <div className="mt-6">
            <ButtonLink to="/certifications">Browse certifications</ButtonLink>
          </div>
        </Card>
      </ChallengeShell>
    )
  }

  if (phase === 'test' && session) {
    return (
      <TestScreen
        session={session}
        onFinished={(finished) => {
          setResult(finished)
          setPhase('result')
        }}
      />
    )
  }

  if (phase === 'result' && result) {
    return (
      <ChallengeShell>
        <ResultScreen result={result} />
      </ChallengeShell>
    )
  }

  return (
    <IntroScreen
      intro={data}
      onStarted={(started) => {
        setSession(started)
        setPhase('test')
      }}
    />
  )
}

function ChallengeShell({ children }: { children: React.ReactNode }) {
  return (
    <Section>
      <Container className="max-w-4xl">{children}</Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Intro: the offer, the rules, and the lead form                             */
/* -------------------------------------------------------------------------- */
function IntroScreen({
  intro,
  onStarted,
}: {
  intro: ChallengeIntro
  onStarted: (session: ChallengeSession) => void
}) {
  const { user } = useAuth()
  const { terms, options } = intro
  // Held by id rather than by object so the selection survives a refetch that
  // returns new option instances for the same certifications.
  const [selectedId, setSelectedId] = useState(() => options[0]?.id ?? '')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    country: '',
    website: '',
  })
  const [accepted, setAccepted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Prefill from the session when there is one, so a signed-in learner does
  // not retype what we already know.
  useEffect(() => {
    if (!user) return
    setForm((current) => ({
      ...current,
      full_name: current.full_name || user.name,
      email: current.email || user.email,
    }))
  }, [user])

  const mutation = useMutation({
    mutationFn: startChallenge,
    onSuccess: onStarted,
    onError: (error) => {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors)
        setFormError(error.message)
      } else {
        setFormError('The test could not be started. Please try again.')
      }
    },
  })

  // The caller only renders this screen when there is at least one option, so
  // the fallback is belt and braces rather than a real branch.
  const selected = options.find((option) => option.id === selectedId) ?? options[0]
  if (!selected) return null
  const certificationId = selected.id

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)
    setFieldErrors({})
    if (!accepted) {
      setFormError('Please accept the test rules before starting.')
      return
    }
    mutation.mutate({
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      country: form.country.trim() || null,
      certification_id: certificationId,
      accept_rules: accepted,
      website: form.website,
    })
  }

  const reward = Number(terms.reward_discount_percentage)
  const saving =
    selected.pricing && reward > 0
      ? (Number(selected.pricing.total_price_amount) * reward) / 100
      : null

  return (
    <>
      {/* --- Offer ---------------------------------------------------------- */}
      <Section className="bg-gradient-to-b from-brand-50 to-white pb-10">
        <Container className="max-w-4xl text-center">
          <Badge tone="brand" className="mb-4">
            <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
            Limited campaign
          </Badge>
          <h1 className="text-heading-xl text-ink-900">
            Pass our {intro.provider_name} test, get{' '}
            <span className="text-brand-600">{reward}% off</span> your exam
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-600">
            {terms.question_count} questions, {terms.duration_minutes} minutes, on the{' '}
            {intro.provider_name} certification of your choice. Score{' '}
            {Number(terms.pass_mark)}% or more and our team calls you within{' '}
            {terms.response_hours} hours to apply the discount and schedule your exam on the
            date you want.
          </p>

          <dl className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              { icon: Timer, label: `${terms.duration_minutes} minutes`, hint: 'Timed, one sitting' },
              {
                icon: Trophy,
                label: `${Number(terms.pass_mark)}% to pass`,
                hint: `${terms.question_count} questions`,
              },
              {
                icon: PhoneCall,
                label: `${terms.response_hours}-hour callback`,
                hint: 'We schedule the exam with you',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-ink-200 bg-white p-4">
                <item.icon className="mx-auto h-5 w-5 text-brand-600" aria-hidden="true" />
                <dt className="mt-2 text-sm font-semibold text-ink-900">{item.label}</dt>
                <dd className="text-xs text-ink-500">{item.hint}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      <Section className="pt-0">
        <Container className="max-w-4xl">
          <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-5">
            {/* --- Pick the exam -------------------------------------------- */}
            <div className="lg:col-span-3">
              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-ink-900">
                  1. Which exam are you aiming for?
                </h2>
                <p className="mt-1 text-sm text-ink-600">
                  Your questions come from this certification&rsquo;s objectives.
                </p>

                <fieldset className="mt-4 space-y-3">
                  <legend className="sr-only">Choose a certification</legend>
                  {options.map((option) => {
                    const isSelected = option.id === selected.id
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition',
                          isSelected
                            ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500'
                            : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
                        )}
                      >
                        <input
                          type="radio"
                          name="certification"
                          value={option.id}
                          checked={isSelected}
                          onChange={() => setSelectedId(option.id)}
                          className="mt-1 h-4 w-4 accent-brand-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink-900">{option.name}</span>
                            {option.exam_code && <Badge tone="outline">{option.exam_code}</Badge>}
                            <Badge tone="neutral">{formatLevel(option.level)}</Badge>
                          </span>
                          <span className="mt-1 block text-xs text-ink-500">
                            {pluralize(option.question_count, 'question')} in this paper
                          </span>
                          {option.pricing && (
                            <ExamPriceComparison
                              pricing={option.pricing}
                              size="sm"
                              className="mt-2"
                            />
                          )}
                        </span>
                      </label>
                    )
                  })}
                </fieldset>
              </Card>

              {/* --- Rules ---------------------------------------------------- */}
              <Card className="mt-6 border-amber-200 bg-amber-50 p-5">
                <h2 className="flex items-center gap-2 text-base font-semibold text-amber-900">
                  <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                  2. Test rules &mdash; please read
                </h2>
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
                    <strong>{terms.max_warnings} warnings and the test ends.</strong> On the
                    final warning it submits automatically and is marked on the answers you have
                    given up to that point.
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
            </div>

            {/* --- Details -------------------------------------------------- */}
            <div className="lg:col-span-2">
              <Card className="p-5 sm:p-6 lg:sticky lg:top-24">
                <h2 className="text-lg font-semibold text-ink-900">3. Your details</h2>
                <p className="mt-1 text-sm text-ink-600">
                  We email your result here, and call you if you win the discount.
                </p>

                <div className="mt-4 space-y-4">
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

                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-700">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span>
                      I have read the test rules and agree the test may end after{' '}
                      {terms.max_warnings} warnings.
                    </span>
                  </label>

                  {saving !== null && selected.pricing && (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                      Pass and you save about{' '}
                      {formatPrice(saving, selected.pricing.currency)} on {selected.name}.
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
                </div>
              </Card>
            </div>
          </form>
        </Container>
      </Section>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Test: timer, proctoring, questions                                         */
/* -------------------------------------------------------------------------- */
function TestScreen({
  session,
  onFinished,
}: {
  session: ChallengeSession
  onFinished: (result: ChallengeResult) => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [warning, setWarning] = useState<{ message: string; count: number } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(() => remainingSeconds(session.expires_at))
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Submission must happen exactly once, whether it is triggered by the button,
  // the timer or the final warning -- all three can land in the same tick.
  const submitted = useRef(false)
  const answersRef = useRef(answers)
  answersRef.current = answers

  const submitMutation = useMutation({
    mutationFn: (auto: boolean) =>
      submitChallenge(session.attempt_id, {
        token: session.token,
        answers: Object.entries(answersRef.current).map(([question_id, option_key]) => ({
          question_id,
          option_key,
        })),
        auto_submitted: auto,
      }),
    onSuccess: onFinished,
    onError: (error) => {
      // Let them try again rather than losing the sitting to one bad response.
      submitted.current = false
      setSubmitError(
        error instanceof ApiError ? error.message : 'Your answers could not be submitted.',
      )
    },
  })

  const finish = useCallback(
    (auto: boolean) => {
      if (submitted.current) return
      submitted.current = true
      setSubmitError(null)
      submitMutation.mutate(auto)
    },
    [submitMutation],
  )

  // --- Proctoring ---------------------------------------------------------
  const handleViolation = useCallback(
    (kind: ChallengeViolationKind) => {
      if (submitted.current) return
      reportChallengeWarning(session.attempt_id, { token: session.token, kind })
        .then((receipt) => {
          setWarning({ message: receipt.message, count: receipt.warnings })
          // The server decides when the limit is reached, not the counter here.
          if (receipt.terminated) finish(true)
        })
        .catch(() => {
          /* A dropped warning must never interrupt the paper. */
        })
    },
    [session.attempt_id, session.token, finish],
  )

  useProctor({ active: !submitMutation.isPending && !submitted.current, onViolation: handleViolation })

  // --- Timer --------------------------------------------------------------
  useEffect(() => {
    const tick = window.setInterval(() => {
      const left = remainingSeconds(session.expires_at)
      setSecondsLeft(left)
      if (left <= 0) finish(true)
    }, 1000)
    return () => window.clearInterval(tick)
  }, [session.expires_at, finish])

  const question = session.questions[index]
  const answeredCount = Object.keys(answers).length
  const isLast = index === session.questions.length - 1
  const lowOnTime = secondsLeft <= 120

  // The index is only ever moved by this component's own controls, so an
  // out-of-range question means the paper is already being submitted.
  if (!question) return null

  return (
    <Section className="py-8">
      <Container className="max-w-4xl">
        {/* --- Status bar --------------------------------------------------- */}
        <Card className="sticky top-20 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">
              {session.certification_name}
            </p>
            <p className="text-xs text-ink-500">
              Question {index + 1} of {session.questions.length} &middot; {answeredCount} answered
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={warning ? 'danger' : 'neutral'}>
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              {warning?.count ?? 0} / {session.max_warnings} warnings
            </Badge>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums',
                lowOnTime ? 'bg-rose-50 text-rose-700' : 'bg-ink-100 text-ink-800',
              )}
              role="timer"
              aria-live={lowOnTime ? 'assertive' : 'off'}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatClock(secondsLeft)}
            </span>
          </div>
          <ProgressBar
            value={((index + 1) / session.questions.length) * 100}
            size="sm"
            className="w-full"
          />
        </Card>

        {/* --- Warning banner ----------------------------------------------- */}
        {warning && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
            <p className="text-sm font-medium text-rose-900">{warning.message}</p>
          </div>
        )}

        {/* --- Question ------------------------------------------------------
            select-none is the first line of the no-copying rule: with nothing
            selectable there is nothing for a copy to take. The proctor hook
            handles the attempts that get past it. */}
        <Card className="select-none p-5 sm:p-7" onDragStart={(e) => e.preventDefault()}>
          {question.topic && (
            <Badge tone="brand" className="mb-3">
              {question.topic}
            </Badge>
          )}
          <h2 className="text-lg font-semibold leading-relaxed text-ink-900">{question.prompt}</h2>

          <fieldset className="mt-5 space-y-2.5">
            <legend className="sr-only">Choose one answer</legend>
            {question.options.map((option) => {
              const isChosen = answers[question.id] === option.key
              return (
                <label
                  key={option.key}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition',
                    isChosen
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
                  )}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.key}
                    checked={isChosen}
                    onChange={() => setAnswers({ ...answers, [question.id]: option.key })}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                  />
                  <span className="flex-1 text-ink-800">
                    <span className="mr-2 font-semibold uppercase text-ink-500">{option.key}.</span>
                    {option.text}
                  </span>
                </label>
              )
            })}
          </fieldset>
        </Card>

        {submitError && (
          <p role="alert" className="mt-4 text-sm font-medium text-rose-700">
            {submitError}
          </p>
        )}

        {/* --- Navigation ---------------------------------------------------- */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            leadingIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Previous
          </Button>

          {isLast ? (
            <Button
              onClick={() => finish(false)}
              loading={submitMutation.isPending}
              size="lg"
            >
              Submit test
            </Button>
          ) : (
            <Button
              onClick={() => setIndex((i) => Math.min(session.questions.length - 1, i + 1))}
              trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
            >
              Next
            </Button>
          )}
        </div>

        {/* --- Question jump grid -------------------------------------------- */}
        <div className="mt-6 flex flex-wrap gap-2">
          {session.questions.map((item, position) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Go to question ${position + 1}${answers[item.id] ? ', answered' : ''}`}
              aria-current={position === index || undefined}
              className={cn(
                'h-9 w-9 rounded-lg border text-xs font-semibold transition',
                position === index
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : answers[item.id]
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-ink-300 bg-white text-ink-500 hover:bg-ink-50',
              )}
            >
              {position + 1}
            </button>
          ))}
        </div>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Result                                                                     */
/* -------------------------------------------------------------------------- */
function ResultScreen({ result }: { result: ChallengeResult }) {
  const passed = result.passed
  const scored = Number(result.score_percentage)

  return (
    <div className="space-y-6">
      <Card
        className={cn(
          'overflow-hidden p-6 text-center sm:p-8',
          passed ? 'border-emerald-300 bg-emerald-50' : 'border-ink-200',
        )}
      >
        <span
          className={cn(
            'mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full',
            passed ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500',
          )}
        >
          {passed ? (
            <Trophy className="h-7 w-7" aria-hidden="true" />
          ) : (
            <XCircle className="h-7 w-7" aria-hidden="true" />
          )}
        </span>

        <h1 className="mt-4 text-heading-lg text-ink-900">{result.headline}</h1>
        <p className="mt-1 text-sm text-ink-600">
          {result.correct_count} of {result.question_count} correct &middot; pass mark{' '}
          {Number(result.pass_mark)}%
        </p>

        <div className="mx-auto mt-5 max-w-sm">
          <ProgressBar value={scored} label="Your score" />
        </div>

        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ink-700">
          {result.message}
        </p>

        {passed && result.discount_percentage && (
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-emerald-300 bg-white p-5">
            <Badge tone="success" className="mb-2">
              <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
              {Number(result.discount_percentage)}% off unlocked
            </Badge>
            {result.pricing && result.rewarded_price && (
              <p className="text-sm text-ink-700">
                <s className="text-ink-500">
                  {formatPrice(result.pricing.total_price_amount, result.pricing.currency)}
                </s>{' '}
                <span className="text-xl font-extrabold text-emerald-700">
                  {formatPrice(result.rewarded_price, result.pricing.currency)}
                </span>{' '}
                for {result.certification_name}
              </p>
            )}
            <p className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-ink-800">
              <PhoneCall className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              We call you within {result.response_hours} hours to book it
            </p>
          </div>
        )}

        <p className="mt-6 text-xs text-ink-500">
          Reference <span className="font-semibold text-ink-700">{result.reference_code}</span>{' '}
          &middot; a copy of this result is on its way to your inbox
        </p>

        {(result.warnings > 0 || result.auto_submitted) && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
            <ClipboardX className="h-3.5 w-3.5" aria-hidden="true" />
            {result.warnings > 0 && `${pluralize(result.warnings, 'warning')} recorded`}
            {result.warnings > 0 && result.auto_submitted && ' · '}
            {result.auto_submitted && 'submitted automatically'}
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/schedule-exam">Schedule your exam</ButtonLink>
          <ButtonLink to="/certifications" variant="outline">
            Browse certifications
          </ButtonLink>
        </div>
      </Card>

      {/* --- Review ---------------------------------------------------------- */}
      {result.review.length > 0 && (
        <div>
          <SectionHeading
            title="Your answers"
            description="Every question, the right answer, and why. This is the fastest revision list you will get."
          />
          <ol className="space-y-4">
            {result.review.map((item) => (
              <li key={item.question_id}>
                <Card className="p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                        item.is_correct
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700',
                      )}
                    >
                      {item.is_correct ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-900">
                        {item.position}. {item.prompt}
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {item.options.map((option) => {
                          const isCorrect = option.key === item.correct_option
                          const isChosen = option.key === item.selected_option
                          return (
                            <li
                              key={option.key}
                              className={cn(
                                'rounded-lg border px-3 py-2 text-sm',
                                isCorrect
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                  : isChosen
                                    ? 'border-rose-300 bg-rose-50 text-rose-900'
                                    : 'border-ink-200 text-ink-600',
                              )}
                            >
                              <span className="mr-2 font-semibold uppercase">{option.key}.</span>
                              {option.text}
                              {isCorrect && (
                                <span className="ml-2 text-xs font-semibold">
                                  &larr; correct answer
                                </span>
                              )}
                              {isChosen && !isCorrect && (
                                <span className="ml-2 text-xs font-semibold">
                                  &larr; you chose this
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                      {!item.selected_option && (
                        <p className="mt-2 text-xs font-medium text-amber-800">
                          You did not answer this question.
                        </p>
                      )}
                      {item.explanation && (
                        <p className="mt-3 rounded-lg bg-ink-50 p-3 text-sm leading-relaxed text-ink-700">
                          {item.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="text-center text-xs text-ink-500">
        Questions are written from published exam objectives. They are not real exam questions
        and are not supplied by the certification provider. Read more in our{' '}
        <Link to="/disclaimer" className="underline hover:text-ink-700">
          disclaimer
        </Link>
        .
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
/** Seconds until the server's deadline. The clock is the server's, not ours. */
function remainingSeconds(expiresAt: string): number {
  const left = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  return Number.isFinite(left) ? Math.max(0, left) : 0
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
