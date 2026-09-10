import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { z } from 'zod'

import { AuthShell } from '@/pages/auth/AuthShell'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/primitives'
import { forgotPassword, resetPassword } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useSeo } from '@/hooks/useSeo'
import { useToast } from '@/hooks/useToast'
import { NOINDEX } from '@/lib/seo'

/* -------------------------------------------------------------------------- */
/* Forgot password                                                            */
/* -------------------------------------------------------------------------- */
const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export function ForgotPasswordPage() {
  useSeo({ title: 'Reset your password', robots: NOINDEX })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) })

  const mutation = useMutation({
    mutationFn: (values: ForgotForm) => forgotPassword(values.email),
  })

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email address and we will send you a reset link."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Back to login
          </Link>
        </>
      }
    >
      {mutation.isSuccess ? (
        /* The same message regardless of whether the account exists. */
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <MailCheck className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
          <p className="mt-3 text-sm text-emerald-900">{mutation.data?.message}</p>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-5"
        >
          <Field label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={mutation.isPending}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

/* -------------------------------------------------------------------------- */
/* Reset password                                                             */
/* -------------------------------------------------------------------------- */
const resetSchema = z
  .object({
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

type ResetForm = z.infer<typeof resetSchema>

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const token = params.get('token') ?? ''
  const [formError, setFormError] = useState<string | null>(null)

  useSeo({ title: 'Choose a new password', robots: NOINDEX })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) })

  async function onSubmit(values: ResetForm) {
    setFormError(null)
    try {
      await resetPassword({ token, ...values })
      toast.success('Password updated. Please sign in.')
      navigate('/login', { replace: true })
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'We could not reset your password.',
      )
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Reset link missing"
        description="This page needs a valid reset link."
        footer={
          <Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">
            Request a new link
          </Link>
        }
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The reset link is incomplete or has expired. Request a new one to continue.
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="Pick something you have not used elsewhere."
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Back to login
        </Link>
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

        <Field label="New password" htmlFor="password" required error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

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
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
