import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, KeyRound, Lightbulb } from 'lucide-react'

import { cn } from '@/lib/cn'

export type DisclosureVariant = 'hint' | 'solution'

const VARIANTS: Record<
  DisclosureVariant,
  { label: string; icon: typeof Lightbulb; shell: string; button: string }
> = {
  hint: {
    label: 'Hint',
    icon: Lightbulb,
    shell: 'border-amber-200 bg-amber-50/60',
    button: 'text-amber-900 hover:bg-amber-100/60',
  },
  solution: {
    label: 'Solution',
    icon: KeyRound,
    shell: 'border-brand-200 bg-brand-50/50',
    button: 'text-brand-800 hover:bg-brand-100/50',
  },
}

/**
 * A collapsed hint or worked solution inside a coding exercise.
 *
 * Closed by default and on every page load: the point of a hint is that the
 * learner tries first, so nothing here is remembered between visits. It is a
 * real <button> with aria-expanded/aria-controls, matching the Accordion, so
 * keyboard and screen-reader users get the same behaviour.
 */
export function Disclosure({
  variant,
  title,
  children,
}: {
  variant: DisclosureVariant
  title?: string
  children: ReactNode
}) {
  const baseId = useId()
  const [open, setOpen] = useState(false)
  const { label, icon: Icon, shell, button } = VARIANTS[variant]

  return (
    <div className={cn('my-6 overflow-hidden rounded-xl border', shell)}>
      <button
        type="button"
        id={`${baseId}-button`}
        aria-expanded={open}
        aria-controls={`${baseId}-panel`}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold transition',
          button,
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{title ?? label}</span>
        <span className="text-xs font-medium opacity-70">{open ? 'Hide' : 'Show'}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      <div
        id={`${baseId}-panel`}
        role="region"
        aria-labelledby={`${baseId}-button`}
        hidden={!open}
        className="border-t border-inherit bg-white/70 px-4 py-4"
      >
        {children}
      </div>
    </div>
  )
}
