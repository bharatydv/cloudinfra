import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'

import { AuthShell } from '@/pages/auth/AuthShell'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/primitives'
import { resendVerification } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useSeo } from '@/hooks/useSeo'
import { useToast } from '@/hooks/useToast'
import { NOINDEX } from '@/lib/seo'

const schema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code from your email.').regex(/^\d{6}$/, 'The code is 6 digits.'),
})

type VerifyForm = z.infer<typeof schema>

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { verifyEmail } = useAuth()
  const email = params.get('email') ?? ''
  const [formError, setFormError] = useState<string | null>(null)

  useSeo({ title: 'Verify your email', robots: NOINDEX })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyForm>({ resolver: zodResolver(schema) })

  const resendMutation = useMutation({
    mutationFn: () => resendVerification(email),
    onSuccess: () => toast.success('A new code is on its way.'),
  })

  async function onSubmit(values: VerifyForm) {
    setFormError(null)
    try {
      await verifyEmail(email, values.code)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'We could not verify that code.',
      )
    }
  }

  if (!email) {
    return (
      <AuthShell
        title="Verification link missing"
        description="This page needs an email address to verify."
        footer={
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        }
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Start from the sign-up page so we know which account to verify.
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Verify your email"
      description={`Enter the 6-digit code we sent to ${email}.`}
      footer={
        <>
          Wrong email?{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">
            Start over
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

        <Field label="Verification code" htmlFor="code" required error={errors.code?.message}>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            invalid={Boolean(errors.code)}
            {...register('code')}
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Verify and continue
        </Button>

        <button
          type="button"
          onClick={() => resendMutation.mutate()}
          disabled={resendMutation.isPending}
          className="w-full text-center text-sm font-medium text-brand-700 hover:underline disabled:opacity-60"
        >
          {resendMutation.isPending ? 'Sending...' : 'Resend code'}
        </button>
      </form>
    </AuthShell>
  )
}
