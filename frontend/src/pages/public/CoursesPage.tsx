import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'

import { CourseCard } from '@/components/cards/CourseCard'
import { FilterPanel, type FilterDefinition } from '@/components/forms/FilterPanel'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBar } from '@/components/layout/SearchBar'
import { ButtonLink } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Container, Section } from '@/components/ui/primitives'
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/ui/states'
import { getCourseCategories, getCourses } from '@/api/endpoints'
import { useSeo } from '@/hooks/useSeo'
import { queryKeys } from '@/lib/queryClient'
import { pluralize } from '@/lib/format'

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'title', label: 'Title A-Z' },
]

const LEVEL_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const DURATION_OPTIONS = [
  { value: '', label: 'Any duration' },
  { value: '120', label: 'Under 2 hours' },
  { value: '360', label: 'Under 6 hours' },
  { value: '600', label: 'Under 10 hours' },
]

const PRICE_OPTIONS = [
  { value: '', label: 'Any price' },
  { value: 'free', label: 'Free only' },
]

const RATING_OPTIONS = [
  { value: '', label: 'Any rating' },
  { value: '4', label: '4.0 and above' },
  { value: '4.5', label: '4.5 and above' },
]

export default function CoursesPage() {
  const [params, setParams] = useSearchParams()

  const page = Number(params.get('page') ?? '1')
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const level = params.get('level') ?? ''
  const duration = params.get('duration') ?? ''
  const price = params.get('price') ?? ''
  const rating = params.get('rating') ?? ''
  const sort = params.get('sort') ?? 'popular'

  useSeo({
    title: 'Online technology courses',
    description:
      'Browse structured, self-paced courses across cloud computing, AI, machine learning, data science, DevOps and digital marketing.',
    // Filtered permutations are not separately indexable.
    robots: params.toString() ? 'noindex,follow' : 'index,follow',
  })

  const { data: categories } = useQuery({
    queryKey: queryKeys.courseCategories,
    queryFn: getCourseCategories,
    staleTime: 10 * 60_000,
  })

  const filters = useMemo(
    () => ({
      page,
      page_size: 12,
      q: q || undefined,
      category: category || undefined,
      level: level || undefined,
      max_duration_minutes: duration ? Number(duration) : undefined,
      free_only: price === 'free' ? true : undefined,
      min_rating: rating ? Number(rating) : undefined,
      sort,
    }),
    [page, q, category, level, duration, price, rating, sort],
  )

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.courses(filters),
    queryFn: () => getCourses(filters),
    placeholderData: keepPreviousData,
  })

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // Any filter change returns to the first page.
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  function reset() {
    setParams(new URLSearchParams())
  }

  const activeCount = [category, level, duration, price, rating].filter(Boolean).length

  const filterDefinitions: FilterDefinition[] = [
    {
      id: 'filter-category',
      label: 'Category',
      value: category,
      options: [
        { value: '', label: 'All categories' },
        ...(categories ?? []).map((item) => ({ value: item.slug, label: item.name })),
      ],
      onChange: (value) => update('category', value),
    },
    {
      id: 'filter-level',
      label: 'Level',
      value: level,
      options: LEVEL_OPTIONS,
      onChange: (value) => update('level', value),
    },
    {
      id: 'filter-duration',
      label: 'Duration',
      value: duration,
      options: DURATION_OPTIONS,
      onChange: (value) => update('duration', value),
    },
    {
      id: 'filter-price',
      label: 'Price',
      value: price,
      options: PRICE_OPTIONS,
      onChange: (value) => update('price', value),
    },
    {
      id: 'filter-rating',
      label: 'Rating',
      value: rating,
      options: RATING_OPTIONS,
      onChange: (value) => update('rating', value),
    },
  ]

  return (
    <>
      <PageHeader
        title="Online technology courses"
        description="Structured, self-paced courses that build the fundamentals first and finish with something you have actually built."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Courses', url: '/courses' },
        ]}
      >
        <div className="mt-8 max-w-2xl">
          <SearchBar
            defaultValue={q}
            placeholder="Search courses"
            onSubmitQuery={(value) => update('q', value)}
          />
        </div>
      </PageHeader>

      <Section className="py-12">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <FilterPanel
              filters={filterDefinitions}
              activeCount={activeCount}
              onReset={reset}
              className="lg:sticky lg:top-24 lg:self-start"
            />

            <div className="min-w-0">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-600" aria-live="polite">
                  {isLoading
                    ? 'Loading courses...'
                    : `${pluralize(data?.total ?? 0, 'course')} found`}
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
                  <div
                    className={`grid gap-6 sm:grid-cols-2 xl:grid-cols-3 ${isFetching ? 'opacity-60 transition-opacity' : ''}`}
                  >
                    {data.items.map((course) => (
                      <CourseCard key={course.id} course={course} />
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
                  icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
                  title="No courses found"
                  description="Try removing a filter or searching for something broader."
                  action={
                    <ButtonLink to="/courses" variant="outline" onClick={reset}>
                      Clear filters
                    </ButtonLink>
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
