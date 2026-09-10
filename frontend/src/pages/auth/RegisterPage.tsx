import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, X } from 'lucide-react'
import { z } from 'zod'

import { AuthShell } from '@/pages/auth/AuthShell'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/primitives'
import { ApiError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useSeo } from '@/hooks/useSeo'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/cn'

// Mirrors the server-side password policy so users see failures immediately.
const schema = z
  .object({
    name: z.string().min(2, 'Please enter your full name.').max(120),
    email: z.string().email('Please enter a valid email address.'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/\d/, 'Include at least one number.'),
    confirm_password: z.string(),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: 'Passwords do not match.',
    path: ['confirm_password'],
  })

type RegisterForm = z.infer<typeof schema>

const RULES = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'Contains a letter', test: (value: string) => /[A-Za-z]/.test(value) },
  { label: 'Contains a number', test: (value: string) => /\d/.test(value) },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  useSeo({ title: 'Create your account', robots: NOINDEX })

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) })

  const password = watch('password') ?? ''

  async function onSubmit(values: RegisterForm) {
    setFormError(null)
    try {
      await registerUser(values)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setError('email', { message: 'An account with that email already exists.' })
          return
        }
        setFormError(error.message)
        return
      }
      setFormError('Registration failed. Please try again.')
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="Free to join. Start a course in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900"
          >
            {formError}
          </div>
        )}

        <Field label="Full name" htmlFor="name" required error={errors.name?.message}>
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

        <Field label="Password" htmlFor="password" required error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        {/* Requirements are shown with an icon and text, not colour alone. */}
        <ul className="space-y-1.5">
          {RULES.map((rule) => {
            const passed = rule.test(password)
            return (
              <li
                key={rule.label}
                className={cn(
                  'flex items-center gap-2 text-xs',
                  passed ? 'text-emerald-700' : 'text-ink-500',
                )}
              >
                {passed ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {rule.label}
                <span className="sr-only">{passed ? ' - met' : ' - not met'}</span>
              </li>
            )
          })}
        </ul>

        <Field
          label="Confirm password"
          htmlFor="confirm_password"
          required
          error={errors.confirm_password?.message}
        >
          <Input
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.confirm_password)}
            {...register('confirm_password')}
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
