import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Clock, Users } from 'lucide-react'

import { CategoryIcon } from '@/components/cards/CategoryIcon'
import { Badge, Card, Rating } from '@/components/ui/primitives'
import { formatDuration, formatLevel, formatNumber, formatPrice, pluralize } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { CourseCard as CourseCardType } from '@/types/api'

export function CourseCard({
  course,
  className,
}: {
  course: CourseCardType
  className?: string
}) {
  return (
    <Card
      interactive
      className={cn('group relative flex h-full flex-col overflow-hidden', className)}
    >
      {course.thumbnail ? (
        <img
          src={course.thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          width={640}
          height={360}
          className="aspect-video w-full object-cover"
        />
      ) : (
        // A generated cover keeps the grid uniform without stock photography.
        <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-ink-50">
          <CategoryIcon
            name={course.icon ?? course.category?.slug ?? 'book-open'}
            className="h-10 w-10 text-brand-600"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {course.category && <Badge tone="brand">{course.category.name}</Badge>}
          <Badge tone="outline">{formatLevel(course.level)}</Badge>
        </div>

        <h3 className="text-base font-bold leading-snug text-ink-900">
          <Link
            to={`/courses/${course.slug}`}
            className="transition after:absolute after:inset-0 group-hover:text-brand-700"
          >
            {course.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600">
          {course.short_description}
        </p>

        <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <dt className="sr-only">Duration</dt>
            <dd>{formatDuration(course.duration_minutes)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <dt className="sr-only">Lessons</dt>
            <dd>{pluralize(course.lesson_count, 'lesson')}</dd>
          </div>
          {course.enrollment_count > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <dt className="sr-only">Learners</dt>
              <dd>{formatNumber(course.enrollment_count)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <Rating value={course.rating_average} count={course.rating_count} />
          <span
            className={cn(
              'text-sm font-bold',
              course.is_free ? 'text-emerald-700' : 'text-ink-900',
            )}
          >
            {formatPrice(course.price, course.currency)}
          </span>
        </div>

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
          View course
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Card>
  )
}
