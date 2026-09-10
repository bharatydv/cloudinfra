import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award } from 'lucide-react'

import { CertificationCard } from '@/components/cards/CertificationCard'
import { ProviderCard } from '@/components/cards/misc'
import { FilterPanel, type FilterDefinition } from '@/components/forms/FilterPanel'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBar } from '@/components/layout/SearchBar'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Container, Section, SectionHeading } from '@/components/ui/primitives'
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/ui/states'
import {
  getCertificationCategories,
  getCertifications,
  getProviders,
  saveCertification,
  unsaveCertification,
} from '@/api/endpoints'
import { siteConfig } from '@/config/brand'
import { useAuth } from '@/hooks/useAuth'
import { useSeo } from '@/hooks/useSeo'
import { useToast } from '@/hooks/useToast'
import { pluralize } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import type { CertificationCard as CertificationCardType } from '@/types/api'

const LEVEL_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'foundational', label: 'Foundational' },
  { value: 'associate', label: 'Associate' },
  { value: 'professional', label: 'Professional' },
  { value: 'specialty', label: 'Specialty' },
  { value: 'expert', label: 'Expert' },
]

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'level', label: 'Level' },
  { value: 'newest', label: 'Recently added' },
]

export default function CertificationsPage() {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const toast = useToast()

  const page = Number(params.get('page') ?? '1')
  const q = params.get('q') ?? ''
  const provider = params.get('provider') ?? ''
  const level = params.get('level') ?? ''
  const category = params.get('category') ?? ''
  const sort = params.get('sort') ?? 'featured'

  useSeo({
    title: 'Professional certifications',
    description:
      'Explore certification preparation resources, learning paths and courses designed to help you build the skills you need.',
    robots: params.toString() ? 'noindex,follow' : 'index,follow',
  })

  const { data: providers } = useQuery({
    queryKey: queryKeys.providers,
    queryFn: getProviders,
    staleTime: 10 * 60_000,
  })
  const { data: categories } = useQuery({
    queryKey: queryKeys.certificationCategories,
    queryFn: getCertificationCategories,
    staleTime: 10 * 60_000,
  })

  const filters = useMemo(
    () => ({
      page,
      page_size: 12,
      q: q || undefined,
      provider: provider || undefined,
      level: level || undefined,
      category: category || undefined,
      sort,
    }),
    [page, q, provider, level, category, sort],
  )

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.certifications(filters),
    queryFn: () => getCertifications(filters),
    placeholderData: keepPreviousData,
  })

  const toggleSave = useMutation({
    mutationFn: (certification: CertificationCardType) =>
      certification.is_saved
        ? unsaveCertification(certification.id)
        : saveCertification(certification.id),
    onSuccess: (_result, certification) => {
      toast.success(certification.is_saved ? 'Removed from saved.' : 'Saved to your dashboard.')
      void queryClient.invalidateQueries({ queryKey: ['certifications'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedCertifications })
    },
    onError: () => toast.error('We could not update your saved list.'),
  })

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  const activeCount = [provider, level, category].filter(Boolean).length

  const filterDefinitions: FilterDefinition[] = [
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
      label: 'Difficulty',
      value: level,
      options: LEVEL_OPTIONS,
      onChange: (value) => update('level', value),
    },
    {
      id: 'filter-category',
      label: 'Category',
      value: category,
      options: [
        { value: '', label: 'All categories' },
        ...(categories ?? []).map((item) => ({ value: item, label: item })),
      ],
      onChange: (value) => update('category', value),
    },
  ]

  return (
    <>
      <PageHeader
        title="Professional Certifications"
        description="Explore certification preparation resources, learning paths and courses designed to help you build the skills you need."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Certifications', url: '/certifications' },
        ]}
      >
        <div className="mt-8 max-w-2xl">
          <SearchBar
            defaultValue={q}
            placeholder="Search by name or exam code"
            onSubmitQuery={(value) => update('q', value)}
          />
        </div>
        <p className="mt-6 max-w-3xl rounded-lg border border-ink-200 bg-white p-3.5 text-xs leading-relaxed text-ink-500">
          {siteConfig.independenceNotice}
        </p>
      </PageHeader>

      {(providers?.length ?? 0) > 0 && (
        <Section className="py-12">
          <Container>
            <SectionHeading
              eyebrow="Providers"
              title="Browse by certification provider"
              description="Each provider page groups the certifications we publish preparation material for."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {providers?.map((item) => (
                <ProviderCard key={item.id} provider={item} />
              ))}
            </div>
          </Container>
        </Section>
      )}

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
                  {isLoading
                    ? 'Loading certifications...'
                    : `${pluralize(data?.total ?? 0, 'certification')} found`}
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
                    {data.items.map((certification) => (
                      <CertificationCard
                        key={certification.id}
                        certification={certification}
                        onToggleSave={
                          isAuthenticated ? (item) => toggleSave.mutate(item) : undefined
                        }
                        saving={toggleSave.isPending}
                      />
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
                  icon={<Award className="h-6 w-6" aria-hidden="true" />}
                  title="No certifications found"
                  description="Try a different provider, level or search term."
                  action={
                    <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>
                      Clear filters
                    </Button>
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
