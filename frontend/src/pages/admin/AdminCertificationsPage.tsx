import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'

import { AdminPageHeader, DataTable, type Column } from '@/components/admin/DataTable'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { DetailSkeleton, ErrorState } from '@/components/ui/states'
import {
  createCertification,
  createCertificationResource,
  createProvider,
  deleteCertification,
  deleteProvider,
  getAdminCertification,
  getAdminCertifications,
  getProviders,
  lookupCourses,
  updateCertification,
} from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/useToast'
import { formatLevel } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import type { CertificationCard, ProviderCard } from '@/types/api'

/* -------------------------------------------------------------------------- */
/* Certification listing                                                      */
/* -------------------------------------------------------------------------- */
export function AdminCertificationsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<CertificationCard | null>(null)
  const debounced = useDebounce(search)
  const queryClient = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()

  const query = { page, q: debounced || undefined }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminCertifications(query),
    queryFn: () => getAdminCertifications(query),
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteCertification(id),
    onSuccess: () => {
      toast.success('Certification deleted.')
      setPendingDelete(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'certifications'] })
      void queryClient.invalidateQueries({ queryKey: ['certifications'] })
    },
    onError: () => toast.error('We could not delete that certification.'),
  })

  const columns: Column<CertificationCard>[] = [
    {
      key: 'name',
      header: 'Certification',
      render: (item) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/admin/certifications/${item.id}`)}
            className="block truncate text-left font-semibold text-ink-900 hover:text-brand-700"
          >
            {item.name}
          </button>
          <span className="text-xs text-ink-500">{item.provider_name}</span>
        </div>
      ),
    },
    { key: 'code', header: 'Exam code', render: (item) => item.exam_code ?? '-' },
    { key: 'level', header: 'Level', render: (item) => formatLevel(item.level) },
    { key: 'category', header: 'Category', render: (item) => item.category ?? '-' },
    {
      key: 'courses',
      header: 'Courses',
      align: 'right',
      render: (item) => item.course_count,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/certifications/${item.id}`)}
            aria-label={`Edit ${item.name}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:bg-rose-50"
            onClick={() => setPendingDelete(item)}
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Certifications"
        description="Manage certification pages, exam topics and preparation roadmaps."
        actions={
          <ButtonLink
            to="/admin/certifications/new"
            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            New certification
          </ButtonLink>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Search certifications"
          aria-label="Search certifications"
        />
      </div>

      <DataTable
        caption="Certifications"
        columns={columns}
        rows={data?.items}
        rowKey={(item) => item.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No certifications yet"
        emptyDescription="Add a provider first, then create certifications under it."
        emptyAction={<ButtonLink to="/admin/providers">Manage providers</ButtonLink>}
        page={data?.page}
        totalPages={data?.total_pages}
        onPageChange={setPage}
      />

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this certification?"
        description="Its resources will be removed too. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          You are about to delete{' '}
          <strong className="font-semibold text-ink-900">{pendingDelete?.name}</strong>.
        </p>
      </Modal>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Certification editor                                                       */
/* -------------------------------------------------------------------------- */
const certificationSchema = z.object({
  provider_id: z.string().min(1, 'Choose a provider.'),
  name: z.string().min(2, 'Give the certification a name.').max(200),
  slug: z.string().max(220).optional(),
  short_description: z.string().max(320).optional(),
  description: z.string().optional(),
  exam_code: z.string().max(60).optional(),
  level: z.enum(['foundational', 'associate', 'professional', 'specialty', 'expert']),
  category: z.string().max(80).optional(),
  skills: z.string().optional(),
  audience: z.string().optional(),
  recommended_experience: z.string().optional(),
  exam_duration_minutes: z.coerce.number().min(0).optional(),
  exam_format: z.string().max(160).optional(),
  official_url: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  is_published: z.boolean().optional(),
  is_featured: z.boolean().optional(),
})

type CertificationForm = z.infer<typeof certificationSchema>

export function AdminCertificationEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [courseIds, setCourseIds] = useState<string[]>([])
  const [resourceOpen, setResourceOpen] = useState(false)
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceType, setResourceType] = useState('guide')

  const { data: providers } = useQuery({ queryKey: queryKeys.providers, queryFn: getProviders })
  const { data: courses } = useQuery({
    queryKey: ['admin', 'lookup', 'courses'],
    queryFn: lookupCourses,
  })
  const { data: certification, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'certification', id],
    queryFn: () => getAdminCertification(id!),
    enabled: !isNew,
  })

  const form = useForm<CertificationForm>({
    resolver: zodResolver(certificationSchema),
    defaultValues: { level: 'associate', is_published: true },
  })

  useEffect(() => {
    if (!certification) return
    form.reset({
      provider_id: certification.provider_id,
      name: certification.name,
      slug: certification.slug,
      short_description: certification.short_description,
      description: certification.description,
      exam_code: certification.exam_code ?? '',
      level: certification.level,
      category: certification.category ?? '',
      skills: certification.skills.join(', '),
      audience: certification.audience ?? '',
      recommended_experience: certification.recommended_experience ?? '',
      exam_duration_minutes: certification.exam_duration_minutes ?? 0,
      exam_format: certification.exam_format ?? '',
      official_url: certification.official_url ?? '',
    })
    setCourseIds(certification.related_courses.map((course) => course.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certification])

  const save = useMutation({
    mutationFn: (values: CertificationForm) => {
      const payload = {
        provider_id: values.provider_id,
        name: values.name,
        slug: values.slug || undefined,
        short_description: values.short_description ?? '',
        description: values.description ?? '',
        exam_code: values.exam_code || null,
        level: values.level,
        category: values.category || null,
        skills: (values.skills ?? '')
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
        audience: values.audience || null,
        recommended_experience: values.recommended_experience || null,
        exam_duration_minutes: values.exam_duration_minutes || null,
        exam_format: values.exam_format || null,
        official_url: values.official_url || null,
        is_published: values.is_published ?? true,
        is_featured: values.is_featured ?? false,
        course_ids: courseIds,
      }
      return isNew ? createCertification(payload) : updateCertification(id!, payload)
    },
    onSuccess: (saved) => {
      toast.success(isNew ? 'Certification created.' : 'Certification saved.')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'certifications'] })
      if (isNew) navigate(`/admin/certifications/${saved.id}`, { replace: true })
      else void queryClient.invalidateQueries({ queryKey: ['admin', 'certification', id] })
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'We could not save this.'),
  })

  const addResource = useMutation({
    mutationFn: () =>
      createCertificationResource({
        certification_id: id,
        title: resourceTitle,
        resource_type: resourceType,
      }),
    onSuccess: () => {
      toast.success('Resource added.')
      setResourceOpen(false)
      setResourceTitle('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'certification', id] })
    },
    onError: () => toast.error('We could not add that resource.'),
  })

  if (!isNew && isLoading) return <DetailSkeleton />
  if (!isNew && isError) return <ErrorState onRetry={() => void refetch()} />

  return (
    <>
      <AdminPageHeader
        title={isNew ? 'New certification' : (certification?.name ?? 'Edit certification')}
        description="Describe what the preparation material covers. Do not claim vendor affiliation."
        actions={
          <ButtonLink
            to="/admin/certifications"
            variant="outline"
            leadingIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Back
          </ButtonLink>
        }
      />

      <form
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="grid gap-6 xl:grid-cols-[1.6fr_1fr]"
      >
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-bold text-ink-900">Details</h2>
            <div className="mt-5 space-y-5">
              <Field
                label="Provider"
                htmlFor="cert-provider"
                required
                error={form.formState.errors.provider_id?.message}
              >
                <Select id="cert-provider" {...form.register('provider_id')}>
                  <option value="">Select a provider</option>
                  {providers?.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Name"
                htmlFor="cert-name"
                required
                error={form.formState.errors.name?.message}
              >
                <Input id="cert-name" {...form.register('name')} />
              </Field>
              <Field label="Slug" htmlFor="cert-slug" hint="Leave blank to generate.">
                <Input id="cert-slug" {...form.register('slug')} />
              </Field>
              <Field label="Short description" htmlFor="cert-short">
                <Textarea id="cert-short" rows={3} {...form.register('short_description')} />
              </Field>
              <Field
                label="Overview (Markdown)"
                htmlFor="cert-description"
                hint="Include an independence note where relevant."
              >
                <Textarea id="cert-description" rows={12} {...form.register('description')} />
              </Field>
              <Field label="Who should take this?" htmlFor="cert-audience">
                <Textarea id="cert-audience" rows={3} {...form.register('audience')} />
              </Field>
              <Field label="Recommended experience" htmlFor="cert-experience">
                <Textarea id="cert-experience" rows={3} {...form.register('recommended_experience')} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-bold text-ink-900">Exam information</h2>
            <div className="mt-5 space-y-5">
              <Field label="Exam code" htmlFor="cert-code">
                <Input id="cert-code" {...form.register('exam_code')} />
              </Field>
              <Field label="Level" htmlFor="cert-level">
                <Select id="cert-level" {...form.register('level')}>
                  <option value="foundational">Foundational</option>
                  <option value="associate">Associate</option>
                  <option value="professional">Professional</option>
                  <option value="specialty">Specialty</option>
                  <option value="expert">Expert</option>
                </Select>
              </Field>
              <Field label="Category" htmlFor="cert-category">
                <Input id="cert-category" {...form.register('category')} />
              </Field>
              <Field label="Skills" htmlFor="cert-skills" hint="Comma separated.">
                <Input id="cert-skills" {...form.register('skills')} />
              </Field>
              <Field label="Exam duration (minutes)" htmlFor="cert-duration">
                <Input
                  id="cert-duration"
                  type="number"
                  min="0"
                  {...form.register('exam_duration_minutes')}
                />
              </Field>
              <Field label="Exam format" htmlFor="cert-format">
                <Input id="cert-format" {...form.register('exam_format')} />
              </Field>
              <Field
                label="Official exam URL"
                htmlFor="cert-url"
                hint="Linked as the authoritative source."
                error={form.formState.errors.official_url?.message}
              >
                <Input id="cert-url" {...form.register('official_url')} />
              </Field>

              <div className="space-y-2.5 border-t border-ink-200 pt-4">
                <label className="flex items-center gap-2.5 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 text-brand-600"
                    {...form.register('is_published')}
                  />
                  Published
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 text-brand-600"
                    {...form.register('is_featured')}
                  />
                  Featured on the homepage
                </label>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-bold text-ink-900">Related courses</h2>
            <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
              {courses?.map((course) => (
                <label
                  key={course.id}
                  className="flex items-start gap-2.5 rounded-lg border border-ink-200 p-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={courseIds.includes(course.id)}
                    onChange={(event) =>
                      setCourseIds((current) =>
                        event.target.checked
                          ? [...current, course.id]
                          : current.filter((item) => item !== course.id),
                      )
                    }
                    className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600"
                  />
                  <span className="text-ink-700">{course.title}</span>
                </label>
              ))}
            </div>
          </Card>

          {!isNew && (
            <Card className="p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-ink-900">Resources</h2>
                <Button variant="outline" size="sm" onClick={() => setResourceOpen(true)}>
                  Add
                </Button>
              </div>
              <ul className="mt-4 space-y-2">
                {certification?.resources.map((resource) => (
                  <li
                    key={resource.id}
                    className="flex items-center gap-2 rounded-lg border border-ink-200 p-2.5 text-sm"
                  >
                    <span className="flex-1 truncate text-ink-700">{resource.title}</span>
                    <Badge tone="neutral">{resource.resource_type}</Badge>
                  </li>
                ))}
                {certification?.resources.length === 0 && (
                  <li className="text-sm text-ink-500">No resources yet.</li>
                )}
              </ul>
            </Card>
          )}

          <Button type="submit" size="lg" fullWidth loading={save.isPending}>
            {isNew ? 'Create certification' : 'Save changes'}
          </Button>
        </div>
      </form>

      <Modal
        open={resourceOpen}
        onClose={() => setResourceOpen(false)}
        title="Add a study resource"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setResourceOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={addResource.isPending}
              disabled={resourceTitle.trim().length < 2}
              onClick={() => addResource.mutate()}
            >
              Add resource
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Title" htmlFor="resource-title" required>
            <Input
              id="resource-title"
              value={resourceTitle}
              onChange={(event) => setResourceTitle(event.target.value)}
            />
          </Field>
          <Field label="Type" htmlFor="resource-type">
            <Select
              id="resource-type"
              value={resourceType}
              onChange={(event) => setResourceType(event.target.value)}
            >
              <option value="guide">Guide</option>
              <option value="roadmap">Roadmap</option>
              <option value="practice">Practice</option>
              <option value="cheatsheet">Cheat sheet</option>
              <option value="exam_topic">Exam topic</option>
              <option value="external">External link</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Providers                                                                  */
/* -------------------------------------------------------------------------- */
export function AdminProvidersPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.providers,
    queryFn: getProviders,
  })

  const create = useMutation({
    mutationFn: () => createProvider({ name, website_url: website || null }),
    onSuccess: () => {
      toast.success('Provider added.')
      setOpen(false)
      setName('')
      setWebsite('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.providers })
    },
    onError: () => toast.error('We could not add that provider.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: () => {
      toast.success('Provider deleted.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.providers })
    },
    onError: () => toast.error('We could not delete that provider.'),
  })

  const columns: Column<ProviderCard>[] = [
    { key: 'name', header: 'Provider', render: (item) => item.name },
    { key: 'slug', header: 'Slug', render: (item) => `/${item.slug}` },
    {
      key: 'count',
      header: 'Certifications',
      align: 'right',
      render: (item) => item.certification_count,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-600 hover:bg-rose-50"
          onClick={() => remove.mutate(item.id)}
          aria-label={`Delete ${item.name}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Certification providers"
        description="Vendors whose certifications we publish preparation material for."
        actions={
          <Button
            onClick={() => setOpen(true)}
            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            New provider
          </Button>
        }
      />

      <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
        <p className="text-xs leading-relaxed text-amber-900">
          Providers are marked as independent by default. Only mark one as an authorised partner
          when there is a documented agreement.
        </p>
      </Card>

      <DataTable
        caption="Certification providers"
        columns={columns}
        rows={data}
        rowKey={(item) => item.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No providers yet"
        emptyDescription="Add a provider before creating certifications."
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a provider"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={name.trim().length < 2}
              onClick={() => create.mutate()}
            >
              Add provider
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name" htmlFor="provider-name" required>
            <Input
              id="provider-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field
            label="Website"
            htmlFor="provider-website"
            hint="Link to the vendor's own certification page."
          >
            <Input
              id="provider-website"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}
