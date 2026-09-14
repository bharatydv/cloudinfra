import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, ListChecks } from 'lucide-react'

import { Button, ButtonLink, type ButtonSize, type ButtonVariant } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { scheduleExamPath } from '@/lib/scheduling'

/**
 * Direct link to the form, optionally pre-filled.
 *
 * Used wherever the certification is already known, so there is nothing to ask.
 */
export function ScheduleExamLink({
  certificationId,
  children = 'Schedule Exam',
  size = 'lg',
  variant = 'primary',
  className,
  cta = 'schedule_exam',
}: {
  certificationId?: string | null
  children?: ReactNode
  size?: ButtonSize
  variant?: ButtonVariant
  className?: string
  cta?: string
}) {
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
    </ButtonLink>
  )
}

/**
 * Two-way entry point for pages where no certification is in context.
 *
 * Someone who already knows which exam they want should not be forced through
 * the catalogue, and someone who does not should not be dropped onto a form
 * with an empty certification picker -- so the choice is made explicitly.
 */
export function ScheduleExamButton({
  size = 'lg',
  variant = 'primary',
  className,
  label = 'Schedule Exam',
}: {
  size?: ButtonSize
  variant?: ButtonVariant
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={className}
        leadingIcon={<CalendarCheck className="h-4 w-4" aria-hidden="true" />}
        onClick={() => {
          setOpen(true)
          track(AnalyticsEvent.CtaClicked, { properties: { cta: 'schedule_exam_chooser' } })
        }}
      >
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule your certification exam"
        description="Pick the exam first, or go straight to the request form."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ChooserCard
            to="/certifications"
            icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
            title="Browse certifications"
            description="See every exam we support, then request a slot from its page with the details filled in for you."
            onNavigate={() => setOpen(false)}
          />
          <ChooserCard
            to="/schedule-exam"
            icon={<CalendarCheck className="h-5 w-5" aria-hidden="true" />}
            title="Go straight to the form"
            description="Already know which exam you want? Choose it from the list and tell us when suits you."
            onNavigate={() => setOpen(false)}
          />
        </div>
      </Modal>
    </>
  )
}

function ChooserCard({
  to,
  icon,
  title,
  description,
  onNavigate,
}: {
  to: string
  icon: ReactNode
  title: string
  description: string
  onNavigate: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="group flex flex-col rounded-xl border border-ink-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        {icon}
      </span>
      <span className="mt-3 flex items-center gap-1.5 text-sm font-bold text-ink-900">
        {title}
        <ArrowRight
          className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
      <span className="mt-1.5 text-sm leading-relaxed text-ink-600">{description}</span>
    </Link>
  )
}
