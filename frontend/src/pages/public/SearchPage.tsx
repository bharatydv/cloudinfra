import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Award, BookOpen, FileText, Search as SearchIcon, Target } from 'lucide-react'

import { LastVerified, PriceRow } from '@/components/cards/PriceParts'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBar } from '@/components/layout/SearchBar'
import { Badge, Card, Container, Section } from '@/components/ui/primitives'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { search } from '@/api/endpoints'
import { useSeo } from '@/hooks/useSeo'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { pluralize } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/cn'
import type { SearchEntity } from '@/types/api'

/** Reads a string off a result's untyped metadata bag. */
function text(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value ? value : null
}

/** Reads a number off a result's untyped metadata bag. */
function count(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const TYPE_META: Record<SearchEntity, { label: string; icon: typeof BookOpen; tone: string }> = {
  course: { label: 'Course', icon: BookOpen, tone: 'brand' },
  certification: { label: 'Certification', icon: Award, tone: 'success' },
  article: { label: 'Resource', icon: FileText, tone: 'neutral' },
  resource: { label: 'Study resource', icon: Target, tone: 'warning' },
}

const FILTERS: Array<{ value: SearchEntity | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'course', label: 'Courses' },
  { value: 'certification', label: 'Certifications' },
  { value: 'article', label: 'Resources' },
  { value: 'resource', label: 'Study resources' },
]

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [type, setType] = useState<SearchEntity | 'all'>('all')

  // Search result pages carry no unique indexable value.
  useSeo({
    title: query ? `Search results for "${query}"` : 'Search',
    description:
      'Search certifications, exam codes, courses and learning resources, with the current price of each.',
    robots: NOINDEX,
  })

  const types = type === 'all' ? [] : [type]

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.search(query, types),
    queryFn: () => search(query, types.length ? types : undefined, 30),
    enabled: query.trim().length > 0,
  })

  useEffect(() => {
    if (query.trim()) {
      track(AnalyticsEvent.SearchPerformed, { properties: { query } })
    }
  }, [query])

  return (
    <>
      <PageHeader
        title="Search"
        description="Find a certification by name or exam code, a course, or a study resource -- each result shows what it costs today."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Search', url: '/search' },
        ]}
      >
        <div className="mt-8 max-w-2xl">
          <SearchBar
            defaultValue={query}
            size="lg"
            autoFocus
            placeholder="Search certifications, exam codes or courses..."
            onSubmitQuery={(value) => setParams({ q: value })}
          />
        </div>
      </PageHeader>

      <Section className="py-12">
        <Container>
          {!query.trim() ? (
            <EmptyState
              icon={<SearchIcon className="h-6 w-6" aria-hidden="true" />}
              title="Start typing to search"
              description="Search across courses, certifications, guides and study resources."
            />
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <p className="text-sm text-ink-600" aria-live="polite">
                  {isLoading
                    ? 'Searching...'
                    : `${pluralize(data?.total ?? 0, 'result')} for "${query}"`}
                </p>
                <ul className="ml-auto flex flex-wrap gap-2">
                  {FILTERS.map((filter) => {
                    const count =
                      filter.value === 'all'
                        ? (data?.total ?? 0)
                        : (data?.counts[filter.value] ?? 0)
                    return (
                      <li key={filter.value}>
                        <button
                          type="button"
                          onClick={() => setType(filter.value)}
                          aria-pressed={type === filter.value}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                            type === filter.value
                              ? 'border-brand-200 bg-brand-50 text-brand-700'
                              : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                          )}
                        >
                          {filter.label}
                          {data && filter.value !== 'all' && (
                            <span className="ml-1.5 text-xs text-ink-400">{count}</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {isError ? (
                <ErrorState onRetry={() => void refetch()} />
              ) : isLoading ? (
                <ListSkeleton rows={6} />
              ) : (data?.results.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<SearchIcon className="h-6 w-6" aria-hidden="true" />}
                  title="No results found"
                  description={`Nothing matched "${query}". Try a broader term or check the spelling.`}
                />
              ) : (
                <ul className="space-y-3">
                  {data?.results.map((result) => {
                    const meta = TYPE_META[result.type]
                    const Icon = meta.icon
                    return (
                      <li key={`${result.type}-${result.id}`}>
                        <Card interactive className="group relative p-5">
                          <div className="flex items-start gap-4">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
                              <Icon className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                <Badge tone="brand">{meta.label}</Badge>
                                {result.category && (
                                  <span className="text-xs text-ink-500">{result.category}</span>
                                )}
                              </div>
                              <h2 className="text-base font-bold text-ink-900">
                                <Link
                                  to={result.url}
                                  className="after:absolute after:inset-0 group-hover:text-brand-700"
                                >
                                  {result.title}
                                </Link>
                              </h2>
                              <p className="mt-1.5 line-clamp-2 text-sm text-ink-600">
                                {result.description}
                              </p>
                              <ResultPrice metadata={result.metadata} />
                            </div>
                          </div>
                        </Card>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </Container>
      </Section>
    </>
  )
}

/**
 * The price line under a search result.
 *
 * Only courses and priced certifications send these fields, so an article or
 * an unpriced exam renders nothing rather than an empty row.
 */
function ResultPrice({ metadata }: { metadata: Record<string, unknown> }) {
  const price = text(metadata, 'price')
  const examCode = text(metadata, 'exam_code')
  const verified = text(metadata, 'last_verified_on')
  if (!price && !examCode) return null

  return (
    <div className="mt-3 space-y-1.5">
      {examCode && (
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Exam {examCode}
        </p>
      )}
      {price && (
        <PriceRow
          price={price}
          compareAtPrice={text(metadata, 'compare_at_price')}
          savings={text(metadata, 'savings_amount')}
          discountPercentage={count(metadata, 'discount_percentage')}
          currency={text(metadata, 'currency') ?? 'USD'}
          size="sm"
        />
      )}
      <LastVerified date={verified} />
    </div>
  )
}
