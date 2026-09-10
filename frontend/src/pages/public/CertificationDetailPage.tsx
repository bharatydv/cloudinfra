import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Clock,
  FileText,
  ListChecks,
  Route,
  Users,
} from 'lucide-react'

import { CertificationCard } from '@/components/cards/CertificationCard'
import { CourseCard } from '@/components/cards/CourseCard'
import { ResourceCard } from '@/components/cards/misc'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { CTASection } from '@/components/marketing/sections'
import { Accordion } from '@/components/ui/Accordion'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Container, ProgressBar, Section, SectionHeading } from '@/components/ui/primitives'
import { DetailSkeleton, ErrorState } from '@/components/ui/states'
import { getCertification, saveCertification, unsaveCertification } from '@/api/endpoints'
import { siteConfig } from '@/config/brand'
import { useAuth } from '@/hooks/useAuth'
import { useServerSeo } from '@/hooks/useSeo'
import { useToast } from '@/hooks/useToast'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { formatLevel } from '@/lib/format'
import { Markdown } from '@/lib/markdown'
import { queryKeys } from '@/lib/queryClient'
import type { CertificationResource } from '@/types/api'

export default function CertificationDetailPage() {
  const { provider = '', slug = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [openResource, setOpenResource] = useState<CertificationResource | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.certification(provider, slug),
    queryFn: () => getCertification(provider, slug),
    enabled: Boolean(provider && slug),
  })

  useServerSeo(data?.seo, data?.name ?? 'Certification')

  useEffect(() => {
    if (data) {
      track(AnalyticsEvent.CertificationViewed, {
        entityType: 'certification',
        entityId: data.id,
      })
    }
  }, [data])

  const toggleSave = useMutation({
    mutationFn: () =>
      data!.is_saved ? unsaveCertification(data!.id) : saveCertification(data!.id),
    onSuccess: () => {
      toast.success(data?.is_saved ? 'Removed from saved.' : 'Saved to your dashboard.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.certification(provider, slug) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedCertifications })
    },
    onError: () => toast.error('We could not update your saved list.'),
  })

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
          title="Certification not found"
          description="This certification page may have been unpublished."
          onRetry={() => void refetch()}
        />
      </Container>
    )
  }

  const totalWeight = data.exam_topics.reduce((sum, topic) => sum + (topic.weight ?? 0), 0)

  return (
    <>
      <section className="border-b border-ink-800 bg-ink-950">
        <Container className="py-12 sm:py-16">
          <Breadcrumbs items={data.seo?.breadcrumbs ?? []} tone="inverse" className="mb-6" />

          <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{data.provider_name}</Badge>
                <Badge tone="outline" className="border-white/20 text-ink-300">
                  {formatLevel(data.level)}
                </Badge>
                {data.exam_code && (
                  <Badge tone="outline" className="border-white/20 text-ink-300">
                    Exam {data.exam_code}
                  </Badge>
                )}
              </div>

              <h1 className="text-heading-lg text-white sm:text-4xl">{data.name}</h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-300">
                {data.short_description}
              </p>

              <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-400">
                {data.exam_duration_minutes && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    <dt className="sr-only">Exam duration</dt>
                    <dd>{data.exam_duration_minutes} minutes</dd>
                  </div>
                )}
                {data.exam_format && (
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                    <dt className="sr-only">Format</dt>
                    <dd>{data.exam_format}</dd>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  <dt className="sr-only">Related courses</dt>
                  <dd>{data.related_courses.length} related courses</dd>
                </div>
              </dl>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => {
                    document
                      .getElementById('roadmap')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    track(AnalyticsEvent.CtaClicked, { properties: { cta: 'start_preparing' } })
                  }}
                >
                  Start Preparing
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-transparent text-white hover:bg-white/10"
                  loading={toggleSave.isPending}
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate('/login', {
                        state: { from: `/certifications/${provider}/${slug}` },
                      })
                      return
                    }
                    toggleSave.mutate()
                  }}
                  leadingIcon={
                    data.is_saved ? (
                      <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Bookmark className="h-4 w-4" aria-hidden="true" />
                    )
                  }
                >
                  {data.is_saved ? 'Saved' : 'Save for later'}
                </Button>
              </div>
            </div>

            <Card className="h-fit p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                Exam information
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Provider</dt>
                  <dd className="font-semibold text-ink-900">{data.provider_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Level</dt>
                  <dd className="font-semibold text-ink-900">{formatLevel(data.level)}</dd>
                </div>
                {data.exam_code && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">Exam code</dt>
                    <dd className="font-semibold text-ink-900">{data.exam_code}</dd>
                  </div>
                )}
                {data.category && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">Category</dt>
                    <dd className="font-semibold text-ink-900">{data.category}</dd>
                  </div>
                )}
              </dl>

              {data.official_url && (
                <a
                  href={data.official_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                >
                  Official exam page
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}

              <p className="mt-4 border-t border-ink-200 pt-4 text-xs leading-relaxed text-ink-500">
                {siteConfig.independenceNotice} Always confirm cost, format and scheduling on the
                provider&rsquo;s official page.
              </p>
            </Card>
          </div>
        </Container>
      </section>

      <Section className="py-14">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
            <div className="min-w-0 space-y-12">
              <section aria-labelledby="overview">
                <h2 id="overview" className="text-heading text-ink-900">
                  Overview
                </h2>
                <div className="mt-4">
                  <Markdown content={data.description} />
                </div>
              </section>

              {data.audience && (
                <section aria-labelledby="audience">
                  <h2 id="audience" className="text-heading text-ink-900">
                    Who should take this certification?
                  </h2>
                  <p className="mt-3 text-[1.0625rem] leading-relaxed text-ink-700">
                    {data.audience}
                  </p>
                </section>
              )}

              {data.recommended_experience && (
                <section aria-labelledby="experience">
                  <h2 id="experience" className="text-heading text-ink-900">
                    Recommended experience
                  </h2>
                  <p className="mt-3 text-[1.0625rem] leading-relaxed text-ink-700">
                    {data.recommended_experience}
                  </p>
                </section>
              )}

              {data.skills.length > 0 && (
                <section aria-labelledby="skills">
                  <h2 id="skills" className="text-heading text-ink-900">
                    Skills covered
                  </h2>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {data.skills.map((skill) => (
                      <li key={skill}>
                        <Badge tone="brand">{skill}</Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {data.exam_topics.length > 0 && (
                <section aria-labelledby="topics">
                  <h2 id="topics" className="text-heading text-ink-900">
                    Exam topics
                  </h2>
                  {totalWeight > 0 && (
                    <p className="mt-2 text-sm text-ink-600">
                      Weights are taken from the provider&rsquo;s published exam guide.
                    </p>
                  )}
                  <ul className="mt-5 space-y-4">
                    {data.exam_topics.map((topic) => (
                      <li key={topic.title}>
                        <Card className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="text-base font-bold text-ink-900">{topic.title}</h3>
                            {topic.weight ? (
                              <Badge tone="neutral">{topic.weight}%</Badge>
                            ) : null}
                          </div>
                          {topic.weight ? (
                            <ProgressBar value={topic.weight} size="sm" className="mt-3" />
                          ) : null}
                          {topic.items.length > 0 && (
                            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-ink-600">
                              {topic.items.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </Card>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {data.preparation_roadmap.length > 0 && (
                <section aria-labelledby="roadmap-heading" id="roadmap" className="scroll-mt-28">
                  <h2 id="roadmap-heading" className="text-heading text-ink-900">
                    Preparation roadmap
                  </h2>
                  <ol className="mt-5 space-y-3">
                    {data.preparation_roadmap.map((step) => (
                      <li key={step.step} className="flex gap-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                          {step.step}
                        </span>
                        <Card className="flex-1 p-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-sm font-bold text-ink-900">{step.title}</h3>
                            {step.estimated_weeks ? (
                              <Badge tone="outline">
                                {step.estimated_weeks} {step.estimated_weeks === 1 ? 'week' : 'weeks'}
                              </Badge>
                            ) : null}
                          </div>
                          {step.description && (
                            <p className="mt-2 text-sm leading-relaxed text-ink-600">
                              {step.description}
                            </p>
                          )}
                        </Card>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {data.resources.length > 0 && (
                <section aria-labelledby="resources">
                  <h2 id="resources" className="text-heading text-ink-900">
                    Study resources
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {data.resources.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        onOpen={setOpenResource}
                      />
                    ))}
                  </div>
                </section>
              )}

              {data.practice_resources.length > 0 && (
                <section aria-labelledby="practice">
                  <h2 id="practice" className="text-heading text-ink-900">
                    Practice resources
                  </h2>
                  <p className="mt-2 text-sm text-ink-600">
                    Built from published exam objectives to help you find gaps. These are study
                    aids, not real exam questions.
                  </p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {data.practice_resources.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        onOpen={setOpenResource}
                      />
                    ))}
                  </div>
                </section>
              )}

              {data.faqs.length > 0 && (
                <section aria-labelledby="cert-faq">
                  <h2 id="cert-faq" className="text-heading text-ink-900">
                    Frequently asked questions
                  </h2>
                  <Accordion items={data.faqs} className="mt-5" />
                </section>
              )}
            </div>

            <aside className="space-y-6">
              <Card className="p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                  <Route className="h-4 w-4" aria-hidden="true" />
                  On this page
                </h2>
                <ul className="mt-4 space-y-2 text-sm">
                  {[
                    ['overview', 'Overview'],
                    ['audience', 'Who it is for'],
                    ['skills', 'Skills covered'],
                    ['topics', 'Exam topics'],
                    ['roadmap', 'Preparation roadmap'],
                    ['resources', 'Study resources'],
                    ['practice', 'Practice resources'],
                  ].map(([id, label]) => (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        className="block rounded px-2 py-1 text-ink-600 transition hover:bg-ink-50 hover:text-brand-700"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            </aside>
          </div>
        </Container>
      </Section>

      {data.related_courses.length > 0 && (
        <Section tone="muted" className="py-14">
          <Container>
            <SectionHeading
              eyebrow="Recommended courses"
              title="Courses that prepare you for this certification"
            />
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

      <CTASection
        title="Start preparing for this certification"
        description="Work the roadmap, use the practice resources, then book the exam with the provider."
        primary={{ label: 'Browse Courses', to: '/courses' }}
        secondary={{ label: 'All Certifications', to: '/certifications' }}
      />

      <Modal
        open={Boolean(openResource)}
        onClose={() => setOpenResource(null)}
        title={openResource?.title ?? ''}
        description={openResource?.description ?? undefined}
        size="lg"
      >
        {openResource?.content ? (
          <Markdown content={openResource.content} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-600">
            <FileText className="h-4 w-4" aria-hidden="true" />
            This resource has no written content yet.
          </p>
        )}
      </Modal>
    </>
  )
}
