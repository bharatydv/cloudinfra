import type { ReactNode } from 'react'

import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Container } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import type { Breadcrumb } from '@/types/api'

/** Consistent H1 + breadcrumb block for every listing and detail page. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  tone = 'default',
  children,
  className,
}: {
  title: string
  description?: string
  breadcrumbs?: Breadcrumb[]
  actions?: ReactNode
  tone?: 'default' | 'dark'
  children?: ReactNode
  className?: string
}) {
  const dark = tone === 'dark'

  return (
    <section
      className={cn(
        'border-b',
        dark ? 'border-ink-800 bg-ink-950' : 'border-ink-200 bg-ink-50',
        className,
      )}
    >
      <Container className="py-10 sm:py-14">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} className="mb-5" tone={dark ? 'inverse' : 'default'} />
        )}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h1 className={cn('text-heading-lg sm:text-4xl', dark && 'text-white')}>{title}</h1>
            {description && (
              <p className={cn('mt-3 text-base leading-relaxed', dark ? 'text-ink-300' : 'text-ink-600')}>
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
        {children}
      </Container>
    </section>
  )
}
