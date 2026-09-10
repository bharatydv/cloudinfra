import type { ReactNode } from 'react'

import { Pagination } from '@/components/ui/Pagination'
import { Card } from '@/components/ui/primitives'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { cn } from '@/lib/cn'

export interface Column<T> {
  key: string
  header: string
  /** Right-align numeric and action columns. */
  align?: 'left' | 'right'
  className?: string
  render: (row: T) => ReactNode
}

/**
 * Data-dense admin table.
 *
 * Uses a real <table> with scoped headers so screen readers can navigate it,
 * and scrolls horizontally inside its own container on small screens.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  isError,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  page,
  totalPages,
  onPageChange,
  caption,
}: {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  caption?: string
}) {
  if (isError) return <ErrorState onRetry={onRetry} />
  if (isLoading) return <ListSkeleton rows={6} />
  if (!rows || rows.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    )
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="scroll-x">
          <table className="w-full min-w-[44rem] text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'px-4 py-3 text-left font-semibold text-ink-700',
                      column.align === 'right' && 'text-right',
                      column.className,
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200">
              {rows.map((row) => (
                <tr key={rowKey(row)} className="transition hover:bg-ink-50/60">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3 align-middle text-ink-700',
                        column.align === 'right' && 'text-right',
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {page && totalPages && onPageChange && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
      )}
    </div>
  )
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}
