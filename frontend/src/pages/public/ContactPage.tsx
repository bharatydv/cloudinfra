import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Clock, Mail, MapPin, Phone } from 'lucide-react'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, Container, Field, Input, Section, Textarea } from '@/components/ui/primitives'
import { submitContact } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useSeo } from '@/hooks/useSeo'
import { useSite } from '@/hooks/useSite'

const schema = z.object({
  name: z.string().min(2, 'Please enter your name.').max(120),
  email: z.string().email('Please enter a valid email address.'),
  subject: z.string().min(3, 'Please add a subject.').max(200),
  message: z
    .string()
    .min(10, 'Please give us a little more detail (at least 10 characters).')
    .max(5000),
  // Honeypot: hidden from people, attractive to bots.
  website: z.string().max(0).optional().or(z.literal('')),
})

type ContactForm = z.infer<typeof schema>

export default function ContactPage() {
  const { contact, brand } = useSite()

  useSeo({
    title: 'Contact us',
    description: 'Get in touch with our team for support, partnerships or feedback.',
  })

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (values: ContactForm) => submitContact(values),
    onSuccess: () => reset(),
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field in schema.shape) {
            setError(field as keyof ContactForm, { message })
          }
        }
      }
    },
  })

  return (
    <>
      <PageHeader
        title="Contact us"
        description="Questions about a course, a certification path, or your account? Send us a message."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Contact', url: '/contact' },
        ]}
      />

      <Section className="py-14">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <Card className="p-6 sm:p-8">
              <h2 className="text-heading text-ink-900">Send a message</h2>
              <p className="mt-2 text-sm text-ink-600">
                Include your account email and the course or certification involved so we can help
                faster.
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
                    Thanks for reaching out. We have your message and will reply by email.
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
                    : 'We could not send your message. Please try again.'}
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

                <Field label="Subject" htmlFor="subject" required error={errors.subject?.message}>
                  <Input id="subject" invalid={Boolean(errors.subject)} {...register('subject')} />
                </Field>

                <Field label="Message" htmlFor="message" required error={errors.message?.message}>
                  <Textarea
                    id="message"
                    rows={6}
                    invalid={Boolean(errors.message)}
                    {...register('message')}
                  />
                </Field>

                <div aria-hidden="true" className="hidden">
                  <label htmlFor="website">Leave this field empty</label>
                  <input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
                </div>

                <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending}>
                  Send message
                </Button>
              </form>
            </Card>

            <aside className="space-y-6">
              <Card className="p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                  Get in touch
                </h2>
                <ul className="mt-5 space-y-4 text-sm">
                  {contact.email && (
                    <li className="flex items-start gap-3">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      <a href={`mailto:${contact.email}`} className="text-ink-700 hover:text-brand-700">
                        {contact.email}
                      </a>
                    </li>
                  )}
                  {contact.phone && (
                    <li className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      <a href={`tel:${contact.phone}`} className="text-ink-700 hover:text-brand-700">
                        {contact.phone}
                      </a>
                    </li>
                  )}
                  {contact.address && (
                    <li className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      <span className="text-ink-700">{contact.address}</span>
                    </li>
                  )}
                  {contact.responseTime && (
                    <li className="flex items-start gap-3">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      <span className="text-ink-700">{contact.responseTime}</span>
                    </li>
                  )}
                </ul>
                {/* Only real details are shown; nothing is invented to fill the block. */}
                {!contact.phone && !contact.address && (
                  <p className="mt-5 border-t border-ink-200 pt-4 text-xs text-ink-500">
                    Additional contact details are published here once they are configured.
                  </p>
                )}
              </Card>

              <Card className="bg-brand-50/60 p-6">
                <h2 className="text-sm font-bold text-ink-900">Looking for help with a course?</h2>
                <p className="mt-2 text-sm text-ink-600">
                  Most questions about enrollment, progress and certificates are answered in the
                  FAQs on the {brand.brandName} homepage.
                </p>
              </Card>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  )
}
