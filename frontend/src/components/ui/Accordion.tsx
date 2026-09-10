import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/cn'

export interface AccordionItem {
  question: string
  answer: string
}

/**
 * Accessible disclosure list.
 *
 * Uses a real <button> per row with aria-expanded/aria-controls so keyboard and
 * screen-reader users get the same behaviour as pointer users.
 */
export function Accordion({
  items,
  allowMultiple = false,
  className,
}: {
  items: AccordionItem[]
  allowMultiple?: boolean
  className?: string
}) {
  const baseId = useId()
  const [open, setOpen] = useState<number[]>([])

  function toggle(index: number) {
    setOpen((current) => {
      const isOpen = current.includes(index)
      if (allowMultiple) {
        return isOpen ? current.filter((item) => item !== index) : [...current, index]
      }
      return isOpen ? [] : [index]
    })
  }

  if (items.length === 0) return null

  return (
    <div className={cn('divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 bg-white', className)}>
      {items.map((item, index) => {
        const isOpen = open.includes(index)
        const buttonId = `${baseId}-button-${index}`
        const panelId = `${baseId}-panel-${index}`

        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-ink-50"
              >
                <span className="text-base font-semibold text-ink-900">{item.question}</span>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 shrink-0 text-ink-500 transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-5 text-sm leading-relaxed text-ink-600"
            >
              {item.answer}
            </div>
          </div>
        )
      })}
    </div>
  )
}
