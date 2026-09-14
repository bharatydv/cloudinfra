import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarCheck, CheckCircle2, Clock, Home, ShieldCheck, Tag } from 'lucide-react'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, Container, Field, Input, Section, Select } from '@/components/ui/primitives'
import { ErrorState } from '@/components/ui/states'
import { getCertificationOptions, submitExamBooking } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { siteConfig } from '@/config/brand'
import { useAuth } from '@/hooks/useAuth'
import { useSeo } from '@/hooks/useSeo'
import { useSite } from '@/hooks/useSite'
import { NOINDEX } from '@/lib/seo'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { queryKeys } from '@/lib/queryClient'

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning (9am - 12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm - 4pm)' },
  { value: 'evening', label: 'Evening (4pm - 8pm)' },
]

const DELIVERY_MODES = [
  { value: 'online_proctored', label: 'Online proctored (from home)' },
  { value: 'test_center', label: 'At a test centre' },
]

/** `yyyy-mm-dd` in the visitor's own timezone, for the date inputs' `min`. */
function today(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** The day after `date`, so the alternate picker cannot offer the same day. */
function dayAfter(date: string): string {
  if (!date) return ''
  const next = new Date(`${date}T00:00:00`)
  if (Number.isNaN(next.getTime())) return ''
  next.setDate(next.getDate() + 1)
  return next.toISOString().slice(0, 10)
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Full IANA list where the engine exposes it, otherwise just the local zone. */
function timezoneOptions(current: string): string[] {
  let zones: string[] = []
  try {
    zones = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.(
      'timeZone',
    ) ?? []
  } catch {
    zones = []
  }
  return zones.includes(current) ? zones : [current, ...zones]
}

/** Kept unwrapped so the server's field errors can be matched against `.shape`. */
const fields = z.object({
  full_name: z.string().min(2, 'Please enter your full name.').max(120),
  email: z.string().email('Please enter a valid email address.'),
  phone: z
    .string()
    .min(6, 'Please enter a phone number we can reach you on.')
    .max(40),
  country: z.string().min(2, 'Please enter your country.').max(80),
  city: z.string().max(120).optional().or(z.literal('')),
  certification_id: z.string().uuid('Please choose the certification you want to sit.'),
  preferred_date: z.string().min(1, 'Please choose a preferred date.'),
  alternate_date: z.string().optional().or(z.literal('')),
  preferred_time_slot: z.enum(['morning', 'afternoon', 'evening']),
  timezone: z.string().min(2, 'Please choose your timezone.').max(80),
  delivery_mode: z.enum(['online_proctored', 'test_center']),
  // Honeypot: hidden from people, attractive to bots.
  website: z.string().max(0).optional().or(z.literal('')),
})

// The API enforces this too; checking it here saves a round trip to find out.
const schema = fields.refine(
  (values) => !values.alternate_date || values.alternate_date > values.preferred_date,
  {
    message: 'The alternate date must be later than the preferred date.',
    path: ['alternate_date'],
  },
)

type ScheduleForm = z.infer<typeof schema>

export default function ScheduleExamPage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const { promotion } = useSite()
  // Carried in from a certification page so the exam is already chosen.
  const preselected = params.get('certification') ?? ''

  useSeo({
    title: 'Schedule a certification exam',
    description:
      'Request a certification exam slot. Tell us the exam, your preferred date and how you want to sit it, and our team will confirm by email.',
    // A request form has nothing to rank for and should not compete with the
    // certification pages themselves.
    robots: NOINDEX,
  })

  const {
    data: options,
    isLoading: optionsLoading,
    isError: optionsError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.certificationOptions,
    queryFn: getCertificationOptions,
    staleTime: 10 * 60_000,
  })

  const zones = useMemo(() => timezoneOptions(browserTimezone()), [])

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: user?.name ?? '',
      email: user?.email ?? '',
      phone: '',
      country: '',
      city: '',
      certification_id: preselected,
      preferred_date: '',
      alternate_date: '',
      preferred_time_slot: 'morning',
      timezone: browserTimezone(),
      delivery_mode: 'online_proctored',
      website: '',
    },
  })

  // The account may resolve after the form mounts (token refresh on reload).
  useEffect(() => {
    if (user?.name) setValue('full_name', user.name, { shouldDirty: false })
    if (user?.email) setValue('email', user.email, { shouldDirty: false })
  }, [user, setValue])

  const mutation = useMutation({
    mutationFn: (values: ScheduleForm) =>
      submitExamBooking({
        ...values,
        city: values.city || null,
        alternate_date: values.alternate_date || null,
      }),
    onSuccess: (receipt) =>
      track(AnalyticsEvent.CtaClicked, {
        properties: { cta: 'exam_booking_submitted', certification: receipt.certification_name },
      }),
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field in fields.shape) {
            setError(field as keyof ScheduleForm, { message })
          }
        }
      }
    },
  })

  const selectedId = watch('certification_id')
  const selected = options?.find((option) => option.id === selectedId)

  /* ---------------------------------------------------------------------- */
  /* Confirmation                                                            */
  /* ---------------------------------------------------------------------- */
  if (mutation.isSuccess) {
    const receipt = mutation.data
    return (
      <Section className="py-16">
        <Container className="max-w-2xl">
          <Card className="p-8 text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-heading-lg text-ink-900">Request received</h1>
            <p className="mt-3 text-base leading-relaxed text-ink-600">{receipt.message}</p>

            <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-xl border border-ink-200 bg-ink-50/60 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Reference</dt>
                <dd className="font-bold tracking-wide text-ink-900">
                  {receipt.reference_code}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Certification</dt>
                <dd className="text-right font-semibold text-ink-900">
                  {receipt.certification_name}
                </dd>
              </div>
            </dl>

            {/* The two ways onwards the applicant actually wants from here. */}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink
                to="/"
                size="lg"
                leadingIcon={<Home className="h-4 w-4" aria-hidden="true" />}
              >
                Back to home
              </ButtonLink>
              <ButtonLink
                to={receipt.certification_url ?? '/certifications'}
                size="lg"
                variant="outline"
              >
                {receipt.certification_url
                  ? 'Back to the certification'
                  : 'Browse certifications'}
              </ButtonLink>
            </div>

            <p className="mt-6 border-t border-ink-200 pt-5 text-xs leading-relaxed text-ink-500">
              {siteConfig.independenceNotice} Exam seats are booked with the certification
              provider, so the final date and time depend on their availability.
            </p>
          </Card>
        </Container>
      </Section>
    )
  }

  /* ---------------------------------------------------------------------- */
  /* Form                                                                    */
  /* ---------------------------------------------------------------------- */
  return (
    <>
      <PageHeader
        title="Schedule a certification exam"
        description="Tell us which exam you want to sit and when suits you. Our team confirms your slot by email."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Schedule an exam', url: '/schedule-exam' },
        ]}
      />

      <Section className="py-14">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
            <Card className="p-6 sm:p-8">
              {optionsError ? (
                <ErrorState
                  title="We could not load the certification list"
                  description="Without it we cannot tell which exam you want to sit."
                  onRetry={() => void refetch()}
                />
              ) : (
                <>
                  {mutation.isError && !Object.keys(errors).length && (
                    <div
                      role="alert"
                      className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
                    >
                      {mutation.error instanceof ApiError
                        ? mutation.error.message
                        : 'We could not submit your request. Please try again.'}
                    </div>
                  )}

                  <form
                    noValidate
                    onSubmit={handleSubmit((values) => mutation.mutate(values))}
                    className="space-y-8"
                  >
                    <fieldset className="space-y-5">
                      <legend className="text-sm font-bold uppercase tracking-wider text-ink-500">
                        Which exam
                      </legend>

                      <Field
                        label="Certification"
                        htmlFor="certification_id"
                        required
                        error={errors.certification_id?.message}
                        hint={
                          preselected && selected
                            ? `Pre-filled from the ${selected.name} page.`
                            : undefined
                        }
                      >
                        <Select
                          id="certification_id"
                          disabled={optionsLoading}
                          invalid={Boolean(errors.certification_id)}
                          {...register('certification_id')}
                        >
                          <option value="">
                            {optionsLoading ? 'Loading certifications...' : 'Choose a certification'}
                          </option>
                          {options?.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.provider_name} &mdash; {option.name}
                              {option.exam_code ? ` (${option.exam_code})` : ''}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field
                        label="How do you want to sit it?"
                        htmlFor="delivery_mode"
                        required
                        error={errors.delivery_mode?.message}
                      >
                        <Select
                          id="delivery_mode"
                          invalid={Boolean(errors.delivery_mode)}
                          {...register('delivery_mode')}
                        >
                          {DELIVERY_MODES.map((mode) => (
                            <option key={mode.value} value={mode.value}>
                              {mode.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </fieldset>

                    <fieldset className="space-y-5">
                      <legend className="text-sm font-bold uppercase tracking-wider text-ink-500">
                        When
                      </legend>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                          label="Preferred date"
                          htmlFor="preferred_date"
                          required
                          error={errors.preferred_date?.message}
                        >
                          <Input
                            id="preferred_date"
                            type="date"
                            min={today()}
                            invalid={Boolean(errors.preferred_date)}
                            {...register('preferred_date')}
                          />
                        </Field>
                        <Field
                          label="Alternate date"
                          htmlFor="alternate_date"
                          hint="Optional, but it gets you a slot faster."
                          error={errors.alternate_date?.message}
                        >
                          <Input
                            id="alternate_date"
                            type="date"
                            min={dayAfter(watch('preferred_date')) || today()}
                            invalid={Boolean(errors.alternate_date)}
                            {...register('alternate_date')}
                          />
                        </Field>
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                          label="Preferred time"
                          htmlFor="preferred_time_slot"
                          required
                          error={errors.preferred_time_slot?.message}
                        >
                          <Select
                            id="preferred_time_slot"
                            invalid={Boolean(errors.preferred_time_slot)}
                            {...register('preferred_time_slot')}
                          >
                            {TIME_SLOTS.map((slot) => (
                              <option key={slot.value} value={slot.value}>
                                {slot.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field
                          label="Timezone"
                          htmlFor="timezone"
                          required
                          error={errors.timezone?.message}
                        >
                          <Select
                            id="timezone"
                            invalid={Boolean(errors.timezone)}
                            {...register('timezone')}
                          >
                            {zones.map((zone) => (
                              <option key={zone} value={zone}>
                                {zone}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    </fieldset>

                    <fieldset className="space-y-5">
                      <legend className="text-sm font-bold uppercase tracking-wider text-ink-500">
                        How to reach you
                      </legend>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                          label="Full name"
                          htmlFor="full_name"
                          required
                          error={errors.full_name?.message}
                        >
                          <Input
                            id="full_name"
                            autoComplete="name"
                            invalid={Boolean(errors.full_name)}
                            {...register('full_name')}
                          />
                        </Field>
                        <Field
                          label="Email"
                          htmlFor="email"
                          required
                          error={errors.email?.message}
                        >
                          <Input
                            id="email"
                            type="email"
                            autoComplete="email"
                            invalid={Boolean(errors.email)}
                            {...register('email')}
                          />
                        </Field>
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                          label="Phone"
                          htmlFor="phone"
                          required
                          error={errors.phone?.message}
                        >
                          <Input
                            id="phone"
                            type="tel"
                            autoComplete="tel"
                            placeholder="+91 90000 00000"
                            invalid={Boolean(errors.phone)}
                            {...register('phone')}
                          />
                        </Field>
                        <Field
                          label="Country"
                          htmlFor="country"
                          required
                          error={errors.country?.message}
                        >
                          <Input
                            id="country"
                            autoComplete="country-name"
                            invalid={Boolean(errors.country)}
                            {...register('country')}
                          />
                        </Field>
                      </div>

                      <Field
                        label="City"
                        htmlFor="city"
                        hint="Helps us find your nearest test centre."
                        error={errors.city?.message}
                      >
                        <Input
                          id="city"
                          autoComplete="address-level2"
                          invalid={Boolean(errors.city)}
                          {...register('city')}
                        />
                      </Field>
                    </fieldset>

                    <div aria-hidden="true" className="hidden">
                      <label htmlFor="website">Leave this field empty</label>
                      <input
                        id="website"
                        tabIndex={-1}
                        autoComplete="off"
                        {...register('website')}
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      loading={isSubmitting || mutation.isPending}
                      leadingIcon={<CalendarCheck className="h-4 w-4" aria-hidden="true" />}
                    >
                      Submit request
                    </Button>
                  </form>
                </>
              )}
            </Card>

            <aside className="space-y-6">
              {selected && (
                <Card className="p-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                    You are requesting
                  </h2>
                  <p className="mt-3 text-base font-bold text-ink-900">{selected.name}</p>
                  <p className="mt-1 text-sm text-ink-600">
                    {selected.provider_name}
                    {selected.exam_code ? ` · Exam ${selected.exam_code}` : ''}
                  </p>
                  <Link
                    to={selected.url}
                    className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline"
                  >
                    View the certification page
                  </Link>
                </Card>
              )}

              {/* Restate the offer at the point of conversion, not just in the
                  banner the visitor may already have dismissed. */}
              {promotion.enabled && (
                <Card className="border-brand-200 bg-brand-50/70 p-6">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                    <Tag className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    {promotion.badge || 'Current offer'}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-700">
                    {promotion.message}
                  </p>
                  {promotion.endsOn && (
                    <p className="mt-2 text-xs font-semibold text-brand-700">
                      Ends {promotion.endsOn}.
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-ink-500">
                    The discount is applied when our team confirms your slot.
                  </p>
                </Card>
              )}

              <Card className="p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                  What happens next
                </h2>
                <ol className="mt-4 space-y-4 text-sm text-ink-700">
                  {[
                    {
                      icon: CheckCircle2,
                      text: 'You get a confirmation email with a reference code straight away.',
                    },
                    {
                      icon: Clock,
                      text: 'Our team checks availability against your preferred and alternate dates.',
                    },
                    {
                      icon: ShieldCheck,
                      text: 'We email you the confirmed slot and the provider booking details.',
                    },
                  ].map((step) => (
                    <li key={step.text} className="flex items-start gap-3">
                      <step.icon
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                        aria-hidden="true"
                      />
                      {step.text}
                    </li>
                  ))}
                </ol>
                <p className="mt-5 border-t border-ink-200 pt-4 text-xs leading-relaxed text-ink-500">
                  {siteConfig.independenceNotice}
                </p>
              </Card>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  )
}
