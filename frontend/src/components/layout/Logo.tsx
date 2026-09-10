import { Link } from 'react-router-dom'

import { useBrand } from '@/hooks/useSite'
import { cn } from '@/lib/cn'

/**
 * Brand mark. Reads from configuration, so replacing the brand never requires
 * touching a component.
 */
export function Logo({
  className,
  tone = 'default',
  showName = true,
}: {
  className?: string
  tone?: 'default' | 'inverse'
  showName?: boolean
}) {
  const brand = useBrand()

  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-2.5 rounded-lg', className)}
      aria-label={`${brand.brandName} home`}
    >
      {brand.logo ? (
        <img src={brand.logo} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-extrabold tracking-tight text-white shadow-subtle"
        >
          {brand.logoMark}
        </span>
      )}
      {showName && (
        <span
          className={cn(
            'text-lg font-extrabold tracking-tight',
            tone === 'inverse' ? 'text-white' : 'text-ink-900',
          )}
        >
          {brand.brandName}
        </span>
      )}
    </Link>
  )
}
