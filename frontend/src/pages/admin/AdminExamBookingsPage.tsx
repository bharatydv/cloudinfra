import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Trash2 } from 'lucide-react'

import { AdminPageHeader, DataTable, type Column } from '@/components/admin/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { deleteExamBooking, getAdminExamBookings, updateExamBooking } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import type { ExamBooking, ExamBookingStatus } from '@/types/api'

const STATUSES: Array<{ value: ExamBookingStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_TONES: Record<
  ExamBookingStatus,
  'warning' | 'brand' | 'success' | 'neutral' | 'danger'
> = {
  new: 'warning',
  contacted: 'brand',
  scheduled: 'success',
  completed: 'neutral',
  cancelled: 'danger',
}

const PAYMENT_TONES: Record<string, 'warning' | 'success' | 'neutral' | 'danger'> = {
  unpaid: 'neutral',
  pending: 'warning',
  successful: 'success',
  failed: 'danger',
  refunded: 'neutral',
}

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'No payment',
  pending: 'Awaiting payment',
  successful: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
}

const DELIVERY_LABELS: Record<string, string> = {
  online_proctored: 'Online proctored',
  test_center: 'Test centre',
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: 'Morning (9am - 12pm)',
  afternoon: 'Afternoon (12pm - 4pm)',
  evening: 'Evening (4pm - 8pm)',
}

export default function AdminExamBookingsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<ExamBooking | null>(null)
  const [notes, setNotes] = useState('')
  const queryClient = useQueryClient()
  const toast = useToast()
  const debouncedSearch = useDebounce(search, 300)

  const query = {
    page,
    q: debouncedSearch || undefined,
    booking_status: statusFilter || undefined,
  }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminExamBookings(query),
    queryFn: () => getAdminExamBookings(query),
    placeholderData: keepPreviousData,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'exam-bookings'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard })
  }

  const update = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: { status?: string; admin_notes?: string }
    }) => updateExamBooking(id, payload),
    onSuccess: (booking) => {
      toast.success('Exam request updated.')
      // Keep the open drawer in step with what was just saved.
      setSelected((current) => (current?.id === booking.id ? booking : current))
      invalidate()
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : 'We could not update that request.',
      ),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteExamBooking(id),
    onSuccess: () => {
      toast.success('Exam request deleted.')
      setSelected(null)
      invalidate()
    },
    onError: () => toast.error('We could not delete that request.'),
  })

  function openDetail(booking: ExamBooking) {
    setSelected(booking)
    setNotes(booking.admin_notes ?? '')
  }

  const columns: Column<ExamBooking>[] = [
    {
      key: 'applicant',
      header: 'Applicant',
      render: (booking) => (
        <button type="button" onClick={() => openDetail(booking)} className="block min-w-0 text-left">
          <span className="block truncate font-semibold text-ink-900">{booking.full_name}</span>
          <span className="block truncate text-xs text-ink-500">
            {booking.reference_code} &middot; {booking.email}
          </span>
        </button>
      ),
    },
    {
      key: 'certification',
      header: 'Certification',
      render: (booking) => (
        <div className="min-w-0">
          <p className="truncate text-ink-800">{booking.certification_name}</p>
          <p className="truncate text-xs text-ink-500">
            {booking.exam_code ? `${booking.exam_code} · ` : ''}
            {DELIVERY_LABELS[booking.delivery_mode] ?? booking.delivery_mode}
          </p>
        </div>
      ),
    },
    {
      key: 'when',
      header: 'Preferred',
      render: (booking) => (
        <div>
          <p className="text-ink-800">{formatDate(booking.preferred_date)}</p>
          <p className="text-xs text-ink-500">
            {TIME_SLOT_LABELS[booking.preferred_time_slot] ?? booking.preferred_time_slot}
          </p>
        </div>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (booking) => (
        <Badge tone={PAYMENT_TONES[booking.payment_status] ?? 'neutral'}>
          {PAYMENT_LABELS[booking.payment_status] ?? booking.payment_status}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => (
        <Select
          value={booking.status}
          aria-label={`Status for ${booking.reference_code}`}
          onChange={(event) =>
            update.mutate({ id: booking.id, payload: { status: event.target.value } })
          }
          className="h-9 max-w-[10rem] text-xs"
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (booking) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-600 hover:bg-rose-50"
          onClick={() => remove.mutate(booking.id)}
          aria-label={`Delete request ${booking.reference_code}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Exam requests"
        description={
          data
            ? `${data.total} ${data.total === 1 ? 'request' : 'requests'} matching this view.`
            : 'Scheduling requests submitted from the site, newest first.'
        }
      />

      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field label="Search" htmlFor="booking-search">
            <Input
              id="booking-search"
              type="search"
              placeholder="Name, email, reference or certification"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </Field>
        </div>
        <div className="sm:w-56">
          <Field label="Status" htmlFor="booking-status">
            <Select
              id="booking-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All statuses</option>
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <DataTable
        caption="Exam scheduling requests"
        columns={columns}
        rows={data?.items}
        rowKey={(booking) => booking.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle={search || statusFilter ? 'No matching requests' : 'No exam requests yet'}
        emptyDescription={
          search || statusFilter
            ? 'Try a different search or status filter.'
            : 'Requests submitted through the schedule-an-exam form appear here.'
        }
        page={data?.page}
        totalPages={data?.total_pages}
        onPageChange={setPage}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.certification_name ?? ''}
        description={selected ? `${selected.reference_code} · ${selected.full_name}` : undefined}
        size="lg"
        footer={
          selected && (
            <>
              <a
                href={`mailto:${selected.email}?subject=${encodeURIComponent(
                  `Your exam request ${selected.reference_code}`,
                )}`}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-ink-300 px-5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Reply by email
              </a>
              <Button
                loading={update.isPending}
                onClick={() => update.mutate({ id: selected.id, payload: { admin_notes: notes } })}
              >
                Save notes
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONES[selected.status]}>{selected.status}</Badge>
              <Badge tone="outline">
                {DELIVERY_LABELS[selected.delivery_mode] ?? selected.delivery_mode}
              </Badge>
              {selected.exam_code && <Badge tone="neutral">Exam {selected.exam_code}</Badge>}
              <Badge tone={PAYMENT_TONES[selected.payment_status] ?? 'neutral'}>
                {PAYMENT_LABELS[selected.payment_status] ?? selected.payment_status}
              </Badge>
              {/* Anonymous requests are the norm; flag the ones tied to an account. */}
              {selected.user_id && <Badge tone="brand">Registered account</Badge>}
            </div>

            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="Phone" value={selected.phone} />
              <DetailRow
                label="Location"
                value={[selected.city, selected.country].filter(Boolean).join(', ')}
              />
              <DetailRow label="Timezone" value={selected.timezone} />
              <DetailRow label="Preferred date" value={formatDate(selected.preferred_date)} />
              <DetailRow
                label="Alternate date"
                value={selected.alternate_date ? formatDate(selected.alternate_date) : 'Not given'}
              />
              <DetailRow
                label="Preferred time"
                value={
                  TIME_SLOT_LABELS[selected.preferred_time_slot] ?? selected.preferred_time_slot
                }
              />
              <DetailRow label="Submitted" value={formatDate(selected.created_at)} />
            </dl>

            <Field label="Internal notes" htmlFor="booking-notes">
              <Textarea
                id="booking-notes"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Availability checked, provider booking reference, follow-ups..."
              />
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-800">{value || '--'}</dd>
    </div>
  )
}
