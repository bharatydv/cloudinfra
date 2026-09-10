import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'

import { AuthShell } from '@/pages/auth/AuthShell'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/primitives'
import { ApiError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useSeo } from '@/hooks/useSeo'
import { NOINDEX } from '@/lib/seo'

const schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
})

type LoginForm = z.infer<typeof schema>

interface LocationState {
  from?: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useSeo({ title: 'Log in', robots: NOINDEX })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) })

  async function onSubmit(values: LoginForm) {
    setFormError(null)
    try {
      const user = await login(values.email, values.password)
      const state = location.state as LocationState | null
      // Admins land in the console; everyone else resumes where they were.
      navigate(state?.from ?? (user.role === 'admin' ? '/admin' : '/dashboard'), {
        replace: true,
      })
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.',
      )
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to continue your courses and track your progress."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">
            Create an account
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
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pr-11"
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-500 hover:text-ink-800"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Log in
        </Button>
      </form>
    </AuthShell>
  )
}
