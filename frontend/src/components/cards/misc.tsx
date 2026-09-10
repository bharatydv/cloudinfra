import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ExternalLink, FileText, Quote } from 'lucide-react'

import { CategoryIcon } from '@/components/cards/CategoryIcon'
import { Badge, Card, Rating } from '@/components/ui/primitives'
import { pluralize } from '@/lib/format'
import { cn } from '@/lib/cn'
import type {
  CertificationResource,
  CourseCategory,
  ProviderCard as ProviderCardType,
  Testimonial,
} from '@/types/api'

export function CategoryCard({
  category,
  to,
  className,
}: {
  category: CourseCategory
  to: string
  className?: string
}) {
  return (
    <Card interactive className={cn('group relative p-5', className)}>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <CategoryIcon name={category.icon ?? category.slug} className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-base font-bold text-ink-900">
        <Link to={to} className="after:absolute after:inset-0 group-hover:text-brand-700">
          {category.name}
        </Link>
      </h3>
      {category.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600">
          {category.description}
        </p>
      )}
      <p className="mt-4 text-xs font-medium text-ink-500">
        {pluralize(category.course_count, 'course')}
      </p>
    </Card>
  )
}

export function ProviderCard({ provider }: { provider: ProviderCardType }) {
  return (
    <Card interactive className="group relative flex items-center gap-4 p-5">
      {provider.logo ? (
        <img src={provider.logo} alt="" loading="lazy" className="h-11 w-11 object-contain" />
      ) : (
        <span
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: provider.accent_color ?? '#4f46e5' }}
          aria-hidden="true"
        >
          {provider.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-ink-900">
          <Link
            to={`/certifications/${provider.slug}`}
            className="after:absolute after:inset-0 group-hover:text-brand-700"
          >
            {provider.name}
          </Link>
        </h3>
        <p className="mt-0.5 text-xs text-ink-500">
          {pluralize(provider.certification_count, 'certification')}
        </p>
      </div>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-ink-400 transition group-hover:text-brand-600"
        aria-hidden="true"
      />
    </Card>
  )
}

const RESOURCE_LABELS: Record<string, string> = {
  guide: 'Guide',
  roadmap: 'Roadmap',
  practice: 'Practice',
  cheatsheet: 'Cheat sheet',
  exam_topic: 'Exam topic',
  external: 'External link',
}

export function ResourceCard({
  resource,
  onOpen,
}: {
  resource: CertificationResource
  onOpen?: (resource: CertificationResource) => void
}) {
  const label = RESOURCE_LABELS[resource.resource_type] ?? 'Resource'
  const isExternal = Boolean(resource.url)

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <Badge tone={resource.resource_type === 'practice' ? 'success' : 'brand'}>{label}</Badge>
        {resource.estimated_minutes ? (
          <span className="text-xs text-ink-500">{resource.estimated_minutes} min</span>
        ) : null}
      </div>
      <h3 className="mt-3 text-sm font-bold text-ink-900">{resource.title}</h3>
      {resource.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-600">{resource.description}</p>
      )}
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
        {isExternal ? 'Open resource' : 'Read resource'}
        {isExternal ? (
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </span>
    </>
  )

  if (isExternal) {
    return (
      <Card interactive className="p-5" id={`resource-${resource.id}`}>
        <a href={resource.url!} target="_blank" rel="noopener noreferrer" className="block">
          {body}
        </a>
      </Card>
    )
  }

  return (
    <Card interactive className="p-5" id={`resource-${resource.id}`}>
      <button type="button" onClick={() => onOpen?.(resource)} className="block w-full text-left">
        {body}
      </button>
    </Card>
  )
}

export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <Card className="flex h-full flex-col p-6">
      <Quote className="h-6 w-6 text-brand-200" aria-hidden="true" />
      <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink-700">
        {testimonial.content}
      </blockquote>
      <div className="mt-5 border-t border-ink-200 pt-4">
        <Rating value={testimonial.rating} count={1} />
        <p className="mt-2 text-sm font-semibold text-ink-900">{testimonial.user_name}</p>
        {testimonial.role && <p className="text-xs text-ink-500">{testimonial.role}</p>}
        {/* Seeded placeholder content is labelled rather than passed off as real. */}
        {testimonial.is_demo && (
          <Badge tone="warning" className="mt-3">
            Demo content
          </Badge>
        )}
      </div>
    </Card>
  )
}

export function StatsCard({
  label,
  value,
  icon,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  hint?: string
  tone?: 'default' | 'brand'
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-600">{label}</p>
        {icon && (
          <span
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg',
              tone === 'brand' ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-600',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </Card>
  )
}
