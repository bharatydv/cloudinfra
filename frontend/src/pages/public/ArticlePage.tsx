import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Check, Clock, Link2, List, Share2 } from 'lucide-react'

import { ArticleCard } from '@/components/cards/ArticleCard'
import { CertificationCard } from '@/components/cards/CertificationCard'
import { CourseCard } from '@/components/cards/CourseCard'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { CTASection } from '@/components/marketing/sections'
import { Accordion } from '@/components/ui/Accordion'
import { Avatar, Badge, Card, Container, Section, SectionHeading } from '@/components/ui/primitives'
import { DetailSkeleton, ErrorState } from '@/components/ui/states'
import { getArticle } from '@/api/endpoints'
import { useServerSeo } from '@/hooks/useSeo'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { formatDate } from '@/lib/format'
import { Markdown } from '@/lib/markdown'
import { queryKeys } from '@/lib/queryClient'

export default function ArticlePage() {
  const { slug = '' } = useParams()
  const [copied, setCopied] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.article(slug),
    queryFn: () => getArticle(slug),
    enabled: Boolean(slug),
  })

  useServerSeo(data?.seo, data?.title ?? 'Resource')

  useEffect(() => {
    if (data) {
      track(AnalyticsEvent.ArticleViewed, { entityType: 'article', entityId: data.id })
    }
  }, [data])

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: data?.title, url })
        return
      } catch {
        /* User dismissed the share sheet. */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Clipboard unavailable. */
    }
  }

  if (isLoading) {
    return (
      <Container className="py-14">
        <DetailSkeleton />
      </Container>
    )
  }

  if (isError || !data) {
    return (
      <Container className="py-14">
        <ErrorState
          title="Resource not found"
          description="This article may have been unpublished or moved."
          onRetry={() => void refetch()}
        />
      </Container>
    )
  }

  return (
    <>
      <article>
        <header className="border-b border-ink-200 bg-ink-50">
          <Container className="max-w-4xl py-10 sm:py-14">
            <Breadcrumbs items={data.seo?.breadcrumbs ?? []} className="mb-6" />

            {data.category && (
              <Badge tone="brand" className="mb-4">
                {data.category.name}
              </Badge>
            )}

            <h1 className="text-heading-lg text-ink-900 sm:text-4xl">{data.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-600">{data.excerpt}</p>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-ink-500">
              {data.author && (
                <span className="flex items-center gap-2.5">
                  <Avatar name={data.author.name} src={data.author.profile_image} size="sm" />
                  <span className="font-medium text-ink-800">{data.author.name}</span>
                </span>
              )}
              {data.published_at && (
                <span>
                  Published{' '}
                  <time dateTime={data.published_at}>{formatDate(data.published_at)}</time>
                </span>
              )}
              {data.updated_at && data.updated_at !== data.published_at && (
                <span>
                  Updated <time dateTime={data.updated_at}>{formatDate(data.updated_at)}</time>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {data.reading_minutes} min read
              </span>
              <button
                type="button"
                onClick={share}
                className="ml-auto inline-flex items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-ink-400"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Link copied
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Share
                  </>
                )}
              </button>
            </div>
          </Container>
        </header>

        {data.featured_image && (
          <Container className="max-w-4xl">
            <img
              src={data.featured_image}
              alt=""
              loading="eager"
              decoding="async"
              width={1200}
              height={630}
              className="mt-8 aspect-[1200/630] w-full rounded-xl object-cover"
            />
          </Container>
        )}

        <Section className="py-12">
          <Container>
            <div className="grid gap-12 lg:grid-cols-[minmax(0,46rem)_1fr]">
              <div className="min-w-0">
                <Markdown content={data.content} />

                {data.tags.length > 0 && (
                  <div className="mt-10 flex flex-wrap gap-2 border-t border-ink-200 pt-6">
                    <span className="text-sm font-semibold text-ink-700">Tags:</span>
                    {data.tags.map((tag) => (
                      <Badge key={tag.id} tone="outline">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {data.faq.length > 0 && (
                  <section className="mt-12" aria-labelledby="article-faq">
                    <h2 id="article-faq" className="text-heading text-ink-900">
                      Frequently asked questions
                    </h2>
                    <Accordion items={data.faq} className="mt-5" />
                  </section>
                )}
              </div>

              <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                {data.table_of_contents.length > 0 && (
                  <Card className="p-5">
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                      <List className="h-4 w-4" aria-hidden="true" />
                      Contents
                    </h2>
                    <nav aria-label="Table of contents" className="mt-4">
                      <ul className="space-y-1.5 text-sm">
                        {data.table_of_contents.map((entry) => (
                          <li key={entry.anchor} className={entry.level === 3 ? 'pl-4' : ''}>
                            <a
                              href={`#${entry.anchor}`}
                              className="block rounded px-2 py-1 text-ink-600 transition hover:bg-ink-50 hover:text-brand-700"
                            >
                              {entry.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  </Card>
                )}

                {data.related_articles.length > 0 && (
                  <Card className="p-5">
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                      <Link2 className="h-4 w-4" aria-hidden="true" />
                      Related resources
                    </h2>
                    <div className="mt-2">
                      {data.related_articles.map((article) => (
                        <ArticleCard key={article.id} article={article} variant="compact" />
                      ))}
                    </div>
                  </Card>
                )}
              </aside>
            </div>
          </Container>
        </Section>
      </article>

      {data.related_courses.length > 0 && (
        <Section tone="muted" className="py-14">
          <Container>
            <SectionHeading title="Courses on this topic" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.related_courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </Container>
        </Section>
      )}

      {data.related_certifications.length > 0 && (
        <Section className="py-14">
          <Container>
            <SectionHeading title="Related certifications" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.related_certifications.map((certification) => (
                <CertificationCard key={certification.id} certification={certification} />
              ))}
            </div>
          </Container>
        </Section>
      )}

      <CTASection />
    </>
  )
}
