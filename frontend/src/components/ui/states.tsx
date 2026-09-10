import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

/* -------------------------------------------------------------------------- */
/* Skeletons                                                                  */
/* -------------------------------------------------------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}

/** Fixed-height blocks so content arriving does not shift the layout. */
export function CardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <Skeleton className="mt-4 h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-5/6" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-9 w-full rounded-lg" />
    </Card>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <Card key={index} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        </Card>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Empty / error                                                              */
/* -------------------------------------------------------------------------- */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
      </span>
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-ink-600">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content. Please try again.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-ink-600">{description}</p>
      {onRetry && (
        <Button
          variant="outline"
          className="mt-6"
          onClick={onRetry}
          leadingIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          Try again
        </Button>
      )}
    </Card>
  )
}

export function InlineSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-ink-500">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  )
}
