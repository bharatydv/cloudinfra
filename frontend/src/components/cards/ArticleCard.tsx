import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'

import { CategoryIcon } from '@/components/cards/CategoryIcon'
import { Avatar, Badge, Card } from '@/components/ui/primitives'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ArticleCard as ArticleCardType } from '@/types/api'

export function ArticleCard({
  article,
  variant = 'default',
  className,
}: {
  article: ArticleCardType
  variant?: 'default' | 'compact' | 'featured'
  className?: string
}) {
  const href = `/resources/${article.slug}`

  if (variant === 'compact') {
    return (
      <article className={cn('group relative border-b border-ink-200 py-4 last:border-0', className)}>
        <h3 className="text-sm font-semibold leading-snug text-ink-900">
          <Link to={href} className="transition after:absolute after:inset-0 group-hover:text-brand-700">
            {article.title}
          </Link>
        </h3>
        <p className="mt-1.5 flex items-center gap-2 text-xs text-ink-500">
          {article.category && <span>{article.category.name}</span>}
          <span aria-hidden="true">&middot;</span>
          <span>{article.reading_minutes} min read</span>
        </p>
      </article>
    )
  }

  return (
    <Card
      interactive
      className={cn(
        'group relative flex h-full flex-col overflow-hidden',
        variant === 'featured' && 'lg:flex-row',
        className,
      )}
    >
      {article.featured_image ? (
        <img
          src={article.featured_image}
          alt=""
          loading="lazy"
          decoding="async"
          width={640}
          height={360}
          className={cn(
            'w-full object-cover',
            variant === 'featured' ? 'aspect-video lg:aspect-auto lg:w-1/2' : 'aspect-video',
          )}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center bg-gradient-to-br from-ink-50 via-white to-brand-50',
            variant === 'featured' ? 'aspect-video lg:aspect-auto lg:w-1/2' : 'aspect-video w-full',
          )}
        >
          <CategoryIcon
            name={article.category?.slug ?? 'book-open'}
            className="h-9 w-9 text-brand-600/70"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {article.category && <Badge tone="brand">{article.category.name}</Badge>}
          {article.is_featured && <Badge tone="warning">Featured</Badge>}
        </div>

        <h3
          className={cn(
            'font-bold leading-snug text-ink-900',
            variant === 'featured' ? 'text-xl' : 'text-base',
          )}
        >
          <Link to={href} className="transition after:absolute after:inset-0 group-hover:text-brand-700">
            {article.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-600">{article.excerpt}</p>

        <div className="mt-auto flex items-center gap-3 pt-5 text-xs text-ink-500">
          {article.author && (
            <span className="flex items-center gap-2">
              <Avatar name={article.author.name} src={article.author.profile_image} size="sm" />
              <span className="font-medium text-ink-700">{article.author.name}</span>
            </span>
          )}
          {article.published_at && (
            <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {article.reading_minutes} min
          </span>
        </div>
      </div>
    </Card>
  )
}
