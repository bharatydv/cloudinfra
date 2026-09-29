import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, Lock } from 'lucide-react'

import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { ButtonLink } from '@/components/ui/Button'
import { Badge, Card, Container, Section } from '@/components/ui/primitives'
import { DetailSkeleton, ErrorState } from '@/components/ui/states'
import { getCourse, getLesson } from '@/api/endpoints'
import { useServerSeo } from '@/hooks/useSeo'
import { Markdown } from '@/lib/markdown'
import { queryKeys } from '@/lib/queryClient'
import { pluralize } from '@/lib/format'

/**
 * A single free lesson, readable without an account.
 *
 * The API already serves a lesson marked `is_preview` to anyone; until now
 * nothing in the site linked to one, so the "Preview" badge on the curriculum
 * had nowhere to go. The lesson is looked up by slug within the course rather
 * than by id, so the URL stays readable and survives a reseed.
 *
 * These are indexable: the content is free, substantial and unique, and the
 * API supplies full head tags. The sitemap lists every preview lesson of a
 * published course.
 */
export default function LessonPreviewPage() {
  const { slug = '', lessonSlug = '' } = useParams()

  const {
    data: course,
    isLoading: courseLoading,
    isError: courseError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.course(slug),
    queryFn: () => getCourse(slug),
    enabled: Boolean(slug),
  })

  const summary = course?.modules
    .flatMap((module) => module.lessons)
    .find((lesson) => lesson.slug === lessonSlug)

  const { data: lesson, isLoading: lessonLoading } = useQuery({
    queryKey: queryKeys.lessonPreview(summary?.id ?? ''),
    queryFn: () => getLesson(summary!.id),
    enabled: Boolean(summary?.id) && Boolean(summary?.is_preview),
  })

  // The API builds the head tags for a preview lesson -- title, description,
  // canonical, Open Graph, Twitter card, breadcrumbs and LearningResource
  // structured data -- exactly as it does for a course or an article.
  useServerSeo(lesson?.seo, summary?.title ?? 'Lesson preview')

  if (courseLoading || (summary?.is_preview && lessonLoading)) {
    return (
      <Container className="py-14">
        <DetailSkeleton />
      </Container>
    )
  }

  if (courseError || !course) {
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

  // Either the slug matches nothing, or it matches a lesson that is not free.
  // Both get the same answer, so a URL cannot be used to probe what exists.
  if (!summary || !summary.is_preview) {
    return (
      <Container className="py-14">
        <div className="mx-auto max-w-xl text-center">
          <Lock className="mx-auto h-6 w-6 text-ink-400" aria-hidden="true" />
          <h1 className="mt-4 text-heading text-ink-900">This lesson is not a free preview</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            Enroll in {course.title} to read it. Enrollment is free and your progress is saved
            across devices.
          </p>
          <ButtonLink to={`/courses/${course.slug}`} className="mt-6">
            Go to the course
          </ButtonLink>
        </div>
      </Container>
    )
  }

  return (
    <>
      <section className="border-b border-ink-200 bg-ink-50">
        <Container className="py-10">
          <Breadcrumbs
            items={[
              { name: 'Home', url: '/' },
              { name: 'Courses', url: '/courses' },
              { name: course.title, url: `/courses/${course.slug}` },
              { name: summary.title, url: `/courses/${course.slug}/preview/${summary.slug}` },
            ]}
            className="mb-6"
          />

          <Badge tone="brand">Free preview</Badge>
          <h1 className="mt-3 text-heading-lg text-ink-900">{summary.title}</h1>
          <p className="mt-3 text-sm text-ink-600">
            From{' '}
            <Link to={`/courses/${course.slug}`} className="font-semibold text-brand-700 hover:underline">
              {course.title}
            </Link>
          </p>

          <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <dt className="sr-only">Duration</dt>
              <dd>{summary.duration_minutes} min</dd>
            </div>
            <div>
              <dt className="sr-only">Course length</dt>
              <dd>{pluralize(course.lesson_count, 'lesson')} in the full course</dd>
            </div>
          </dl>
        </Container>
      </section>

      <Section className="py-12">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            <div className="min-w-0">
              {lesson?.description && (
                <p className="mb-8 text-base leading-relaxed text-ink-600">{lesson.description}</p>
              )}

              {lesson ? (
                <Markdown content={lesson.content} />
              ) : (
                <p className="text-sm text-ink-600">
                  This preview has no written content yet.
                </p>
              )}

              <div className="mt-12 border-t border-ink-200 pt-6">
                <Link
                  to={`/courses/${course.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to {course.title}
                </Link>
              </div>
            </div>

            <aside>
              <Card className="h-fit p-6 lg:sticky lg:top-24">
                <h2 className="text-sm font-bold text-ink-900">Keep going</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  This is one lesson of {pluralize(course.lesson_count, 'lesson')} across{' '}
                  {pluralize(course.modules.length, 'module')}. Enroll to unlock the rest, track
                  your progress and earn a completion certificate.
                </p>
                <ButtonLink to={`/courses/${course.slug}`} fullWidth className="mt-5">
                  {course.is_free ? 'Enroll for free' : 'See the full course'}
                </ButtonLink>
              </Card>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  )
}
