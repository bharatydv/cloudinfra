import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ExternalLink } from 'lucide-react'

import { CertificationCard } from '@/components/cards/CertificationCard'
import { CourseCard } from '@/components/cards/CourseCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Accordion } from '@/components/ui/Accordion'
import { ButtonLink } from '@/components/ui/Button'
import { Card, Container, Section, SectionHeading } from '@/components/ui/primitives'
import { CardGridSkeleton, ErrorState } from '@/components/ui/states'
import { getProvider } from '@/api/endpoints'
import { CTASection } from '@/components/marketing/sections'
import { siteConfig } from '@/config/brand'
import { useServerSeo } from '@/hooks/useSeo'
import { formatDate } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'

export default function ProviderPage() {
  const { provider: providerSlug = '' } = useParams()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.provider(providerSlug),
    queryFn: () => getProvider(providerSlug),
    enabled: Boolean(providerSlug),
  })

  useServerSeo(data?.seo, data?.name ?? 'Certification provider')

  if (isError) {
    return (
      <Container className="py-14">
        <ErrorState
          title="Provider not found"
          description="We do not have a page for that certification provider."
          onRetry={() => void refetch()}
        />
      </Container>
    )
  }

  return (
    <>
      <PageHeader
        title={
          isLoading ? 'Loading...' : `${data?.name} certification preparation`
        }
        description={
          data?.short_description ??
          'Independent preparation resources, learning paths and related courses.'
        }
        breadcrumbs={
          data?.seo?.breadcrumbs ?? [
            { name: 'Home', url: '/' },
            { name: 'Certifications', url: '/certifications' },
          ]
        }
        actions={
          data?.website_url ? (
            <a
              href={data.website_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
            >
              Official certification site
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null
        }
      >
        {/* An unambiguous separation between this platform and the vendor. */}
        <div className="mt-6 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {data?.is_official_partner
              ? 'Authorised training partner'
              : `Independent preparation resources${data ? ` for ${data.name} certifications` : ''}`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            {data?.is_official_partner
              ? 'This relationship has been verified and recorded by an administrator.'
              : `${siteConfig.independenceNotice} Exams are booked and awarded by the certification provider.`}
          </p>
        </div>
      </PageHeader>

      {data?.description && (
        <Section className="py-12">
          <Container className="max-w-3xl">
            <div className="space-y-4 text-[1.0625rem] leading-relaxed text-ink-700">
              {data.description.split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </Container>
        </Section>
      )}

      <Section tone="muted" className="py-14">
        <Container>
          <SectionHeading
            eyebrow="Certifications"
            title={`${data?.name ?? 'Provider'} certifications we cover`}
            description="Each certification page maps published exam objectives to a preparation roadmap and study resources."
          />
          {isLoading ? (
            <CardGridSkeleton count={3} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data?.certifications.map((certification) => (
                <CertificationCard key={certification.id} certification={certification} />
              ))}
            </div>
          )}
        </Container>
      </Section>

      {(data?.related_courses.length ?? 0) > 0 && (
        <Section className="py-14">
          <Container>
            <SectionHeading
              eyebrow="Courses"
              title="Courses that build the underlying skills"
              action={
                <ButtonLink to="/courses" variant="outline">
                  All courses
                </ButtonLink>
              }
            />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data?.related_courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </Container>
        </Section>
      )}

      {(data?.related_articles.length ?? 0) > 0 && (
        <Section tone="muted" className="py-14">
          <Container>
            <SectionHeading eyebrow="Resources" title="Related guides and roadmaps" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data?.related_articles.map((article) => (
                <Card key={article.id} interactive className="group relative p-5">
                  <h3 className="text-base font-bold text-ink-900">
                    <Link
                      to={`/resources/${article.slug}`}
                      className="after:absolute after:inset-0 group-hover:text-brand-700"
                    >
                      {article.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-ink-600">{article.excerpt}</p>
                  <p className="mt-4 flex items-center gap-2 text-xs text-ink-500">
                    <span>{formatDate(article.published_at)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{article.reading_minutes} min read</span>
                    <ArrowUpRight className="ml-auto h-4 w-4" aria-hidden="true" />
                  </p>
                </Card>
              ))}
            </div>
          </Container>
        </Section>
      )}

      {(data?.faqs.length ?? 0) > 0 && (
        <Section className="py-14">
          <Container className="max-w-3xl">
            <SectionHeading title="Frequently asked questions" align="center" />
            <Accordion items={data?.faqs ?? []} />
          </Container>
        </Section>
      )}

      <CTASection
        title="Start preparing"
        description="Pick a certification, follow the roadmap, and use the practice resources to find your gaps early."
        primary={{ label: 'Explore Certifications', to: '/certifications' }}
        secondary={{ label: 'Browse Courses', to: '/courses' }}
      />
    </>
  )
}
