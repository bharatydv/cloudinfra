import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Tag, Trophy } from 'lucide-react'

import { DealCard } from '@/components/cards/DealCard'
import { ChallengeStartModal } from '@/components/challenge/ChallengeStartForm'
import { FilterPanel, type FilterDefinition } from '@/components/forms/FilterPanel'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Container, Section, SectionHeading } from '@/components/ui/primitives'
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/ui/states'
import { getChallengeIntro, getDeals, getProviders } from '@/api/endpoints'
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
 * Unified Deals and Test Qualification Page.
 *
 * Displays active certification offers and embeds the skill test qualification engine.
 * Passing the skill qualification test earns an instant 65% discount code on the exam.
 */
export default function DealsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // The popup is open whenever this is set; the certification inside is
  // optional, since the teaser button starts without picking a deal.
  const [testFor, setTestFor] = useState<{ certificationId?: string } | null>(null)

  const page = Number(params.get('page') ?? '1')
  const kind = params.get('kind') ?? ''
  const provider = params.get('provider') ?? ''
  const level = params.get('level') ?? ''
  const minDiscount = params.get('min_discount') ?? ''
  const sort = params.get('sort') ?? 'discount'

  useSeo({
    title: 'Certification Deals & Qualification Test',
    description:
      'Compare active certification exam deals and take the skill qualification test to unlock up to 65% discount vouchers.',
    robots: params.toString() ? 'noindex,follow' : 'index,follow',
  })

  const { data: providers } = useQuery({
    queryKey: queryKeys.providers,
    queryFn: getProviders,
    staleTime: 10 * 60_000,
  })

  // The provider filter only offers providers with a live deal: the catalogue
  // is small, so one unfiltered page covers it.
  const allDealsFilters = { page: 1, page_size: 60 }
  const { data: allDeals } = useQuery({
    queryKey: queryKeys.deals(allDealsFilters),
    queryFn: () => getDeals(allDealsFilters),
    staleTime: 10 * 60_000,
  })
  const providersWithDeals = useMemo(
    () => new Set((allDeals?.items ?? []).map((deal) => deal.provider_slug).filter(Boolean)),
    [allDeals],
  )

  // Which certifications the challenge campaign actually covers, so the
  // "Take Test to Qualify" CTA only appears on deals it can honour.
  const { data: challengeIntro } = useQuery({
    queryKey: queryKeys.challengeIntro,
    queryFn: getChallengeIntro,
    staleTime: 10 * 60_000,
  })
  const campaignCertIds = useMemo(
    () => new Set((challengeIntro?.options ?? []).map((option) => option.id)),
    [challengeIntro],
  )

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

  function handleQualifyForDeal(dealId: string) {
    setTestFor({ certificationId: dealId })
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
        ...(providers ?? [])
          .filter((item) => providersWithDeals.has(item.slug))
          .map((item) => ({ value: item.slug, label: item.name })),
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
      {/* Test Qualification teaser -- the test itself runs on its own page */}
      <div className="border-b border-ink-200 bg-white py-12">
        <Container className="max-w-5xl">
          <SectionHeading
            eyebrow="Test Qualification"
            title="Skill Qualification Engine"
            description="Take the short proctored test on your target certification. Pass with 70%+ score to instantly earn your personalized 65% discount code!"
            align="center"
          />
        </Container>
      </div>

      {/* Rules and details in a popup; the paper itself opens on its own page
          so the proctoring has a clean window to watch. */}
      <ChallengeStartModal
        open={testFor !== null}
        certificationId={testFor?.certificationId}
        onClose={() => setTestFor(null)}
        onStarted={(session) => navigate('/challenge', { state: { session } })}
      />

      {/* Active Certification Deals Grid, below the qualification test */}
      <Section tone="muted" className="py-12">
        <Container>
          <SectionHeading
            eyebrow="Active Offers"
            title="Certification Deals Available Right Now"
            description="Select an exam deal below and complete the 10-minute skill test qualification to claim your 65% discount code."
          />

          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <FilterPanel
              filters={filterDefinitions}
              activeCount={activeCount}
              onReset={() => setParams(new URLSearchParams())}
              className="lg:sticky lg:top-24 lg:self-start"
            />

            <div className="min-w-0">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-ink-700" aria-live="polite">
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
                    {data.items.map((deal) => {
                      const isCampaignEligible =
                        Boolean(challengeIntro?.terms.enabled) &&
                        deal.kind === 'certification' &&
                        campaignCertIds.has(deal.id)
                      return (
                        <div key={`${deal.kind}-${deal.id}`} className="flex flex-col">
                          <DealCard
                            deal={deal}
                            onQualify={
                              isCampaignEligible ? () => handleQualifyForDeal(deal.id) : undefined
                            }
                          />
                          {isCampaignEligible && (
                            <Button
                              variant="primary"
                              className="mt-3 w-full justify-center bg-brand-600 font-semibold shadow-sm hover:bg-brand-700"
                              onClick={() => handleQualifyForDeal(deal.id)}
                            >
                              <Trophy className="mr-2 h-4 w-4" aria-hidden="true" />
                              Take Test to Qualify ({deal.discount_percentage}% Off)
                            </Button>
                          )}
                        </div>
                      )
                    })}
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
                  description="We list a discount only once the price behind it has been checked."
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
