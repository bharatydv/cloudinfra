import type { ReactNode } from 'react'
import { CalendarCheck } from 'lucide-react'

import { ButtonLink, type ButtonSize, type ButtonVariant } from '@/components/ui/Button'
import { useSite } from '@/hooks/useSite'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { scheduleExamPath } from '@/lib/scheduling'

/**
 * The single entry point to the scheduling form.
 *
 * Passing a certification id pre-fills it, which is what the certification
 * pages do. Everywhere else the form's own picker handles the choice, so the
 * button always goes straight there rather than asking first -- a step in
 * front of a form only costs submissions.
 *
 * When an offer is running, its badge rides along on the label.
 */
export function ScheduleExamLink({
  certificationId,
  children = 'Schedule Exam',
  size = 'lg',
  variant = 'primary',
  className,
  cta = 'schedule_exam',
  showBadge = true,
}: {
  certificationId?: string | null
  children?: ReactNode
  size?: ButtonSize
  variant?: ButtonVariant
  className?: string
  cta?: string
  /** Set false where the surrounding copy already states the offer. */
  showBadge?: boolean
}) {
  const { promotion } = useSite()
  const badge = showBadge && promotion.enabled ? promotion.badge : ''

  return (
    <ButtonLink
      to={scheduleExamPath(certificationId)}
      size={size}
      variant={variant}
      className={className}
      leadingIcon={<CalendarCheck className="h-4 w-4" aria-hidden="true" />}
      onClick={() => track(AnalyticsEvent.CtaClicked, { properties: { cta } })}
    >
      {children}
      {badge && (
        <span className="ml-1.5 rounded-md bg-white/20 px-1.5 py-0.5 text-xs font-bold">
          {badge}
        </span>
      )}
    </ButtonLink>
  )
}
