import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Phone, ShieldAlert, Trash2 } from 'lucide-react'

import { AdminPageHeader, DataTable, type Column } from '@/components/admin/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import {
  deleteChallengeAttempt,
  getAdminChallengeAttempts,
  updateChallengeAttempt,
} from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import type { ChallengeAttempt, ChallengeLeadStatus } from '@/types/api'

const LEAD_STATUSES: Array<{ value: ChallengeLeadStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'scheduled', label: 'Exam scheduled' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
]

const LEAD_TONES: Record<
  ChallengeLeadStatus,
  'warning' | 'brand' | 'success' | 'neutral' | 'danger'
> = {
  new: 'warning',
  contacted: 'brand',
  scheduled: 'success',
  converted: 'success',
  lost: 'danger',
}

const RESULT_FILTERS = [
  { value: '', label: 'All results' },
  { value: 'true', label: 'Passed (discount owed)' },
  { value: 'false', label: 'Did not pass' },
]

export default function AdminChallengePage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [leadFilter, setLeadFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [selected, setSelected] = useState<ChallengeAttempt | null>(null)
  const [notes, setNotes] = useState('')
  const queryClient = useQueryClient()
  const toast = useToast()
  const debouncedSearch = useDebounce(search, 300)

  const query = {
    page,
    q: debouncedSearch || undefined,
    lead_status: leadFilter || undefined,
    passed: resultFilter === '' ? undefined : resultFilter === 'true',
  }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminChallengeAttempts(query),
    queryFn: () => getAdminChallengeAttempts(query),
    placeholderData: keepPreviousData,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'challenge-attempts'] })
  }

  const update = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: { lead_status?: ChallengeLeadStatus; admin_notes?: string }
    }) => updateChallengeAttempt(id, payload),
    onSuccess: (attempt) => {
      toast.success('Lead updated.')
      setSelected((current) => (current?.id === attempt.id ? attempt : current))
      invalidate()
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'We could not update that lead.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteChallengeAttempt(id),
    onSuccess: () => {
      toast.success('Attempt deleted.')
      setSelected(null)
      invalidate()
    },
    onError: () => toast.error('We could not delete that attempt.'),
  })

  function openDetail(attempt: ChallengeAttempt) {
    setSelected(attempt)
    setNotes(attempt.admin_notes ?? '')
  }

  const columns: Column<ChallengeAttempt>[] = [
    {
      key: 'candidate',
      header: 'Candidate',
      render: (attempt) => (
        <button
          type="button"
          onClick={() => openDetail(attempt)}
          className="block min-w-0 text-left"
        >
          <span className="block truncate font-semibold text-ink-900">{attempt.full_name}</span>
          <span className="block truncate text-xs text-ink-500">
            {attempt.reference_code} &middot; {attempt.email}
          </span>
        </button>
      ),
    },
    {
      key: 'certification',
      header: 'Certification',
      render: (attempt) => (
        <div className="min-w-0">
          <p className="truncate text-ink-800">{attempt.certification_name}</p>
          <p className="truncate text-xs text-ink-500">
            {attempt.exam_code ? `${attempt.exam_code} · ` : ''}
            {formatDate(attempt.created_at)}
          </p>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      render: (attempt) => (
        <div className="min-w-0">
          <p className="font-semibold tabular-nums text-ink-900">
            {attempt.score_percentage === null
              ? '—'
              : `${Number(attempt.score_percentage)}%`}
          </p>
          <p className="text-xs text-ink-500">
            {attempt.correct_count}/{attempt.question_count} correct
          </p>
        </div>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (attempt) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {attempt.passed === null ? (
            <Badge tone="neutral">In progress</Badge>
          ) : attempt.passed ? (
            <Badge tone="success">
              {Number(attempt.discount_percentage ?? 0)}% owed
            </Badge>
          ) : (
            <Badge tone="neutral">No discount</Badge>
          )}
          {/* The warning count is the reason to look twice before honouring a
              discount, so it belongs in the list, not buried in the drawer. */}
          {attempt.warnings > 0 && (
            <Badge tone="danger">
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              {attempt.warnings}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'lead_status',
      header: 'Follow-up',
      render: (attempt) => (
        <Select
          value={attempt.lead_status}
          aria-label={`Follow-up status for ${attempt.reference_code}`}
          onChange={(event) =>
            update.mutate({
              id: attempt.id,
              payload: { lead_status: event.target.value as ChallengeLeadStatus },
            })
          }
          className="h-9 max-w-[11rem] text-xs"
        >
          {LEAD_STATUSES.map((option) => (
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
      render: (attempt) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-600 hover:bg-rose-50"
          onClick={() => remove.mutate(attempt.id)}
          aria-label={`Delete attempt ${attempt.reference_code}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Challenge leads"
        description={
          data
            ? `${data.total} ${data.total === 1 ? 'attempt' : 'attempts'} matching this view.`
            : 'Everyone who has taken the certification challenge, newest first.'
        }
      />

      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field label="Search" htmlFor="challenge-search">
            <Input
              id="challenge-search"
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
        <div className="sm:w-52">
          <Field label="Result" htmlFor="challenge-result">
            <Select
              id="challenge-result"
              value={resultFilter}
              onChange={(event) => {
                setResultFilter(event.target.value)
                setPage(1)
              }}
            >
              {RESULT_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="sm:w-52">
          <Field label="Follow-up" htmlFor="challenge-lead">
            <Select
              id="challenge-lead"
              value={leadFilter}
              onChange={(event) => {
                setLeadFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All follow-up states</option>
              {LEAD_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <DataTable
        caption="Certification challenge attempts"
        columns={columns}
        rows={data?.items}
        rowKey={(attempt) => attempt.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle={
          search || leadFilter || resultFilter ? 'No matching attempts' : 'No attempts yet'
        }
        emptyDescription={
          search || leadFilter || resultFilter
            ? 'Try a different search or filter.'
            : 'Tests taken on the challenge page appear here, with the discount each one earned.'
        }
        page={data?.page}
        totalPages={data?.total_pages}
        onPageChange={setPage}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.full_name ?? ''}
        description={
          selected ? `${selected.reference_code} · ${selected.certification_name}` : undefined
        }
        size="lg"
        footer={
          selected && (
            <>
              <a
                href={`tel:${selected.phone}`}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-ink-300 px-5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call
              </a>
              <a
                href={`mailto:${selected.email}?subject=${encodeURIComponent(
                  `Your ${selected.certification_name} exam discount (${selected.reference_code})`,
                )}`}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-ink-300 px-5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email
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
              <Badge tone={LEAD_TONES[selected.lead_status]}>{selected.lead_status}</Badge>
              {selected.passed && (
                <Badge tone="success">
                  {Number(selected.discount_percentage ?? 0)}% discount promised
                </Badge>
              )}
              {selected.exam_code && <Badge tone="neutral">Exam {selected.exam_code}</Badge>}
              {selected.auto_submitted && <Badge tone="warning">Auto-submitted</Badge>}
              {selected.warnings > 0 && (
                <Badge tone="danger">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  {selected.warnings} warnings
                </Badge>
              )}
              {selected.user_id && <Badge tone="brand">Registered account</Badge>}
            </div>

            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="Phone" value={selected.phone} />
              <DetailRow label="Country" value={selected.country || 'Not given'} />
              <DetailRow label="Status" value={selected.status} />
              <DetailRow
                label="Score"
                value={
                  selected.score_percentage === null
                    ? 'Not submitted'
                    : `${Number(selected.score_percentage)}% (${selected.correct_count}/${selected.question_count})`
                }
              />
              <DetailRow
                label="Pass mark"
                value={selected.pass_mark === null ? '—' : `${Number(selected.pass_mark)}%`}
              />
              <DetailRow label="Started" value={formatDate(selected.started_at)} />
              <DetailRow
                label="Submitted"
                value={selected.submitted_at ? formatDate(selected.submitted_at) : 'Not submitted'}
              />
            </dl>

            <Field label="Internal notes" htmlFor="challenge-notes">
              <Textarea
                id="challenge-notes"
                value={notes}
                placeholder="What was agreed on the call, and when the exam is booked for."
                onChange={(event) => setNotes(event.target.value)}
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
      <dd className="mt-0.5 break-words text-ink-800">{value}</dd>
    </div>
  )
}
