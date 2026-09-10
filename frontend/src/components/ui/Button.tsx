import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition ' +
  'duration-150 disabled:pointer-events-none disabled:opacity-55 whitespace-nowrap'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-subtle hover:bg-brand-700 active:bg-brand-800',
  secondary:
    'bg-ink-900 text-white shadow-subtle hover:bg-ink-800 active:bg-ink-950',
  outline:
    'border border-ink-300 bg-white text-ink-800 hover:border-ink-400 hover:bg-ink-50',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>

function content(
  children: ReactNode,
  loading?: boolean,
  leadingIcon?: ReactNode,
  trailingIcon?: ReactNode,
) {
  return (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        leadingIcon
      )}
      {children}
      {!loading && trailingIcon}
    </>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth,
    loading,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content(children, loading, leadingIcon, trailingIcon)}
    </button>
  )
})

export type ButtonLinkProps = CommonProps & LinkProps

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  )
}

export function ExternalButtonLink({
  variant = 'outline',
  size = 'md',
  className,
  children,
  href,
  leadingIcon,
  trailingIcon,
}: CommonProps & { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </a>
  )
}
