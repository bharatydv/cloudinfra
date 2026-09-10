import { Link } from 'react-router-dom'
import { ArrowRight, Bookmark, BookmarkCheck, GraduationCap } from 'lucide-react'

import { Badge, Card } from '@/components/ui/primitives'
import { formatLevel, pluralize } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { CertificationCard as CertificationCardType } from '@/types/api'

export function CertificationCard({
  certification,
  className,
  onToggleSave,
  saving,
}: {
  certification: CertificationCardType
  className?: string
  onToggleSave?: (certification: CertificationCardType) => void
  saving?: boolean
}) {
  const href = `/certifications/${certification.provider_slug}/${certification.slug}`

  return (
    <Card interactive className={cn('group relative flex h-full flex-col p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {certification.provider_logo ? (
            <img
              src={certification.provider_logo}
              alt=""
              loading="lazy"
              className="h-9 w-9 rounded-lg object-contain"
            />
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            {/* Provider name describes what the material covers, not a partnership. */}
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-500">
              {certification.provider_name}
            </p>
            {certification.exam_code && (
              <p className="text-xs text-ink-400">Exam {certification.exam_code}</p>
            )}
          </div>
        </div>

        {onToggleSave && (
          <button
            type="button"
            onClick={() => onToggleSave(certification)}
            disabled={saving}
            aria-pressed={certification.is_saved}
            aria-label={
              certification.is_saved
                ? `Remove ${certification.name} from saved`
                : `Save ${certification.name}`
            }
            className="relative z-10 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-brand-700 disabled:opacity-50"
          >
            {certification.is_saved ? (
              <BookmarkCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      <h3 className="text-base font-bold leading-snug text-ink-900">
        <Link to={href} className="transition after:absolute after:inset-0 group-hover:text-brand-700">
          {certification.name}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600">
        {certification.short_description}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone="brand">{formatLevel(certification.level)}</Badge>
        {certification.skills.slice(0, 2).map((skill) => (
          <Badge key={skill} tone="outline">
            {skill}
          </Badge>
        ))}
        {certification.skills.length > 2 && (
          <Badge tone="outline">+{certification.skills.length - 2}</Badge>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="text-xs text-ink-500">
          {certification.course_count > 0
            ? pluralize(certification.course_count, 'related course')
            : 'Study resources available'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
          Explore
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Card>
  )
}
