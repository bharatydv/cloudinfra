import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { BadgePercent, CheckCircle2, FileText, Handshake } from 'lucide-react'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import {
  Card,
  Container,
  Field,
  Input,
  Section,
  Select,
  Textarea,
} from '@/components/ui/primitives'
import { submitContact } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useSeo } from '@/hooks/useSeo'
import { useSite } from '@/hooks/useSite'

const PARTNER_TYPES = [
  'Blogger or content creator',
  'YouTube or social media channel',
  'Training institute or coaching centre',
  'Student or tech community',
  'Company upskilling its team',
  'Other',
] as const

const STEPS = [
  {
    icon: FileText,
    title: 'Apply',
    description:
      'Tell us about your website, channel or community. Every application is reviewed by a person.',
  },
  {
    icon: Handshake,
    title: 'Agree terms',
    description:
      'If it is a fit, we reply by email with the commission terms and how your referrals are tracked.',
  },
  {
    icon: BadgePercent,
    title: 'Refer learners',
    description:
      'Point your audience to discounted cloud certifications and earn on the bookings they make.',
  },
] as const

const schema = z.object({
  name: z.string().min(2, 'Please enter your name.').max(120),
  email: z.string().email('Please enter a valid email address.'),
  partner_type: z.enum(PARTNER_TYPES, { message: 'Please choose what best describes you.' }),
  channel_url: z
    .string()
    .min(3, 'Please add your website, channel or community link.')
    .max(300),
  audience: z.string().max(300).optional(),
  message: z.string().max(4000).optional(),
  // Honeypot: hidden from people, attractive to bots.
  website: z.string().max(0).optional().or(z.literal('')),
})

type AffiliateForm = z.infer<typeof schema>

/**
 * Applications travel through the contact pipeline, so they land in the admin
 * Messages inbox under one recognisable subject with no extra backend.
 */
function toContactPayload(values: AffiliateForm) {
  const lines = [
    `Partner type: ${values.partner_type}`,
    `Website / channel: ${values.channel_url.trim()}`,
    values.audience?.trim() ? `Audience: ${values.audience.trim()}` : null,
    values.message?.trim() ? `\n${values.message.trim()}` : null,
  ]
  return {
    name: values.name,
    email: values.email,
    subject: 'Affiliate partnership application',
    message: lines.filter(Boolean).join('\n'),
    website: values.website,
  }
}

export default function AffiliatePage() {
  const { brand } = useSite()

  useSeo({
    title: 'Affiliate partnership',
    description:
      'Refer learners to discounted cloud certifications and earn commission on the bookings you send us.',
  })

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AffiliateForm>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (values: AffiliateForm) => submitContact(toContactPayload(values)),
    onSuccess: () => reset(),
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field === 'name' || field === 'email') setError(field, { message })
        }
      }
    },
  })

  return (
    <>
      <PageHeader
        title="Affiliate partnership"
        description="Refer learners to discounted cloud certifications and earn commission on the bookings you send us."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Affiliate partnership', url: '/affiliate' },
        ]}
      />

      <Section className="py-14">
        <Container>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <step.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h2 className="text-base font-semibold text-ink-900">
                      {index + 1}. {step.title}
                    </h2>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-600">{step.description}</p>
                </Card>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <Card className="p-6 sm:p-8">
              <h2 className="text-heading text-ink-900">Apply to become a partner</h2>
              <p className="mt-2 text-sm text-ink-600">
                A few details about where your audience is helps us reply faster.
              </p>

              {mutation.isSuccess && (
                <div
                  role="status"
                  className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4"
                >
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-emerald-900">
                    Thanks for applying. We have your application and will reply by email.
                  </p>
                </div>
              )}

              {mutation.isError && !Object.keys(errors).length && (
                <div
                  role="alert"
                  className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
                >
                  {mutation.error instanceof ApiError
                    ? mutation.error.message
                    : 'We could not send your application. Please try again.'}
                </div>
              )}

              <form
                noValidate
                onSubmit={handleSubmit((values) => mutation.mutate(values))}
                className="mt-6 space-y-5"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Name" htmlFor="name" required error={errors.name?.message}>
                    <Input
                      id="name"
                      autoComplete="name"
                      invalid={Boolean(errors.name)}
                      {...register('name')}
                    />
                  </Field>
                  <Field label="Email" htmlFor="email" required error={errors.email?.message}>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      invalid={Boolean(errors.email)}
                      {...register('email')}
                    />
                  </Field>
                </div>

                <Field
                  label="What best describes you?"
                  htmlFor="partner_type"
                  required
                  error={errors.partner_type?.message}
                >
                  <Select
                    id="partner_type"
                    defaultValue=""
                    invalid={Boolean(errors.partner_type)}
                    {...register('partner_type')}
                  >
                    <option value="" disabled>
                      Choose one
                    </option>
                    {PARTNER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Website, channel or community link"
                  htmlFor="channel_url"
                  required
                  error={errors.channel_url?.message}
                >
                  <Input
                    id="channel_url"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    invalid={Boolean(errors.channel_url)}
                    {...register('channel_url')}
                  />
                </Field>

                <Field
                  label="Audience"
                  htmlFor="audience"
                  hint="Roughly how many people you reach, and who they are."
                  error={errors.audience?.message}
                >
                  <Input
                    id="audience"
                    invalid={Boolean(errors.audience)}
                    {...register('audience')}
                  />
                </Field>

                <Field
                  label="Anything else we should know?"
                  htmlFor="message"
                  error={errors.message?.message}
                >
                  <Textarea
                    id="message"
                    rows={5}
                    invalid={Boolean(errors.message)}
                    {...register('message')}
                  />
                </Field>

                <div aria-hidden="true" className="hidden">
                  <label htmlFor="website">Leave this field empty</label>
                  <input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
                </div>

                <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending}>
                  Submit application
                </Button>
              </form>
            </Card>

            <aside className="space-y-6">
              <Card className="p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                  Who it&rsquo;s for
                </h2>
                <ul className="mt-5 space-y-3 text-sm text-ink-700">
                  {PARTNER_TYPES.filter((type) => type !== 'Other').map((type) => (
                    <li key={type} className="flex items-start gap-3">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                        aria-hidden="true"
                      />
                      {type}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="bg-brand-50/60 p-6">
                <h2 className="text-sm font-bold text-ink-900">A partnership with us only</h2>
                <p className="mt-2 text-sm text-ink-600">
                  The affiliate partnership is with {brand.brandName}. It does not make you a
                  partner of AWS, Microsoft, Google or any other certification provider.
                </p>
              </Card>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  )
}
