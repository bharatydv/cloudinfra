import {
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Star } from 'lucide-react'

import { cn } from '@/lib/cn'

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('container max-w-[1280px]', className)}>{children}</div>
}

export function Section({
  className,
  children,
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLElement> & { tone?: 'default' | 'muted' | 'dark' }) {
  return (
    <section
      className={cn(
        'py-16 sm:py-20',
        tone === 'muted' && 'bg-ink-50',
        tone === 'dark' && 'bg-ink-950 text-ink-100',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'default',
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  tone?: 'default' | 'dark'
  action?: ReactNode
}) {
  return (
    <div
      className={cn(
        'mb-10 flex flex-col gap-4 sm:mb-12',
        align === 'center' ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between',
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && (
          <p
            className={cn(
              'mb-2 text-sm font-semibold uppercase tracking-wider',
              tone === 'dark' ? 'text-brand-300' : 'text-brand-600',
            )}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className={cn(
            'text-heading-lg',
            tone === 'dark' ? 'text-white' : 'text-ink-900',
          )}
        >
          {title}
        </h2>
        {description && (
          <p className={cn('mt-3 text-base', tone === 'dark' ? 'text-ink-300' : 'text-ink-600')}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */
export function Card({
  className,
  interactive,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-ink-200 bg-white shadow-subtle',
        interactive && 'hover-lift',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'outline'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-rose-50 text-rose-700',
  outline: 'border border-ink-300 text-ink-600',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */
export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('block text-sm font-semibold text-ink-800', className)} {...props}>
      {children}
    </label>
  )
}

const FIELD_BASE =
  'w-full rounded-lg border bg-white px-3.5 text-sm text-ink-900 shadow-subtle ' +
  'transition placeholder:text-ink-400 disabled:cursor-not-allowed disabled:bg-ink-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          FIELD_BASE,
          'h-11',
          invalid ? 'border-rose-400' : 'border-ink-300 hover:border-ink-400',
          className,
        )}
        {...props}
      />
    )
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        FIELD_BASE,
        'min-h-[8rem] py-2.5 leading-relaxed',
        invalid ? 'border-rose-400' : 'border-ink-300 hover:border-ink-400',
        className,
      )}
      {...props}
    />
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        FIELD_BASE,
        'h-11 cursor-pointer pr-8',
        invalid ? 'border-rose-400' : 'border-ink-300 hover:border-ink-400',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
})

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  const describedBy = [error ? `${htmlFor}-error` : null, hint ? `${htmlFor}-hint` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-1 text-rose-600" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      <div aria-describedby={describedBy || undefined}>{children}</div>
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
      {/* Errors are text, not colour alone. */}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */
export function ProgressBar({
  value,
  label,
  size = 'md',
  className,
}: {
  value: number
  label?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-600">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className={cn('w-full overflow-hidden rounded-full bg-ink-200', size === 'sm' ? 'h-1.5' : 'h-2')}
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

export function Rating({
  value,
  count,
  size = 'sm',
}: {
  value: string | number
  count?: number
  size?: 'sm' | 'md'
}) {
  const rating = typeof value === 'string' ? Number.parseFloat(value) : value
  const safe = Number.isFinite(rating) ? rating : 0
  if (!count) {
    return <span className="text-xs text-ink-500">No ratings yet</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
              star <= Math.round(safe)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-ink-200 text-ink-200',
            )}
          />
        ))}
      </span>
      <span className="text-xs font-medium text-ink-600">
        {safe.toFixed(1)}
        <span className="sr-only"> out of 5</span> ({count})
      </span>
    </span>
  )
}

export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const dimension = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm'
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn('rounded-full object-cover', dimension)}
      />
    )
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700',
        dimension,
      )}
    >
      {initials || '?'}
    </span>
  )
}
