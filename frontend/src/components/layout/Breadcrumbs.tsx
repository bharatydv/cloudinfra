import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/cn'
import type { Breadcrumb } from '@/types/api'

/**
 * Breadcrumb trail. The matching BreadcrumbList JSON-LD is emitted by the API
 * alongside the page's other structured data, so this renders the visible half.
 */
export function Breadcrumbs({
  items,
  className,
  tone = 'default',
}: {
  items: Breadcrumb[]
  className?: string
  tone?: 'default' | 'inverse'
}) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <Fragment key={`${item.url}-${index}`}>
              <li className="flex items-center">
                {isLast ? (
                  <span
                    aria-current="page"
                    className={cn(
                      'max-w-[18rem] truncate font-medium',
                      tone === 'inverse' ? 'text-white' : 'text-ink-900',
                    )}
                  >
                    {item.name}
                  </span>
                ) : (
                  <Link
                    to={item.url}
                    className={cn(
                      'transition hover:underline',
                      tone === 'inverse'
                        ? 'text-ink-300 hover:text-white'
                        : 'text-ink-500 hover:text-brand-700',
                    )}
                  >
                    {item.name}
                  </Link>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRight
                    className={cn(
                      'h-4 w-4',
                      tone === 'inverse' ? 'text-ink-500' : 'text-ink-400',
                    )}
                  />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
