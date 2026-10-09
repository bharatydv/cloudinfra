import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

import { getChallengeIntro, reportChallengeWarning, submitChallenge } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { PayExamButton, RetakeTestButton } from '@/components/challenge/AttemptOutcome'
import {
  ChallengeStartForm,
  type ChallengePrefill,
} from '@/components/challenge/ChallengeStartForm'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  Badge,
  Card,
  Container,
  ProgressBar,
  Section,
  SectionHeading,
} from '@/components/ui/primitives'
import { ErrorState, InlineSpinner } from '@/components/ui/states'
import { useProctor } from '@/hooks/useProctor'
import { useSeo } from '@/hooks/useSeo'
import { cn } from '@/lib/cn'
import { formatPrice, pluralize } from '@/lib/format'
import { scheduleExamPath } from '@/lib/scheduling'
import { queryKeys } from '@/lib/queryClient'
import type {
  ChallengeBookingPreferences,
  ChallengeIntro,
  ChallengeResult,
  ChallengeSession,
  ChallengeViolationKind,
} from '@/types/api'

type Phase = 'intro' | 'test' | 'result'

/** Carried in `location.state` by the pages that send a visitor here.
 *
 * The deals page starts the attempt in its own popup and passes the resulting
 * `session`, so the paper opens immediately. The scheduling form instead
 * preselects the certification, prefills the lead form and threads the
 * requested slot through to the discount callback. */
interface ChallengeHandoff {
  session?: ChallengeSession
  certificationId?: string
  prefill?: ChallengePrefill
  bookingPreferences?: ChallengeBookingPreferences
}

export default function ChallengePage() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const handoff = (location.state as ChallengeHandoff | null) ?? null
  // An open paper survives a reload: the server's clock keeps running either
  // way, so losing the session in memory used to cost the whole sitting.
  const restored = handoff?.session ?? readOpenAttempt()
  const [session, setSession] = useState<ChallengeSession | null>(restored)
  const [phase, setPhase] = useState<Phase>(restored ? 'test' : 'intro')
  const [result, setResult] = useState<ChallengeResult | null>(null)
  // Carried to the result screen so its booking link arrives prefilled.
  const [certificationId, setCertificationId] = useState<string | null>(
    handoff?.certificationId ?? null,
  )

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.challengeIntro,
    queryFn: getChallengeIntro,
  })

  useSeo({
    title: data
      ? `${data.provider_name} certification challenge`
      : 'Certification challenge',
    description: data
      ? `Sit a ${data.terms.question_count}-question test on a ${data.provider_name} certification in ${data.terms.duration_minutes} minutes. Pass it and our team calls you within ${data.terms.response_hours} hours with a discount on your exam.`
      : 'Sit a proctored test on your target certification and earn a discount on the exam fee.',
  })

  // An attempt handed over from another page (the deals popup starts it there)
  // is recorded too, so a reload on this page can pick it up.
  useEffect(() => {
    if (handoff?.session) storeOpenAttempt(handoff.session)
  }, [handoff?.session])

  // A paper that is already open never waits on the intro: the attempt was
  // started elsewhere and its clock is already running.
  if (phase === 'test' && session) {
    return (
      <TestScreen
        session={session}
        onFinished={(finished) => {
          clearOpenAttempt(session.attempt_id)
          setResult(finished)
          setPhase('result')
          // A signed-in learner's dashboard, and any certification or deal
          // card they open next, should show this sitting straight away.
          void queryClient.invalidateQueries({ queryKey: queryKeys.myChallengeAttempts })
        }}
      />
    )
  }

  if (phase === 'result' && result) {
    return (
      <ChallengeShell>
        <ResultScreen
          result={result}
          certificationId={certificationId}
          /* The session token authorises paying for the exam this paper just
             earned a discount on, which is how a signed-out candidate can. */
          token={session?.token ?? null}
          onRetake={() => {
            setResult(null)
            setSession(null)
            setPhase('intro')
          }}
        />
      </ChallengeShell>
    )
  }

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

  return (
    <IntroScreen
      intro={data}
      handoff={handoff}
      onStarted={(started, startedCertificationId) => {
        storeOpenAttempt(started)
        setCertificationId(startedCertificationId)
        setSession(started)
        setPhase('test')
      }}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Resuming an open attempt                                                   */
/* -------------------------------------------------------------------------- */
/**
 * An attempt lives in `sessionStorage` while it is open.
 *
 * The timer belongs to the server, so a reload mid-paper does not stop the
 * clock -- it used to lose the token needed to submit, which forfeited the
 * sitting and, with a retake window, locked the candidate out for days. The
 * record is dropped the moment the paper is submitted, and an expired one is
 * never restored.
 */
const OPEN_ATTEMPT_KEY = 'lb.challenge_attempt'

function storeOpenAttempt(session: ChallengeSession): void {
  try {
    sessionStorage.setItem(OPEN_ATTEMPT_KEY, JSON.stringify(session))
  } catch {
    /* Private browsing: the attempt simply will not survive a reload. */
  }
}

function clearOpenAttempt(attemptId?: string): void {
  try {
    sessionStorage.removeItem(OPEN_ATTEMPT_KEY)
    if (attemptId) sessionStorage.removeItem(answersKey(attemptId))
  } catch {
    /* Nothing to clear. */
  }
}

/** Answers in progress, so a reload restores the work and not just the paper. */
function answersKey(attemptId: string): string {
  return `lb.challenge_answers.${attemptId}`
}

function storeAnswers(attemptId: string, answers: Record<string, string>): void {
  try {
    sessionStorage.setItem(answersKey(attemptId), JSON.stringify(answers))
  } catch {
    /* Nothing to persist to. */
  }
}

function readAnswers(attemptId: string): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(answersKey(attemptId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    // Only string values survive: this is storage the candidate can edit.
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, value]) => typeof value === 'string',
      ) as [string, string][],
    )
  } catch {
    return {}
  }
}

function readOpenAttempt(): ChallengeSession | null {
  try {
    const raw = sessionStorage.getItem(OPEN_ATTEMPT_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as ChallengeSession
    // Shape-checked rather than trusted: this is storage anyone can edit.
    if (!session?.attempt_id || !session.token || !Array.isArray(session.questions)) {
      clearOpenAttempt()
      return null
    }
    if (remainingSeconds(session.expires_at) <= 0) {
      clearOpenAttempt()
      return null
    }
    return session
  } catch {
    clearOpenAttempt()
    return null
  }
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
  handoff,
  onStarted,
}: {
  intro: ChallengeIntro
  handoff: ChallengeHandoff | null
  onStarted: (session: ChallengeSession, certificationId: string) => void
}) {
  const { terms } = intro
  const minReward = Number(terms.reward_discount_min_percentage)
  const maxReward = Number(terms.reward_discount_max_percentage)

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
            Pass our {intro.provider_name} test, win{' '}
            <span className="text-brand-600">
              {minReward}%&ndash;{maxReward}% off
            </span>{' '}
            your exam
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-600">
            {terms.question_count} questions in {terms.duration_minutes} minutes. Score{' '}
            {Number(terms.pass_mark)}%+ to unlock {minReward}%&ndash;{maxReward}% off, and we call
            you within {terms.response_hours} hours to book it.
          </p>

          {handoff?.bookingPreferences && (
            <p className="mx-auto mt-4 max-w-xl rounded-lg border border-brand-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-800">
              Continuing from your exam request &mdash; we already have your details below.
              Review the rules and start when ready.
            </p>
          )}

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
        <Container className="max-w-2xl">
          <ChallengeStartForm
            intro={intro}
            certificationId={handoff?.certificationId}
            prefill={handoff?.prefill}
            bookingPreferences={handoff?.bookingPreferences}
            onStarted={onStarted}
          />
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
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    readAnswers(session.attempt_id),
  )
  const [index, setIndex] = useState(0)
  const [warning, setWarning] = useState<{ message: string; count: number } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(() => remainingSeconds(session.expires_at))
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Asked before an early submit, never before the timer's own.
  const [confirmSubmit, setConfirmSubmit] = useState(false)

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

  // Kept beside the attempt, so a reload restores the paper *and* the answers.
  useEffect(() => {
    storeAnswers(session.attempt_id, answers)
  }, [session.attempt_id, answers])

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
              onClick={() =>
                answeredCount < session.questions.length ? setConfirmSubmit(true) : finish(false)
              }
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

        {/* One sitting and a retake window, so an early submit is checked. */}
        <Modal
          open={confirmSubmit}
          onClose={() => setConfirmSubmit(false)}
          title="Submit with unanswered questions?"
          description={`${pluralize(
            session.questions.length - answeredCount,
            'question',
          )} still unanswered. Unanswered questions are marked wrong, and you cannot reopen the paper.`}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
                Keep working
              </Button>
              <Button
                loading={submitMutation.isPending}
                onClick={() => {
                  setConfirmSubmit(false)
                  finish(false)
                }}
              >
                Submit anyway
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-600">
            You have {formatClock(secondsLeft)} left on the clock.
          </p>
        </Modal>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Result                                                                     */
/* -------------------------------------------------------------------------- */
function ResultScreen({
  result,
  certificationId,
  token,
  onRetake,
}: {
  result: ChallengeResult
  certificationId: string | null
  token: string | null
  onRetake: () => void
}) {
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
            {/* The unlocked price, once. It is the figure the catalogue
                already advertises, not a further cut off it. */}
            {result.pricing && result.rewarded_price && (
              <p className="text-sm text-ink-700">
                <span className="text-xl font-extrabold text-emerald-700">
                  {formatPrice(result.rewarded_price, result.pricing.currency)}
                </span>{' '}
                for {result.certification_name}
              </p>
            )}
            {/* Pay now when there is a working checkout for this exam;
                otherwise the campaign's original promise still stands. */}
            {result.can_pay && result.rewarded_price && result.pricing ? (
              <>
                <div className="mt-4">
                  <PayExamButton
                    attemptId={result.attempt_id}
                    token={token}
                    amount={result.rewarded_price}
                    currency={result.pricing.currency}
                    discountPercentage={result.discount_percentage}
                    fullWidth
                  />
                </div>
                <p className="mt-3 text-xs text-ink-600">
                  Pay now to lock the discount in, or leave it and we will call you
                  within {result.response_hours} hours to take payment.
                </p>
              </>
            ) : (
              <p className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-ink-800">
                <PhoneCall className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                We call you within {result.response_hours} hours to book it
              </p>
            )}
          </div>
        )}

        {/* A failed paper gets the one thing it needs: another go, as soon as
            the cooldown the campaign sets allows one. */}
        {!passed && (
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-ink-200 bg-ink-50/70 p-5">
            <p className="text-sm font-semibold text-ink-900">Try again</p>
            <div className="mt-3 flex justify-center">
              <RetakeTestButton
                retakeAvailableOn={result.retake_available_on}
                onRetake={onRetake}
                variant="primary"
              />
            </div>
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

        {/* Deep-linked, so the exam and the reference are not re-entered. */}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <ButtonLink to={scheduleExamPath(certificationId)}>
            Schedule {result.certification_name}
          </ButtonLink>
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
