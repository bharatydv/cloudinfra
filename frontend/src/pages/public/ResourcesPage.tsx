import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'

import { ArticleCard } from '@/components/cards/ArticleCard'
import { CategoryIcon } from '@/components/cards/CategoryIcon'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBar } from '@/components/layout/SearchBar'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Badge, Card, Container, Section, SectionHeading } from '@/components/ui/primitives'
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/ui/states'
import {
  getArticleCategories,
  getArticles,
  getFeaturedArticles,
  getPopularArticles,
  getTags,
} from '@/api/endpoints'
import { useSeo } from '@/hooks/useSeo'
import { pluralize } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import { cn } from '@/lib/cn'

export default function ResourcesPage() {
  const [params, setParams] = useSearchParams()

  const page = Number(params.get('page') ?? '1')
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const tag = params.get('tag') ?? ''
  const sort = params.get('sort') ?? 'latest'

  useSeo({
    title: 'Learning resources, guides and roadmaps',
    description:
      'Guides, roadmaps and exam preparation resources for technology certifications and careers.',
    robots: params.toString() ? 'noindex,follow' : 'index,follow',
  })

  const { data: categories } = useQuery({
    queryKey: queryKeys.articleCategories,
    queryFn: getArticleCategories,
    staleTime: 10 * 60_000,
  })
  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
    staleTime: 10 * 60_000,
  })
  const { data: featured } = useQuery({
    queryKey: queryKeys.featuredArticles,
    queryFn: () => getFeaturedArticles(2),
  })
  const { data: popular } = useQuery({
    queryKey: queryKeys.popularArticles,
    queryFn: () => getPopularArticles(5),
  })

  const filters = useMemo(
    () => ({
      page,
      page_size: 9,
      q: q || undefined,
      category: category || undefined,
      tag: tag || undefined,
      sort,
    }),
    [page, q, category, tag, sort],
  )

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.articles(filters),
    queryFn: () => getArticles(filters),
    placeholderData: keepPreviousData,
  })

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  const showFeatured = !q && !category && !tag && page === 1

  return (
    <>
      <PageHeader
        title="Learning resources"
        description="Guides, roadmaps and exam preparation material written against current vendor documentation."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
        ]}
      >
        <div className="mt-8 max-w-2xl">
          <SearchBar
            defaultValue={q}
            placeholder="Search guides and roadmaps"
            onSubmitQuery={(value) => update('q', value)}
          />
        </div>
      </PageHeader>

      {/* Category navigation doubles as internal linking for search. */}
      {(categories?.length ?? 0) > 0 && (
        <Section className="py-10">
          <Container>
            <h2 className="sr-only">Resource categories</h2>
            <ul className="scroll-x flex gap-3 pb-2">
              <li className="shrink-0">
                <button
                  type="button"
                  onClick={() => update('category', '')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition',
                    !category
                      ? 'border-brand-200 bg-brand-50 text-brand-700'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                  )}
                >
                  All resources
                </button>
              </li>
              {categories?.map((item) => (
                <li key={item.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => update('category', item.slug)}
                    aria-pressed={category === item.slug}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition',
                      category === item.slug
                        ? 'border-brand-200 bg-brand-50 text-brand-700'
                        : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                    )}
                  >
                    <CategoryIcon name={item.icon ?? item.slug} className="h-4 w-4" />
                    {item.name}
                    <span className="text-xs text-ink-400">{item.article_count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      {showFeatured && (featured?.length ?? 0) > 0 && (
        <Section className="pt-0">
          <Container>
            <SectionHeading eyebrow="Featured" title="Start here" />
            <div className="grid gap-6">
              {featured?.map((article) => (
                <ArticleCard key={article.id} article={article} variant="featured" />
              ))}
            </div>
          </Container>
        </Section>
      )}

      <Section tone="muted" className="py-14">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
            <div className="min-w-0">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-600" aria-live="polite">
                  {isLoading ? 'Loading resources...' : `${pluralize(data?.total ?? 0, 'resource')}`}
                </p>
                <label className="flex items-center gap-2 text-sm text-ink-600">
                  <span>Sort by</span>
                  <select
                    value={sort}
                    onChange={(event) => update('sort', event.target.value)}
                    className="h-10 rounded-lg border border-ink-300 bg-white px-3 text-sm font-medium text-ink-800 shadow-subtle"
                  >
                    <option value="latest">Latest</option>
                    <option value="popular">Most read</option>
                    <option value="oldest">Oldest</option>
                    <option value="title">Title A-Z</option>
                  </select>
                </label>
              </div>

              {isError ? (
                <ErrorState onRetry={() => void refetch()} />
              ) : isLoading ? (
                <CardGridSkeleton count={6} />
              ) : data && data.items.length > 0 ? (
                <>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {data.items.map((article) => (
                      <ArticleCard key={article.id} article={article} />
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
                  icon={<FileText className="h-6 w-6" aria-hidden="true" />}
                  title="No resources found"
                  description="Try a different category or a broader search term."
                  action={
                    <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>
                      Clear filters
                    </Button>
                  }
                />
              )}
            </div>

            <aside className="space-y-6">
              {(popular?.length ?? 0) > 0 && (
                <Card className="p-5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                    Most read
                  </h2>
                  <div className="mt-2">
                    {popular?.map((article) => (
                      <ArticleCard key={article.id} article={article} variant="compact" />
                    ))}
                  </div>
                </Card>
              )}

              {(tags?.length ?? 0) > 0 && (
                <Card className="p-5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Tags</h2>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {tags?.slice(0, 18).map((item) => (
                      <li key={item.id}>
                        <Link to={`/resources?tag=${item.slug}`}>
                          <Badge tone={tag === item.slug ? 'brand' : 'outline'}>{item.name}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </aside>
          </div>
        </Container>
      </Section>
    </>
  )
}
