import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Plus, Trash2 } from 'lucide-react'

import { AdminPageHeader, DataTable, type Column } from '@/components/admin/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import {
  createFaq,
  createTestimonial,
  deleteFaq,
  deleteMessage,
  deleteTestimonial,
  getAdminEnrollments,
  getAdminFaqs,
  getAdminMessages,
  getAdminPayments,
  getAdminSettings,
  getAdminTestimonials,
  getAdminUsers,
  getArticleCategories,
  getCourseCategories,
  updateAdminUser,
  updateMessage,
  updateSetting,
} from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatDate, formatPrice } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import type {
  ContactMessage,
  Enrollment,
  Faq,
  Payment,
  SiteSetting,
  Testimonial,
  User,
} from '@/types/api'

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */
export function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user: currentUser } = useAuth()

  const query = { page }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminUsers(query),
    queryFn: () => getAdminUsers(query),
    placeholderData: keepPreviousData,
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { role?: string; is_active?: boolean } }) =>
      updateAdminUser(id, payload),
    onSuccess: () => {
      toast.success('User updated.')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'We could not update that user.'),
  })

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'User',
      render: (user) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-900">{user.name}</p>
          <p className="truncate text-xs text-ink-500">{user.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => (
        <Select
          value={user.role}
          aria-label={`Role for ${user.name}`}
          disabled={user.id === currentUser?.id}
          onChange={(event) => update.mutate({ id: user.id, payload: { role: event.target.value } })}
          className="h-9 max-w-[10rem] text-xs"
        >
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="admin">Admin</option>
        </Select>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <Badge tone={user.is_active ? 'success' : 'danger'}>
          {user.is_active ? 'Active' : 'Deactivated'}
        </Badge>
      ),
    },
    { key: 'joined', header: 'Joined', render: (user) => formatDate(user.created_at) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (user) => (
        <Button
          variant="outline"
          size="sm"
          disabled={user.id === currentUser?.id}
          onClick={() => update.mutate({ id: user.id, payload: { is_active: !user.is_active } })}
        >
          {user.is_active ? 'Deactivate' : 'Reactivate'}
        </Button>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader title="Users" description="Manage roles and account status." />
      <DataTable
        caption="Users"
        columns={columns}
        rows={data?.items}
        rowKey={(user) => user.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No users yet"
        page={data?.page}
        totalPages={data?.total_pages}
        onPageChange={setPage}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Enrollments                                                                */
/* -------------------------------------------------------------------------- */
export function AdminEnrollmentsPage() {
  const [page, setPage] = useState(1)
  const query = { page }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminEnrollments(query),
    queryFn: () => getAdminEnrollments(query),
    placeholderData: keepPreviousData,
  })

  const columns: Column<Enrollment>[] = [
    { key: 'id', header: 'Enrollment', render: (row) => row.id.slice(0, 8) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'completed' ? 'success' : 'brand'}>{row.status}</Badge>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      align: 'right',
      render: (row) => `${row.progress_percentage}%`,
    },
    { key: 'enrolled', header: 'Enrolled', render: (row) => formatDate(row.enrolled_at) },
    {
      key: 'completed',
      header: 'Completed',
      render: (row) => (row.completed_at ? formatDate(row.completed_at) : '-'),
    },
  ]

  return (
    <>
      <AdminPageHeader title="Enrollments" description="Every enrollment across the platform." />
      <DataTable
        caption="Enrollments"
        columns={columns}
        rows={data?.items}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No enrollments yet"
        page={data?.page}
        totalPages={data?.total_pages}
        onPageChange={setPage}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */
export function AdminPaymentsPage() {
  const [page, setPage] = useState(1)
  const query = { page }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminPayments(query),
    queryFn: () => getAdminPayments(query),
    placeholderData: keepPreviousData,
  })

  const columns: Column<Payment>[] = [
    { key: 'id', header: 'Payment', render: (row) => row.id.slice(0, 8) },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => formatPrice(row.amount, row.currency),
    },
    { key: 'provider', header: 'Provider', render: (row) => row.payment_provider },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          tone={
            row.status === 'successful'
              ? 'success'
              : row.status === 'failed'
                ? 'danger'
                : row.status === 'refunded'
                  ? 'warning'
                  : 'neutral'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    { key: 'created', header: 'Created', render: (row) => formatDate(row.created_at) },
    { key: 'paid', header: 'Paid', render: (row) => (row.paid_at ? formatDate(row.paid_at) : '-') },
  ]

  return (
    <>
      <AdminPageHeader
        title="Payments"
        description="Payment status is written only by verified provider webhooks."
      />
      <DataTable
        caption="Payments"
        columns={columns}
        rows={data?.items}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No payments yet"
        emptyDescription="Payments appear here once a provider is configured and a checkout completes."
        page={data?.page}
        totalPages={data?.total_pages}
        onPageChange={setPage}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */
export function AdminMessagesPage() {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const queryClient = useQueryClient()
  const toast = useToast()

  const query = { page }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminMessages(query),
    queryFn: () => getAdminMessages(query),
    placeholderData: keepPreviousData,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'messages'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard })
  }

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateMessage(id, { status }),
    onSuccess: () => {
      toast.success('Message updated.')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteMessage(id),
    onSuccess: () => {
      toast.success('Message deleted.')
      setSelected(null)
      invalidate()
    },
  })

  const columns: Column<ContactMessage>[] = [
    {
      key: 'subject',
      header: 'Message',
      render: (message) => (
        <button
          type="button"
          onClick={() => {
            setSelected(message)
            if (message.status === 'new') {
              setStatus.mutate({ id: message.id, status: 'read' })
            }
          }}
          className="block min-w-0 text-left"
        >
          <span className="block truncate font-semibold text-ink-900">{message.subject}</span>
          <span className="block truncate text-xs text-ink-500">
            {message.name} &lt;{message.email}&gt;
          </span>
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (message) => (
        <Badge
          tone={
            message.status === 'new' ? 'warning' : message.status === 'resolved' ? 'success' : 'neutral'
          }
        >
          {message.status}
        </Badge>
      ),
    },
    { key: 'received', header: 'Received', render: (message) => formatDate(message.created_at) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (message) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatus.mutate({ id: message.id, status: 'resolved' })}
            disabled={message.status === 'resolved'}
          >
            Resolve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:bg-rose-50"
            onClick={() => remove.mutate(message.id)}
            aria-label={`Delete message from ${message.name}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader title="Contact messages" description="Enquiries from the contact form." />
      <DataTable
        caption="Contact messages"
        columns={columns}
        rows={data?.items}
        rowKey={(message) => message.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="Inbox empty"
        emptyDescription="Messages submitted through the contact form appear here."
        page={data?.page}
        totalPages={data?.total_pages}
        onPageChange={setPage}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.subject ?? ''}
        description={selected ? `${selected.name} <${selected.email}>` : undefined}
        footer={
          selected && (
            <>
              <a
                href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-ink-300 px-5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Reply by email
              </a>
              <Button onClick={() => setStatus.mutate({ id: selected.id, status: 'resolved' })}>
                Mark resolved
              </Button>
            </>
          )
        }
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
          {selected?.message}
        </p>
      </Modal>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* FAQs                                                                       */
/* -------------------------------------------------------------------------- */
export function AdminFaqsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [category, setCategory] = useState('home')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminFaqs,
    queryFn: getAdminFaqs,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] })
    void queryClient.invalidateQueries({ queryKey: ['faqs'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.home })
  }

  const create = useMutation({
    mutationFn: () => createFaq({ question, answer, category }),
    onSuccess: () => {
      toast.success('FAQ added.')
      setOpen(false)
      setQuestion('')
      setAnswer('')
      invalidate()
    },
    onError: () => toast.error('We could not add that FAQ.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteFaq(id),
    onSuccess: () => {
      toast.success('FAQ deleted.')
      invalidate()
    },
  })

  const columns: Column<Faq>[] = [
    {
      key: 'question',
      header: 'Question',
      render: (faq) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{faq.question}</p>
          <p className="line-clamp-2 text-xs text-ink-500">{faq.answer}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Scope', render: (faq) => <Badge tone="neutral">{faq.category}</Badge> },
    { key: 'position', header: 'Position', align: 'right', render: (faq) => faq.position },
    {
      key: 'status',
      header: 'Status',
      render: (faq) => (
        <Badge tone={faq.is_published ? 'success' : 'neutral'}>
          {faq.is_published ? 'Published' : 'Hidden'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (faq) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-600 hover:bg-rose-50"
          onClick={() => remove.mutate(faq.id)}
          aria-label={`Delete FAQ: ${faq.question}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="FAQs"
        description="Scope controls where an FAQ appears: home, courses, certifications or about."
        actions={
          <Button onClick={() => setOpen(true)} leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
            New FAQ
          </Button>
        }
      />
      <DataTable
        caption="FAQs"
        columns={columns}
        rows={data}
        rowKey={(faq) => faq.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No FAQs yet"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add an FAQ"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={question.trim().length < 3 || answer.trim().length < 3}
              onClick={() => create.mutate()}
            >
              Add FAQ
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Question" htmlFor="faq-question" required>
            <Input
              id="faq-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </Field>
          <Field label="Answer" htmlFor="faq-answer" required>
            <Textarea
              id="faq-answer"
              rows={5}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
            />
          </Field>
          <Field label="Scope" htmlFor="faq-category">
            <Select
              id="faq-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="home">Homepage</option>
              <option value="courses">Courses</option>
              <option value="certifications">Certifications</option>
              <option value="about">About</option>
              <option value="general">General</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Testimonials                                                               */
/* -------------------------------------------------------------------------- */
export function AdminTestimonialsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [content, setContent] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminTestimonials,
    queryFn: getAdminTestimonials,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'testimonials'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.home })
  }

  const create = useMutation({
    mutationFn: () =>
      createTestimonial({
        user_name: name,
        role: role || null,
        content,
        rating: 5,
        // Real, attributed quotes only. Demo rows are flagged by the seeder.
        is_published: true,
        is_demo: false,
      }),
    onSuccess: () => {
      toast.success('Testimonial added.')
      setOpen(false)
      setName('')
      setRole('')
      setContent('')
      invalidate()
    },
    onError: () => toast.error('We could not add that testimonial.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteTestimonial(id),
    onSuccess: () => {
      toast.success('Testimonial deleted.')
      invalidate()
    },
  })

  const columns: Column<Testimonial>[] = [
    {
      key: 'name',
      header: 'Person',
      render: (item) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{item.user_name}</p>
          {item.role && <p className="text-xs text-ink-500">{item.role}</p>}
        </div>
      ),
    },
    {
      key: 'content',
      header: 'Quote',
      render: (item) => <p className="line-clamp-2 max-w-md text-xs text-ink-600">{item.content}</p>,
    },
    { key: 'rating', header: 'Rating', align: 'right', render: (item) => `${item.rating}/5` },
    {
      key: 'demo',
      header: 'Type',
      render: (item) =>
        item.is_demo ? <Badge tone="warning">Demo</Badge> : <Badge tone="success">Real</Badge>,
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
          aria-label={`Delete testimonial from ${item.user_name}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Testimonials"
        description="Only publish quotes you have permission to use and can attribute."
        actions={
          <Button onClick={() => setOpen(true)} leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
            New testimonial
          </Button>
        }
      />

      <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
        <p className="text-xs leading-relaxed text-amber-900">
          Rows marked <strong>Demo</strong> are seeded placeholders. They are labelled as demo
          content on the public site. Delete them before launch.
        </p>
      </Card>

      <DataTable
        caption="Testimonials"
        columns={columns}
        rows={data}
        rowKey={(item) => item.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No testimonials yet"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a testimonial"
        description="Use a real, attributed quote."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={name.trim().length < 2 || content.trim().length < 10}
              onClick={() => create.mutate()}
            >
              Add testimonial
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name" htmlFor="testimonial-name" required>
            <Input
              id="testimonial-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Role" htmlFor="testimonial-role">
            <Input
              id="testimonial-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            />
          </Field>
          <Field label="Quote" htmlFor="testimonial-content" required>
            <Textarea
              id="testimonial-content"
              rows={5}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Categories (read-only overview)                                            */
/* -------------------------------------------------------------------------- */
export function AdminCategoriesPage() {
  const { data: courseCategories, isLoading: loadingCourses } = useQuery({
    queryKey: queryKeys.courseCategories,
    queryFn: getCourseCategories,
  })
  const { data: articleCategories, isLoading: loadingArticles } = useQuery({
    queryKey: queryKeys.articleCategories,
    queryFn: getArticleCategories,
  })

  return (
    <>
      <AdminPageHeader
        title="Categories"
        description="Taxonomy used across courses and resources."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-bold text-ink-900">Course categories</h2>
          <ul className="mt-4 divide-y divide-ink-200">
            {loadingCourses && <li className="py-3 text-sm text-ink-500">Loading...</li>}
            {courseCategories?.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{category.name}</p>
                  <p className="text-xs text-ink-500">/{category.slug}</p>
                </div>
                <Badge tone="neutral">{category.course_count} courses</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-bold text-ink-900">Resource categories</h2>
          <ul className="mt-4 divide-y divide-ink-200">
            {loadingArticles && <li className="py-3 text-sm text-ink-500">Loading...</li>}
            {articleCategories?.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{category.name}</p>
                  <p className="text-xs text-ink-500">/{category.slug}</p>
                </div>
                <Badge tone="neutral">{category.article_count} articles</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */
export function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState<SiteSetting | null>(null)
  const [draft, setDraft] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminSettings,
    queryFn: getAdminSettings,
  })

  const save = useMutation({
    mutationFn: () => {
      const value = JSON.parse(draft) as Record<string, unknown>
      return updateSetting(editing!.key, { value, is_public: editing!.is_public })
    },
    onSuccess: () => {
      toast.success('Setting saved.')
      setEditing(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
    },
    onError: () => toast.error('We could not save that setting.'),
  })

  const columns: Column<SiteSetting>[] = [
    {
      key: 'key',
      header: 'Key',
      render: (setting) => (
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-ink-900">{setting.key}</p>
          {setting.description && <p className="text-xs text-ink-500">{setting.description}</p>}
        </div>
      ),
    },
    {
      key: 'visibility',
      header: 'Visibility',
      render: (setting) => (
        <Badge tone={setting.is_public ? 'success' : 'neutral'}>
          {setting.is_public ? 'Public' : 'Private'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (setting) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(setting)
            setDraft(JSON.stringify(setting.value, null, 2))
            setParseError(null)
          }}
        >
          Edit
        </Button>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Site settings"
        description="Brand, contact details, about copy and legal pages. Editing these changes the public site without a deploy."
      />

      <DataTable
        caption="Site settings"
        columns={columns}
        rows={data}
        rowKey={(setting) => setting.key}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No settings configured"
        emptyDescription="Run the seed script to create the default settings."
      />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.key ?? ''}`}
        description="Values are stored as JSON."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              onClick={() => {
                try {
                  JSON.parse(draft)
                  setParseError(null)
                  save.mutate()
                } catch {
                  setParseError('That is not valid JSON.')
                }
              }}
            >
              Save setting
            </Button>
          </>
        }
      >
        {parseError && (
          <p role="alert" className="mb-3 text-sm font-medium text-rose-700">
            {parseError}
          </p>
        )}
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={20}
          className="font-mono text-xs"
          aria-label="Setting value as JSON"
        />
      </Modal>
    </>
  )
}
