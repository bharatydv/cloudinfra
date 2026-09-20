import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Tag } from 'lucide-react'

import { DealCard } from '@/components/cards/DealCard'
import { FilterPanel, type FilterDefinition } from '@/components/forms/FilterPanel'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBar } from '@/components/layout/SearchBar'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Container, Section } from '@/components/ui/primitives'
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/ui/states'
import { getDeals, getProviders } from '@/api/endpoints'
import { siteConfig } from '@/config/brand'
import { useSeo } from '@/hooks/useSeo'
import { pluralize } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'

const KIND_OPTIONS = [
  { value: '', label: 'Certifications and courses' },
  { value: 'certification', label: 'Certification exams' },
  { value: 'course', label: 'Courses' },
]

const LEVEL_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'foundational', label: 'Foundational' },
  { value: 'associate', label: 'Associate' },
  { value: 'professional', label: 'Professional' },
  { value: 'specialty', label: 'Specialty' },
  { value: 'expert', label: 'Expert' },
]

const DISCOUNT_OPTIONS = [
  { value: '', label: 'Any discount' },
  { value: '10', label: '10% or more' },
  { value: '25', label: '25% or more' },
  { value: '50', label: '50% or more' },
  { value: '70', label: '70% or more' },
]

const SORT_OPTIONS = [
  { value: 'discount', label: 'Highest discount' },
  { value: 'savings', label: 'Biggest saving' },
  { value: 'price', label: 'Lowest price' },
  { value: 'newest', label: 'Newest' },
]

/**
 * Everything currently discounted, in one place.
 *
 * The listing is assembled entirely from prices an operator has entered: an
 * exam with no quoted vendor fee and a course with no recorded list price are
 * absent rather than padded in at a notional saving, which is why an empty
 * result here says "no offers" rather than "no matches".
 */
export default function DealsPage() {
  const [params, setParams] = useSearchParams()

  const page = Number(params.get('page') ?? '1')
  const kind = params.get('kind') ?? ''
  const provider = params.get('provider') ?? ''
  const level = params.get('level') ?? ''
  const minDiscount = params.get('min_discount') ?? ''
  const sort = params.get('sort') ?? 'discount'

  useSeo({
    title: 'Certification and course deals',
    description:
      'Current discounts on cloud certification exams and courses, ranked by how much they save, each with the date the price was last verified.',
    // A filtered view is a slice of the same offers, so only the bare listing
    // is worth indexing.
    robots: params.toString() ? 'noindex,follow' : 'index,follow',
  })

  const { data: providers } = useQuery({
    queryKey: queryKeys.providers,
    queryFn: getProviders,
    staleTime: 10 * 60_000,
  })

  const filters = useMemo(
    () => ({
      page,
      page_size: 12,
      kind: kind || undefined,
      provider: provider || undefined,
      level: level || undefined,
      min_discount: minDiscount ? Number(minDiscount) : undefined,
      sort,
    }),
    [page, kind, provider, level, minDiscount, sort],
  )

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.deals(filters),
    queryFn: () => getDeals(filters),
    placeholderData: keepPreviousData,
  })

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  const activeCount = [kind, provider, level, minDiscount].filter(Boolean).length

  const filterDefinitions: FilterDefinition[] = [
    {
      id: 'filter-kind',
      label: 'Product type',
      value: kind,
      options: KIND_OPTIONS,
      onChange: (value) => update('kind', value),
    },
    {
      id: 'filter-provider',
      label: 'Provider',
      value: provider,
      options: [
        { value: '', label: 'All providers' },
        ...(providers ?? []).map((item) => ({ value: item.slug, label: item.name })),
      ],
      onChange: (value) => update('provider', value),
    },
    {
      id: 'filter-level',
      label: 'Level',
      value: level,
      options: LEVEL_OPTIONS,
      onChange: (value) => update('level', value),
    },
    {
      id: 'filter-discount',
      label: 'Discount',
      value: minDiscount,
      options: DISCOUNT_OPTIONS,
      onChange: (value) => update('min_discount', value),
    },
  ]

  return (
    <>
      <PageHeader
        title="Certification and course deals"
        description="Every certification exam and course we currently list at a reduced price, deepest discount first. Each offer shows what it normally costs, what it costs now and when the price was last verified."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Deals', url: '/deals' },
        ]}
      >
        <div className="mt-8 max-w-2xl">
          <SearchBar placeholder="Search certifications, exam codes or courses" />
        </div>
        <p className="mt-6 max-w-3xl rounded-lg border border-ink-200 bg-white p-3.5 text-xs leading-relaxed text-ink-500">
          {siteConfig.independenceNotice}
        </p>
      </PageHeader>

      <Section tone="muted" className="py-12">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <FilterPanel
              filters={filterDefinitions}
              activeCount={activeCount}
              onReset={() => setParams(new URLSearchParams())}
              className="lg:sticky lg:top-24 lg:self-start"
            />

            <div className="min-w-0">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-600" aria-live="polite">
                  {isLoading ? 'Loading offers...' : `${pluralize(data?.total ?? 0, 'offer')} available`}
                </p>
                <label className="flex items-center gap-2 text-sm text-ink-600">
                  <span className="shrink-0">Sort by</span>
                  <select
                    value={sort}
                    onChange={(event) => update('sort', event.target.value)}
                    className="h-10 rounded-lg border border-ink-300 bg-white px-3 text-sm font-medium text-ink-800 shadow-subtle"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {isError ? (
                <ErrorState onRetry={() => void refetch()} />
              ) : isLoading ? (
                <CardGridSkeleton />
              ) : data && data.items.length > 0 ? (
                <>
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {data.items.map((deal) => (
                      <DealCard key={`${deal.kind}-${deal.id}`} deal={deal} />
                    ))}
                  </div>
                  <Pagination
                    page={data.page}
                    totalPages={data.total_pages}
                    onChange={(next) => update('page', String(next))}
                    className="mt-10"
                  />
                </>
              ) : (
                <EmptyState
                  icon={<Tag className="h-6 w-6" aria-hidden="true" />}
                  title={activeCount > 0 ? 'No offers match these filters' : 'No offers right now'}
                  description={
                    activeCount > 0
                      ? 'Try a smaller discount threshold, or a different provider.'
                      : 'We list a discount only once the price behind it has been checked. Browse the full certification catalogue in the meantime.'
                  }
                  action={
                    activeCount > 0 ? (
                      <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
