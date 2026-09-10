import { useState, type ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card, Label, Select } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterDefinition {
  id: string
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

/**
 * Filter sidebar. Collapses into a disclosure on small screens so filters stay
 * usable on mobile without a modal.
 */
export function FilterPanel({
  filters,
  activeCount,
  onReset,
  children,
  className,
}: {
  filters: FilterDefinition[]
  activeCount: number
  onReset: () => void
  children?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const body = (
    <div className="space-y-5">
      {filters.map((filter) => (
        <div key={filter.id} className="space-y-1.5">
          <Label htmlFor={filter.id}>{filter.label}</Label>
          <Select
            id={filter.id}
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
      {children}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" fullWidth onClick={onReset}>
          Clear all filters
        </Button>
      )}
    </div>
  )

  return (
    <div className={className}>
      {/* Mobile trigger */}
      <div className="lg:hidden">
        <Button
          variant="outline"
          fullWidth
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="filter-panel"
          leadingIcon={
            open ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            )
          }
        >
          {open ? 'Hide filters' : 'Filters'}
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </Button>
        <div id="filter-panel" hidden={!open} className="mt-3">
          <Card className="p-5">{body}</Card>
        </div>
      </div>

      {/* Desktop sidebar */}
      <Card className={cn('hidden p-5 lg:block')}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
        </h2>
        {body}
      </Card>
    </div>
  )
}
