import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, GripVertical, Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'

import { AdminPageHeader } from '@/components/admin/DataTable'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { DetailSkeleton, ErrorState } from '@/components/ui/states'
import {
  createCourse,
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  getAdminCourse,
  getCourseCategories,
  lookupCertifications,
  updateCourse,
} from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/queryClient'

const courseSchema = z.object({
  title: z.string().min(3, 'Give the course a title.').max(200),
  slug: z.string().max(220).optional(),
  short_description: z
    .string()
    .min(10, 'Write at least a sentence.')
    .max(320, 'Keep this under 320 characters.'),
  description: z.string().optional(),
  category_id: z.string().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
  currency: z.string().length(3),
  duration_minutes: z.coerce.number().min(0),
  learning_outcomes: z.string().optional(),
  requirements: z.string().optional(),
  meta_title: z.string().max(200).optional(),
  meta_description: z.string().max(320).optional(),
})

type CourseForm = z.infer<typeof courseSchema>

const lessonSchema = z.object({
  title: z.string().min(2, 'Give the lesson a title.').max(200),
  duration_minutes: z.coerce.number().min(0),
  content: z.string().optional(),
  video_url: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  is_preview: z.boolean().optional(),
})

type LessonForm = z.infer<typeof lessonSchema>

function toLines(value: string | undefined): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export default function AdminCourseEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [moduleTitle, setModuleTitle] = useState('')
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null)

  const { data: categories } = useQuery({
    queryKey: queryKeys.courseCategories,
    queryFn: getCourseCategories,
  })
  const { data: certifications } = useQuery({
    queryKey: ['admin', 'lookup', 'certifications'],
    queryFn: lookupCertifications,
  })
  const { data: course, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminCourse(id ?? ''),
    queryFn: () => getAdminCourse(id!),
    enabled: !isNew,
  })

  const [certificationIds, setCertificationIds] = useState<string[]>([])

  const form = useForm<CourseForm>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      level: 'beginner',
      currency: 'USD',
      price: 0,
      duration_minutes: 0,
    },
  })

  // Populate the form once the course loads.
  useEffect(() => {
    if (!course) return
    form.reset({
      title: course.title,
      slug: course.slug,
      short_description: course.short_description,
      description: course.description,
      category_id: course.category?.id ?? '',
      level: course.level,
      price: Number(course.price),
      currency: course.currency,
      duration_minutes: course.duration_minutes,
      learning_outcomes: course.learning_outcomes.join('\n'),
      requirements: course.requirements.join('\n'),
    })
    setCertificationIds(course.related_certifications.map((item) => item.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course])

  const save = useMutation({
    mutationFn: (values: CourseForm) => {
      const payload = {
        title: values.title,
        slug: values.slug || undefined,
        short_description: values.short_description,
        description: values.description ?? '',
        category_id: values.category_id || null,
        level: values.level,
        price: String(values.price),
        currency: values.currency,
        duration_minutes: values.duration_minutes,
        learning_outcomes: toLines(values.learning_outcomes),
        requirements: toLines(values.requirements),
        meta_title: values.meta_title || null,
        meta_description: values.meta_description || null,
        certification_ids: certificationIds,
      }
      return isNew ? createCourse(payload) : updateCourse(id!, payload)
    },
    onSuccess: (saved) => {
      toast.success(isNew ? 'Course created.' : 'Course saved.')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] })
      if (isNew) navigate(`/admin/courses/${saved.id}`, { replace: true })
      else void queryClient.invalidateQueries({ queryKey: queryKeys.adminCourse(id!) })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'We could not save the course.')
    },
  })

  const addModule = useMutation({
    mutationFn: () => createModule({ course_id: id!, title: moduleTitle }),
    onSuccess: () => {
      setModuleTitle('')
      toast.success('Module added.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCourse(id!) })
    },
    onError: () => toast.error('We could not add that module.'),
  })

  const removeModule = useMutation({
    mutationFn: (moduleId: string) => deleteModule(moduleId),
    onSuccess: () => {
      toast.success('Module deleted.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCourse(id!) })
    },
  })

  const removeLesson = useMutation({
    mutationFn: (lessonId: string) => deleteLesson(lessonId),
    onSuccess: () => {
      toast.success('Lesson deleted.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCourse(id!) })
    },
  })

  const lessonForm = useForm<LessonForm>({
    resolver: zodResolver(lessonSchema),
    defaultValues: { duration_minutes: 10 },
  })

  const addLesson = useMutation({
    mutationFn: (values: LessonForm) =>
      createLesson({
        module_id: lessonModuleId,
        title: values.title,
        duration_minutes: values.duration_minutes,
        content: values.content ?? '',
        video_url: values.video_url || null,
        is_preview: values.is_preview ?? false,
      }),
    onSuccess: () => {
      toast.success('Lesson added.')
      lessonForm.reset({ duration_minutes: 10 })
      setLessonModuleId(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCourse(id!) })
    },
    onError: () => toast.error('We could not add that lesson.'),
  })

  if (!isNew && isLoading) return <DetailSkeleton />
  if (!isNew && isError) return <ErrorState onRetry={() => void refetch()} />

  return (
    <>
      <AdminPageHeader
        title={isNew ? 'New course' : (course?.title ?? 'Edit course')}
        description={
          isNew
            ? 'Create the course, then add modules and lessons.'
            : 'Edit course details, curriculum and SEO metadata.'
        }
        actions={
          <ButtonLink
            to="/admin/courses"
            variant="outline"
            leadingIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Back
          </ButtonLink>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          className="space-y-6"
        >
          <Card className="p-6">
            <h2 className="text-base font-bold text-ink-900">Course details</h2>
            <div className="mt-5 space-y-5">
              <Field
                label="Title"
                htmlFor="title"
                required
                error={form.formState.errors.title?.message}
              >
                <Input id="title" {...form.register('title')} />
              </Field>

              <Field
                label="Slug"
                htmlFor="slug"
                hint="Leave blank to generate from the title."
                error={form.formState.errors.slug?.message}
              >
                <Input id="slug" {...form.register('slug')} />
              </Field>

              <Field
                label="Short description"
                htmlFor="short_description"
                required
                hint="Shown on cards and in search results."
                error={form.formState.errors.short_description?.message}
              >
                <Textarea id="short_description" rows={3} {...form.register('short_description')} />
              </Field>

              <Field label="Full description" htmlFor="description">
                <Textarea id="description" rows={8} {...form.register('description')} />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Category" htmlFor="category_id">
                  <Select id="category_id" {...form.register('category_id')}>
                    <option value="">No category</option>
                    {categories?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Level" htmlFor="level">
                  <Select id="level" {...form.register('level')}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </Select>
                </Field>
                <Field
                  label="Price"
                  htmlFor="price"
                  hint="Use 0 for a free course."
                  error={form.formState.errors.price?.message}
                >
                  <Input id="price" type="number" step="0.01" min="0" {...form.register('price')} />
                </Field>
                <Field label="Currency" htmlFor="currency">
                  <Input id="currency" maxLength={3} {...form.register('currency')} />
                </Field>
              </div>

              <Field
                label="Learning outcomes"
                htmlFor="learning_outcomes"
                hint="One per line."
              >
                <Textarea id="learning_outcomes" rows={5} {...form.register('learning_outcomes')} />
              </Field>

              <Field label="Requirements" htmlFor="requirements" hint="One per line.">
                <Textarea id="requirements" rows={4} {...form.register('requirements')} />
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-bold text-ink-900">SEO</h2>
            <p className="mt-1 text-sm text-ink-600">
              Leave blank to fall back to the title and short description.
            </p>
            <div className="mt-5 space-y-5">
              <Field label="SEO title" htmlFor="meta_title">
                <Input id="meta_title" {...form.register('meta_title')} />
              </Field>
              <Field label="Meta description" htmlFor="meta_description">
                <Textarea id="meta_description" rows={3} {...form.register('meta_description')} />
              </Field>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" size="lg" loading={save.isPending}>
              {isNew ? 'Create course' : 'Save changes'}
            </Button>
            {!isNew && course && (
              <ButtonLink to={`/courses/${course.slug}`} variant="outline" size="lg">
                View public page
              </ButtonLink>
            )}
          </div>
        </form>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-bold text-ink-900">Related certifications</h2>
            <p className="mt-1 text-sm text-ink-600">
              Links this course to certification preparation pages.
            </p>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {certifications?.map((certification) => (
                <label
                  key={certification.id}
                  className="flex items-start gap-2.5 rounded-lg border border-ink-200 p-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={certificationIds.includes(certification.id)}
                    onChange={(event) =>
                      setCertificationIds((current) =>
                        event.target.checked
                          ? [...current, certification.id]
                          : current.filter((item) => item !== certification.id),
                      )
                    }
                    className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600"
                  />
                  <span className="text-ink-700">{certification.name}</span>
                </label>
              ))}
            </div>
          </Card>

          {!isNew && (
            <Card className="p-6">
              <h2 className="text-base font-bold text-ink-900">Curriculum</h2>
              <p className="mt-1 text-sm text-ink-600">
                A course needs at least one module before it can be published.
              </p>

              <div className="mt-5 space-y-4">
                {course?.modules.map((module) => (
                  <div key={module.id} className="rounded-lg border border-ink-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {module.position}. {module.title}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => removeModule.mutate(module.id)}
                        aria-label={`Delete module ${module.title}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>

                    <ul className="mt-3 space-y-1.5">
                      {module.lessons.map((lesson) => (
                        <li
                          key={lesson.id}
                          className="flex items-center gap-2 rounded border border-ink-100 bg-ink-50 px-2.5 py-1.5 text-xs"
                        >
                          <span className="flex-1 truncate text-ink-700">{lesson.title}</span>
                          {lesson.is_preview && <Badge tone="brand">Preview</Badge>}
                          <span className="text-ink-500">{lesson.duration_minutes}m</span>
                          <button
                            type="button"
                            onClick={() => removeLesson.mutate(lesson.id)}
                            className="rounded p-1 text-rose-600 hover:bg-rose-50"
                            aria-label={`Delete lesson ${lesson.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                      {module.lessons.length === 0 && (
                        <li className="text-xs text-ink-500">No lessons yet.</li>
                      )}
                    </ul>

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setLessonModuleId(module.id)}
                      leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                    >
                      Add lesson
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex gap-2 border-t border-ink-200 pt-5">
                <Input
                  value={moduleTitle}
                  onChange={(event) => setModuleTitle(event.target.value)}
                  placeholder="New module title"
                  aria-label="New module title"
                />
                <Button
                  onClick={() => addModule.mutate()}
                  disabled={moduleTitle.trim().length < 2}
                  loading={addModule.isPending}
                >
                  Add
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(lessonModuleId)}
        onClose={() => setLessonModuleId(null)}
        title="Add a lesson"
        description="Lesson content supports Markdown."
        footer={
          <>
            <Button variant="outline" onClick={() => setLessonModuleId(null)}>
              Cancel
            </Button>
            <Button
              loading={addLesson.isPending}
              onClick={lessonForm.handleSubmit((values) => addLesson.mutate(values))}
            >
              Add lesson
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field
            label="Title"
            htmlFor="lesson-title"
            required
            error={lessonForm.formState.errors.title?.message}
          >
            <Input id="lesson-title" {...lessonForm.register('title')} />
          </Field>
          <Field
            label="Duration (minutes)"
            htmlFor="lesson-duration"
            error={lessonForm.formState.errors.duration_minutes?.message}
          >
            <Input
              id="lesson-duration"
              type="number"
              min="0"
              {...lessonForm.register('duration_minutes')}
            />
          </Field>
          <Field
            label="Video URL"
            htmlFor="lesson-video"
            hint="Optional embed URL."
            error={lessonForm.formState.errors.video_url?.message}
          >
            <Input id="lesson-video" {...lessonForm.register('video_url')} />
          </Field>
          <Field label="Content (Markdown)" htmlFor="lesson-content">
            <Textarea id="lesson-content" rows={8} {...lessonForm.register('content')} />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
              {...lessonForm.register('is_preview')}
            />
            Free preview lesson
          </label>
        </div>
      </Modal>
    </>
  )
}
