import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Globe,
  Lock,
  PlayCircle,
  Users,
} from 'lucide-react'

import { CourseCard } from '@/components/cards/CourseCard'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Accordion } from '@/components/ui/Accordion'
import { Button, ButtonLink } from '@/components/ui/Button'
import {
  Avatar,
  Badge,
  Card,
  Container,
  Rating,
  Section,
  SectionHeading,
} from '@/components/ui/primitives'
import { DetailSkeleton, ErrorState } from '@/components/ui/states'
import { enroll, getCourse } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useServerSeo } from '@/hooks/useSeo'
import { useToast } from '@/hooks/useToast'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { formatDate, formatDuration, formatLevel, formatNumber, formatPrice, pluralize } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import { cn } from '@/lib/cn'

export default function CourseDetailPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [openModules, setOpenModules] = useState<string[]>([])

  const { data: course, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.course(slug),
    queryFn: () => getCourse(slug),
    enabled: Boolean(slug),
  })

  useServerSeo(course?.seo, course?.title ?? 'Course')

  useEffect(() => {
    if (course) {
      track(AnalyticsEvent.CourseViewed, { entityType: 'course', entityId: course.id })
      setOpenModules(course.modules.slice(0, 1).map((module) => module.id))
    }
  }, [course])

  const enrollMutation = useMutation({
    mutationFn: () => enroll(course!.id),
    onSuccess: () => {
      track(AnalyticsEvent.CourseEnrolled, { entityType: 'course', entityId: course?.id })
      toast.success('You are enrolled. Happy learning.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.course(slug) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      navigate(`/learn/${slug}`)
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Enrollment failed.')
    },
  })

  if (isLoading) {
    return (
      <Container className="py-14">
        <DetailSkeleton />
      </Container>
    )
  }

  if (isError || !course) {
    return (
      <Container className="py-14">
        <ErrorState
          title="Course not found"
          description="This course may have been unpublished or the link may be out of date."
          onRetry={() => void refetch()}
        />
      </Container>
    )
  }

  const breadcrumbs = course.seo?.breadcrumbs ?? [
    { name: 'Home', url: '/' },
    { name: 'Courses', url: '/courses' },
    { name: course.title, url: `/courses/${course.slug}` },
  ]

  function toggleModule(id: string) {
    setOpenModules((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const enrollLabel = !isAuthenticated
    ? 'Log in to Enroll'
    : course.is_enrolled
      ? 'Continue learning'
      : course.is_free
        ? 'Enroll now'
        : `Enroll for ${formatPrice(course.price, course.currency)}`

  function handleEnroll() {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/courses/${slug}` } })
      return
    }
    if (course!.is_enrolled) {
      navigate(`/learn/${slug}`)
      return
    }
    enrollMutation.mutate()
  }

  return (
    <>
      {/* Hero */}
      <section className="border-b border-ink-800 bg-ink-950">
        <Container className="py-12 sm:py-16">
          <Breadcrumbs items={breadcrumbs} tone="inverse" className="mb-6" />
          <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                {course.category && <Badge tone="brand">{course.category.name}</Badge>}
                <Badge tone="outline" className="border-white/20 text-ink-300">
                  {formatLevel(course.level)}
                </Badge>
                {course.is_free && <Badge tone="success">Free</Badge>}
              </div>

              <h1 className="text-heading-lg text-white sm:text-4xl">{course.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-300">
                {course.short_description}
              </p>

              <dl className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-400">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <dt className="sr-only">Duration</dt>
                  <dd>{formatDuration(course.duration_minutes)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  <dt className="sr-only">Lessons</dt>
                  <dd>{pluralize(course.lesson_count, 'lesson')}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  <dt className="sr-only">Enrolled</dt>
                  <dd>{formatNumber(course.enrollment_count)} enrolled</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" aria-hidden="true" />
                  <dt className="sr-only">Language</dt>
                  <dd>{course.language.toUpperCase()}</dd>
                </div>
                <Rating value={course.rating_average} count={course.rating_count} />
              </dl>

              {course.instructor && (
                <div className="mt-6 flex items-center gap-3">
                  <Avatar
                    name={course.instructor.name}
                    src={course.instructor.profile_image}
                    size="md"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{course.instructor.name}</p>
                    {course.instructor.headline && (
                      <p className="text-xs text-ink-400">{course.instructor.headline}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Enrollment card */}
            <Card className="h-fit p-6 lg:sticky lg:top-24">
              <p className="text-3xl font-extrabold tracking-tight text-ink-900">
                {formatPrice(course.price, course.currency)}
              </p>
              {course.is_enrolled && (
                <div className="mt-3">
                  <Badge tone="success">Enrolled &middot; {course.progress_percentage}% complete</Badge>
                </div>
              )}

              <Button
                fullWidth
                size="lg"
                className="mt-5"
                onClick={handleEnroll}
                loading={enrollMutation.isPending}
              >
                {enrollLabel}
              </Button>

              {!isAuthenticated && (
                <p className="mt-3 text-center text-xs text-ink-500">
                  Free to create an account. No card required.
                </p>
              )}

              <ul className="mt-6 space-y-2.5 border-t border-ink-200 pt-5 text-sm text-ink-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  Self-paced, lifetime access
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  Progress saved across devices
                </li>
                <li className="flex items-start gap-2.5">
                  <Award className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  Completion certificate from this platform
                </li>
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-ink-500">
                A completion certificate records what you finished here. It is not a vendor
                certification.
              </p>
            </Card>
          </div>
        </Container>
      </section>

      <Section className="py-14">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
            <div className="min-w-0 space-y-12">
              {course.learning_outcomes.length > 0 && (
                <section aria-labelledby="outcomes">
                  <h2 id="outcomes" className="text-heading text-ink-900">
                    What you will learn
                  </h2>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {course.learning_outcomes.map((outcome) => (
                      <li key={outcome} className="flex items-start gap-2.5 text-sm text-ink-700">
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                          aria-hidden="true"
                        />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {course.description && (
                <section aria-labelledby="about">
                  <h2 id="about" className="text-heading text-ink-900">
                    About this course
                  </h2>
                  <div className="mt-4 space-y-4 text-[1.0625rem] leading-relaxed text-ink-700">
                    {course.description.split('\n\n').map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              )}

              {course.requirements.length > 0 && (
                <section aria-labelledby="requirements">
                  <h2 id="requirements" className="text-heading text-ink-900">
                    Requirements
                  </h2>
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink-700">
                    {course.requirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Curriculum */}
              <section aria-labelledby="curriculum">
                <h2 id="curriculum" className="text-heading text-ink-900">
                  Curriculum
                </h2>
                <p className="mt-2 text-sm text-ink-600">
                  {pluralize(course.modules.length, 'module')} &middot;{' '}
                  {pluralize(course.lesson_count, 'lesson')} &middot;{' '}
                  {formatDuration(course.duration_minutes)}
                </p>

                <div className="mt-5 divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 bg-white">
                  {course.modules.map((module) => {
                    const isOpen = openModules.includes(module.id)
                    return (
                      <div key={module.id}>
                        <h3>
                          <button
                            type="button"
                            onClick={() => toggleModule(module.id)}
                            aria-expanded={isOpen}
                            aria-controls={`module-${module.id}`}
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-ink-50"
                          >
                            <span>
                              <span className="block text-sm font-semibold text-ink-900">
                                {module.position}. {module.title}
                              </span>
                              <span className="mt-0.5 block text-xs text-ink-500">
                                {pluralize(module.lessons.length, 'lesson')}
                              </span>
                            </span>
                            <ChevronDown
                              className={cn(
                                'h-5 w-5 shrink-0 text-ink-400 transition-transform',
                                isOpen && 'rotate-180',
                              )}
                              aria-hidden="true"
                            />
                          </button>
                        </h3>
                        <ul id={`module-${module.id}`} hidden={!isOpen} className="pb-2">
                          {module.lessons.map((lesson) => (
                            <li
                              key={lesson.id}
                              className="flex items-center gap-3 px-5 py-2.5 text-sm text-ink-700"
                            >
                              {lesson.is_preview || course.is_enrolled ? (
                                <PlayCircle
                                  className="h-4 w-4 shrink-0 text-brand-600"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Lock className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                              )}
                              <span className="flex-1">{lesson.title}</span>
                              {lesson.is_preview && !course.is_enrolled && (
                                <Badge tone="brand">Preview</Badge>
                              )}
                              <span className="text-xs text-ink-500">
                                {lesson.duration_minutes} min
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Reviews */}
              <section aria-labelledby="reviews">
                <h2 id="reviews" className="text-heading text-ink-900">
                  Reviews
                </h2>
                {course.reviews.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-600">
                    No reviews yet. Reviews can only be left by enrolled learners.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-4">
                    {course.reviews.map((review) => (
                      <li key={review.id}>
                        <Card className="p-5">
                          <div className="flex items-center gap-3">
                            <Avatar name={review.user.name} src={review.user.profile_image} size="sm" />
                            <div>
                              <p className="text-sm font-semibold text-ink-900">{review.user.name}</p>
                              <p className="text-xs text-ink-500">{formatDate(review.created_at)}</p>
                            </div>
                            <span className="ml-auto">
                              <Rating value={review.rating} count={1} />
                            </span>
                          </div>
                          {review.comment && (
                            <p className="mt-3 text-sm leading-relaxed text-ink-700">
                              {review.comment}
                            </p>
                          )}
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {course.faqs.length > 0 && (
                <section aria-labelledby="course-faq">
                  <h2 id="course-faq" className="text-heading text-ink-900">
                    Frequently asked questions
                  </h2>
                  <Accordion items={course.faqs} className="mt-5" />
                </section>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              {course.related_certifications.length > 0 && (
                <Card className="p-5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                    Related certifications
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {course.related_certifications.map((certification) => (
                      <li key={certification.id}>
                        <Link
                          to={`/certifications/${certification.provider_slug}/${certification.slug}`}
                          className="block rounded-lg border border-ink-200 p-3.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                            {certification.provider_name}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-ink-900">
                            {certification.name}
                          </p>
                          <p className="mt-1 text-xs text-ink-500">
                            {formatLevel(certification.level)}
                            {certification.exam_code ? ` · ${certification.exam_code}` : ''}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="bg-brand-50/60 p-5">
                <h2 className="text-sm font-bold text-ink-900">Not sure where to start?</h2>
                <p className="mt-2 text-sm text-ink-600">
                  Browse certification paths to see which courses feed into the exam you are aiming
                  at.
                </p>
                <ButtonLink to="/certifications" variant="outline" size="sm" className="mt-4">
                  Explore certifications
                </ButtonLink>
              </Card>
            </aside>
          </div>
        </Container>
      </Section>

      {course.related_courses.length > 0 && (
        <Section tone="muted" className="py-14">
          <Container>
            <SectionHeading title="Related courses" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {course.related_courses.map((related) => (
                <CourseCard key={related.id} course={related} />
              ))}
            </div>
          </Container>
        </Section>
      )}
    </>
  )
}
