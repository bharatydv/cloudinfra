import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  BookOpen,
  BookMarked,
  Search,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock,
  Globe,
  GraduationCap,
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
  const [lessonQuery, setLessonQuery] = useState('')

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

  // Searching a 352-lesson curriculum beats scrolling it. Matching modules are
  // force-opened while a query is active, so a hit is never hidden behind a
  // collapsed accordion.
  const query = lessonQuery.trim().toLowerCase()
  const moduleMatches = (module: (typeof course.modules)[number]) =>
    !query ||
    module.title.toLowerCase().includes(query) ||
    module.lessons.some((lesson) => lesson.title.toLowerCase().includes(query))
  const lessonMatches = (title: string) =>
    !query || title.toLowerCase().includes(query)

  const visibleModules = course.modules.filter(moduleMatches)
  const matchCount = query
    ? course.modules.reduce(
        (total, module) =>
          total + module.lessons.filter((lesson) => lessonMatches(lesson.title)).length,
        0,
      )
    : 0
  const allOpen = openModules.length === course.modules.length

  // A reference pack is a module whose lessons are every one of them free. A
  // module with a few preview lessons among locked ones is a teaching module
  // with tasters, and belongs in the curriculum rather than here.
  const referenceModules = course.modules.filter(
    (module) => module.lessons.length > 0 && module.lessons.every((lesson) => lesson.is_preview),
  )
  const referenceLessonCount = referenceModules.reduce(
    (total, module) => total + module.lessons.length,
    0,
  )

  function toggleModule(id: string) {
    setOpenModules((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const enrollLabel = !isAuthenticated
    ? 'Log in to enroll'
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

                {/* Finding one lesson among hundreds by scrolling is miserable,
                    so the curriculum gets a filter and a bulk toggle. Both are
                    hidden on short courses, where they would be clutter. */}
                {course.lesson_count > 40 && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="relative min-w-0 flex-1 sm:max-w-xs">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={lessonQuery}
                        onChange={(event) => setLessonQuery(event.target.value)}
                        placeholder="Find a lesson"
                        aria-label="Find a lesson in this course"
                        className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setOpenModules(allOpen ? [] : course.modules.map((item) => item.id))
                      }
                    >
                      {allOpen ? 'Collapse all' : 'Expand all'}
                    </Button>
                    {query && (
                      <p className="text-sm text-ink-600" role="status">
                        {matchCount === 0
                          ? 'No lessons match'
                          : `${pluralize(matchCount, 'lesson')} in ${pluralize(
                              visibleModules.length,
                              'module',
                            )}`}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-5 divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 bg-white">
                  {visibleModules.length === 0 && (
                    <p className="px-5 py-8 text-center text-sm text-ink-600">
                      Nothing matches &ldquo;{lessonQuery}&rdquo;.
                    </p>
                  )}
                  {visibleModules.map((module) => {
                    // A query forces matching modules open, so a hit is never
                    // hidden behind a collapsed accordion.
                    const isOpen = query ? true : openModules.includes(module.id)
                    const moduleMinutes = module.lessons.reduce(
                      (total, lesson) => total + lesson.duration_minutes,
                      0,
                    )
                    const freeCount = module.lessons.filter((lesson) => lesson.is_preview).length
                    const shownLessons = module.lessons.filter((lesson) =>
                      lessonMatches(lesson.title),
                    )
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
                                {moduleMinutes > 0 && ` · ${formatDuration(moduleMinutes)}`}
                                {freeCount > 0 && !course.is_enrolled && (
                                  <span className="text-brand-700">
                                    {' '}
                                    · {freeCount} free
                                  </span>
                                )}
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
                        {isOpen && (
                        <ul id={`module-${module.id}`} className="pb-2">
                          {shownLessons.map((lesson) => {
                            // An enrolled learner opens the lesson itself; a
                            // visitor can open only the lessons marked as a
                            // preview. Everything else is plain text, because a
                            // link that leads to a permission error is worse
                            // than no link.
                            const href = course.is_enrolled
                              ? `/learn/${course.slug}/${lesson.slug}`
                              : lesson.is_preview
                                ? `/courses/${course.slug}/preview/${lesson.slug}`
                                : null

                            return (
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
                                  <Lock
                                    className="h-4 w-4 shrink-0 text-ink-400"
                                    aria-hidden="true"
                                  />
                                )}
                                {href ? (
                                  <Link
                                    to={href}
                                    className="flex-1 rounded transition hover:text-brand-700 hover:underline"
                                  >
                                    {lesson.title}
                                  </Link>
                                ) : (
                                  <span className="flex-1">{lesson.title}</span>
                                )}
                                {lesson.is_preview && !course.is_enrolled && (
                                  <Badge tone="brand">Preview</Badge>
                                )}
                                <span className="text-xs text-ink-500">
                                  {lesson.duration_minutes} min
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* A suggested pace, for learners who want one. Self-paced access
                  does not change; this is a plan, not a schedule with dates. */}
              {/* A module whose every lesson is a preview is a reference pack:
                  a syllabus, glossary, templates, cheat sheets. Those pages are
                  the most useful thing on the page for someone deciding whether
                  to enroll, and they are buried inside the curriculum accordion,
                  so they get their own section. Driven entirely by is_preview,
                  so any course gains it by marking a module's lessons free. */}
              {referenceModules.length > 0 && (
                <section aria-labelledby="reference">
                  <h2 id="reference" className="text-heading text-ink-900">
                    Free to read, no account needed
                  </h2>
                  <p className="mt-2 text-sm text-ink-600">
                    {pluralize(referenceLessonCount, 'reference page')} you can open right
                    now, and keep using after the course.
                  </p>

                  {referenceModules.map((module) => (
                    <ul key={module.id} className="mt-5 grid gap-3 sm:grid-cols-2">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          <Link
                            to={`/courses/${course.slug}/preview/${lesson.slug}`}
                            className="hover-lift flex h-full gap-3 rounded-xl border border-ink-200 bg-white p-4"
                          >
                            <BookMarked
                              className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                              aria-hidden="true"
                            />
                            {/* Title and duration only: the course detail
                                endpoint returns LessonSummary, which carries no
                                description. */}
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-ink-900">
                                {lesson.title}
                              </span>
                              <span className="mt-1 block text-sm text-ink-500">
                                {lesson.duration_minutes} min read
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ))}
                </section>
              )}

              {course.roadmap.length > 0 && (
                <section aria-labelledby="roadmap">
                  <h2 id="roadmap" className="text-heading text-ink-900">
                    Suggested study plan
                  </h2>
                  <p className="mt-2 text-sm text-ink-600">
                    A comfortable pace for finishing in {pluralize(course.roadmap.length, 'week')}.
                    The course is self-paced, so go faster or slower as it suits you.
                  </p>

                  <ol className="mt-5 space-y-3">
                    {course.roadmap.map((week) => (
                      <li key={week.week}>
                        <Card className="flex gap-4 p-4 sm:p-5">
                          <span
                            className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700"
                            aria-hidden="true"
                          >
                            <CalendarRange className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
                              Week {week.week}
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-ink-900">
                              {week.title}
                            </p>
                            {week.topics.length > 0 && (
                              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                                {week.topics.join(' · ')}
                              </p>
                            )}
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {course.certification_levels.length > 0 && (
                <section aria-labelledby="levels">
                  <h2 id="levels" className="text-heading text-ink-900">
                    Certification levels
                  </h2>
                  <p className="mt-2 text-sm text-ink-600">
                    {/* Counted, not spelled out: courses do not all have three
                        levels, and a wrong number here reads as carelessness. */}
                    {pluralize(course.certification_levels.length, 'level')}, each earned by
                    finishing the work it covers. These are certificates from this platform,
                    not vendor certifications.
                  </p>

                  <ol className="mt-5 grid gap-4 sm:grid-cols-3">
                    {course.certification_levels.map((tier) => (
                      <li key={tier.level}>
                        <Card className="flex h-full flex-col p-5">
                          <GraduationCap
                            className="h-5 w-5 text-brand-600"
                            aria-hidden="true"
                          />
                          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-500">
                            Level {tier.level}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-ink-900">{tier.title}</p>
                          <p className="mt-2 text-sm leading-relaxed text-ink-600">{tier.focus}</p>
                        </Card>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

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
