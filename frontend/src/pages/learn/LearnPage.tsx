import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  Menu,
  PlayCircle,
  X,
} from 'lucide-react'

import { Logo } from '@/components/layout/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/primitives'
import { ErrorState, InlineSpinner } from '@/components/ui/states'
import { getLearnCourse, updateLessonProgress } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useSeo } from '@/hooks/useSeo'
import { useToast } from '@/hooks/useToast'
import { Markdown } from '@/lib/markdown'
import { queryKeys } from '@/lib/queryClient'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/cn'

interface LessonResource {
  title?: string
  url?: string
}

export default function LearnPage() {
  const { courseSlug = '', lessonSlug } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.learn(courseSlug, lessonSlug),
    queryFn: () => getLearnCourse(courseSlug, lessonSlug),
    enabled: Boolean(courseSlug),
  })

  useSeo({ title: data?.title ?? 'Learning', robots: NOINDEX })

  const lesson = data?.current_lesson ?? null

  const markComplete = useMutation({
    mutationFn: (completed: boolean) =>
      updateLessonProgress(lesson!.id, { completed }),
    onSuccess: (_result, completed) => {
      void queryClient.invalidateQueries({ queryKey: ['learn', courseSlug] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress })
      if (completed && lesson?.next_lesson_slug) {
        navigate(`/learn/${courseSlug}/${lesson.next_lesson_slug}`)
      } else if (completed) {
        toast.success('Course complete. Your certificate is in your dashboard.')
      }
    },
    onError: () => toast.error('We could not save your progress.'),
  })

  if (isLoading) return <InlineSpinner label="Loading your course" />

  if (isError || !data) {
    const isForbidden = error instanceof ApiError && error.status === 403
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <ErrorState
          title={isForbidden ? 'You are not enrolled in this course' : 'Course unavailable'}
          description={
            isForbidden
              ? 'Enroll from the course page to unlock the lessons.'
              : 'We could not load this course. Please try again.'
          }
          onRetry={isForbidden ? undefined : () => void refetch()}
        />
        <div className="mt-6 text-center">
          <ButtonLink to={`/courses/${courseSlug}`} variant="outline">
            Go to course page
          </ButtonLink>
        </div>
      </div>
    )
  }

  const resources = (lesson?.resources ?? []) as LessonResource[]

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#lesson" className="skip-link">
        Skip to lesson content
      </a>

      {/* Slim player header keeps the focus on the lesson. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-200 bg-white px-4">
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
          aria-label={sidebarOpen ? 'Hide course contents' : 'Show course contents'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>

        <Logo showName={false} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{data.title}</p>
          <p className="text-xs text-ink-500">
            {data.completed_lessons} of {data.total_lessons} lessons complete
          </p>
        </div>

        <div className="hidden w-40 sm:block">
          <ProgressBar value={data.progress_percentage} size="sm" />
        </div>

        <Link
          to={`/courses/${courseSlug}`}
          className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 sm:inline-flex"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Course page
        </Link>
      </header>

      <div className="flex flex-1">
        {/* Curriculum sidebar */}
        <aside
          className={cn(
            'fixed inset-y-14 left-0 z-20 w-80 overflow-y-auto border-r border-ink-200 bg-ink-50 transition-transform lg:static lg:inset-auto lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <nav aria-label="Course contents" className="p-4">
            <p className="px-2 pb-3 text-xs font-bold uppercase tracking-widest text-ink-500">
              Course contents
            </p>
            <ol className="space-y-4">
              {data.modules.map((module) => (
                <li key={module.id}>
                  <p className="px-2 text-sm font-bold text-ink-900">
                    {module.position}. {module.title}
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {module.lessons.map((item) => {
                      const isCurrent = lesson?.id === item.id
                      return (
                        <li key={item.id}>
                          <Link
                            to={`/learn/${courseSlug}/${item.slug}`}
                            onClick={() => setSidebarOpen(false)}
                            aria-current={isCurrent ? 'true' : undefined}
                            className={cn(
                              'flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
                              isCurrent
                                ? 'bg-white font-semibold text-brand-700 shadow-subtle'
                                : 'text-ink-600 hover:bg-white/70',
                            )}
                          >
                            {item.completed ? (
                              <CheckCircle2
                                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                                aria-hidden="true"
                              />
                            ) : isCurrent ? (
                              <PlayCircle
                                className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                                aria-hidden="true"
                              />
                            ) : (
                              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                            )}
                            <span className="flex-1">{item.title}</span>
                            <span className="shrink-0 text-xs text-ink-400">
                              {item.duration_minutes}m
                            </span>
                            {item.completed && <span className="sr-only">Completed</span>}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 top-14 z-10 bg-ink-950/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Lesson content */}
        <main id="lesson" className="min-w-0 flex-1">
          {lesson ? (
            <>
              <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                  Lesson {lesson.position}
                </p>
                <h1 className="mt-2 text-heading-lg text-ink-900">{lesson.title}</h1>
                {lesson.description && (
                  <p className="mt-3 text-base leading-relaxed text-ink-600">
                    {lesson.description}
                  </p>
                )}

                {lesson.video_url && (
                  <div className="mt-8 aspect-video w-full overflow-hidden rounded-xl border border-ink-200 bg-ink-950">
                    <iframe
                      src={lesson.video_url}
                      title={lesson.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      className="h-full w-full"
                    />
                  </div>
                )}

                <div className="mt-8">
                  <Markdown content={lesson.content} />
                </div>

                {resources.length > 0 && (
                  <section className="mt-10 rounded-xl border border-ink-200 bg-ink-50 p-5">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                      Lesson resources
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {resources.map((resource, index) => (
                        <li key={index}>
                          <a
                            href={resource.url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline"
                          >
                            {resource.title ?? 'Resource'}
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {/* Lesson navigation */}
              <div className="sticky bottom-0 border-t border-ink-200 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!lesson.previous_lesson_slug}
                    onClick={() =>
                      navigate(`/learn/${courseSlug}/${lesson.previous_lesson_slug}`)
                    }
                    leadingIcon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
                  >
                    Previous
                  </Button>

                  <Button
                    variant={lesson.completed ? 'outline' : 'primary'}
                    size="sm"
                    className="flex-1 sm:flex-none"
                    loading={markComplete.isPending}
                    onClick={() => markComplete.mutate(!lesson.completed)}
                    leadingIcon={
                      lesson.completed ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : undefined
                    }
                  >
                    {lesson.completed ? 'Completed' : 'Mark complete'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    disabled={!lesson.next_lesson_slug}
                    onClick={() => navigate(`/learn/${courseSlug}/${lesson.next_lesson_slug}`)}
                    trailingIcon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="mx-auto max-w-xl px-4 py-20 text-center">
              <h1 className="text-heading text-ink-900">No lessons yet</h1>
              <p className="mt-3 text-sm text-ink-600">
                This course does not have any published lessons at the moment.
              </p>
              <ButtonLink to={`/courses/${courseSlug}`} variant="outline" className="mt-6">
                Back to course page
              </ButtonLink>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
