import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'

import { Logo } from '@/components/layout/Logo'
import { Container } from '@/components/ui/primitives'
import { useBrand } from '@/hooks/useSite'

const BENEFITS = [
  'Structured courses across cloud, AI, data and DevOps',
  'Certification preparation mapped to published objectives',
  'Progress saved to your account and synced across devices',
]

/** Two-column auth shell: form on the left, quiet reassurance on the right. */
export function AuthShell({
  title,
  description,
  footer,
  children,
}: {
  title: string
  description: string
  footer?: ReactNode
  children: ReactNode
}) {
  const brand = useBrand()

  return (
    <div className="min-h-screen bg-white">
      <a href="#auth-main" className="skip-link">
        Skip to main content
      </a>

      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="flex flex-col">
          <header className="border-b border-ink-200 px-6 py-5 lg:border-0">
            <Logo />
          </header>

          <main id="auth-main" className="flex flex-1 items-center justify-center px-6 py-10">
            <div className="w-full max-w-md">
              <h1 className="text-heading-lg text-ink-900">{title}</h1>
              <p className="mt-2 text-sm text-ink-600">{description}</p>
              <div className="mt-8">{children}</div>
              {footer && <div className="mt-6 text-center text-sm text-ink-600">{footer}</div>}
              <p className="mt-8 text-center text-xs text-ink-500">
                By continuing you agree to our{' '}
                <Link to="/terms" className="underline underline-offset-2 hover:text-ink-700">
                  terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="underline underline-offset-2 hover:text-ink-700">
                  privacy policy
                </Link>
                .
              </p>
            </div>
          </main>
        </div>

        <aside className="relative hidden overflow-hidden bg-ink-950 lg:block">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_10%,rgb(79_70_229/0.35),transparent)]"
          />
          <Container className="relative flex h-full max-w-md flex-col justify-center px-10">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">
              {brand.brandName}
            </p>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-white">
              {brand.brandTagline}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-300">{brand.brandDescription}</p>
            <ul className="mt-8 space-y-3">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-ink-300">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-400"
                    aria-hidden="true"
                  />
                  {benefit}
                </li>
              ))}
            </ul>
          </Container>
        </aside>
      </div>
    </div>
  )
}
