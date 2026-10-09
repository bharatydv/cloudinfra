/**
 * Exam coupon codes.
 *
 * A code is a key to the price the catalogue already advertises, not a
 * discount of its own, which is why there is no percentage to set here. That
 * is deliberate: a coupon and a passed challenge paper must never quote two
 * different figures for the same exam.
 *
 * Codes are handed out in batches -- to an influencer, a college, a community
 * -- so each one records who it went to, when it is live, and how many times
 * it has actually been paid with.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Sparkles, Trash2 } from 'lucide-react'

import { ConfirmDelete } from '@/components/admin/ConfirmDelete'
import { AdminPageHeader, DataTable, type Column } from '@/components/admin/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge, Field, Input, Select } from '@/components/ui/primitives'
import {
  createExamCoupon,
  deleteExamCoupon,
  generateExamCouponCode,
  getAdminExamCoupons,
  getCertificationOptions,
  updateExamCoupon,
} from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import type { ExamCouponRow, ExamCouponStatus } from '@/types/api'

const BLANK = {
  code: '',
  description: '',
  ownerName: '',
  ownerEmail: '',
  certificationId: '',
  isActive: true,
  // Date inputs, so an empty string means that end of the window is open.
  startsAt: '',
  expiresAt: '',
  maxRedemptions: '',
}

type Draft = typeof BLANK

/** What each state means, in the words the console should use. */
const STATUS: Record<ExamCouponStatus, { label: string; tone: 'success' | 'neutral' | 'warning' }> =
  {
    live: { label: 'Live', tone: 'success' },
    scheduled: { label: 'Scheduled', tone: 'warning' },
    expired: { label: 'Expired', tone: 'neutral' },
    spent: { label: 'Fully used', tone: 'neutral' },
    off: { label: 'Off', tone: 'neutral' },
  }

function toDraft(coupon: ExamCouponRow): Draft {
  return {
    code: coupon.code,
    description: coupon.description ?? '',
    ownerName: coupon.owner_name ?? '',
    ownerEmail: coupon.owner_email ?? '',
    certificationId: coupon.certification_id ?? '',
    isActive: coupon.is_active,
    startsAt: coupon.starts_at ? coupon.starts_at.slice(0, 10) : '',
    expiresAt: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
    maxRedemptions: coupon.max_redemptions === null ? '' : String(coupon.max_redemptions),
  }
}

export default function AdminExamCouponsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState<ExamCouponRow | null>(null)
  const [open, setOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ExamCouponRow | null>(null)
  const [draft, setDraft] = useState<Draft>(BLANK)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminExamCoupons,
    queryFn: getAdminExamCoupons,
  })
  const { data: certifications } = useQuery({
    queryKey: queryKeys.certificationOptions,
    queryFn: getCertificationOptions,
    staleTime: 10 * 60_000,
  })

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function close() {
    setOpen(false)
    setEditing(null)
    setDraft(BLANK)
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminExamCoupons })
  }

  const windowBackwards = Boolean(
    draft.startsAt && draft.expiresAt && draft.startsAt >= draft.expiresAt,
  )

  const generate = useMutation({
    mutationFn: () => generateExamCouponCode(draft.ownerName.trim() || undefined),
    onSuccess: (result) => set('code', result.code),
    onError: () => toast.error('We could not generate a code.'),
  })

  const payload = () => ({
    code: draft.code.trim().toUpperCase(),
    description: draft.description.trim() || null,
    owner_name: draft.ownerName.trim() || null,
    owner_email: draft.ownerEmail.trim() || null,
    certification_id: draft.certificationId || null,
    is_active: draft.isActive,
    // The date inputs give days: a window opens at the start of its first day
    // and closes at the end of its last.
    starts_at: draft.startsAt ? `${draft.startsAt}T00:00:00Z` : null,
    expires_at: draft.expiresAt ? `${draft.expiresAt}T23:59:59Z` : null,
    max_redemptions: draft.maxRedemptions ? Number(draft.maxRedemptions) : null,
  })

  const save = useMutation({
    mutationFn: () =>
      editing ? updateExamCoupon(editing.id, payload()) : createExamCoupon(payload()),
    onSuccess: () => {
      toast.success(editing ? 'Coupon updated.' : 'Coupon created.')
      close()
      invalidate()
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError ? err.message : 'We could not save that coupon.',
      ),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteExamCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deleted.')
      setPendingDelete(null)
      invalidate()
    },
    onError: () => toast.error('We could not delete that coupon.'),
  })

  const columns: Column<ExamCouponRow>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (coupon) => (
        <div className="min-w-0">
          <p className="font-bold tracking-wide text-ink-900">{coupon.code}</p>
          {coupon.description && (
            <p className="line-clamp-1 text-xs text-ink-500">{coupon.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Given to',
      render: (coupon) =>
        coupon.owner_name ? (
          <div className="min-w-0">
            <p className="font-semibold text-ink-900">{coupon.owner_name}</p>
            {coupon.owner_email && (
              <p className="truncate text-xs text-ink-500">{coupon.owner_email}</p>
            )}
          </div>
        ) : (
          <span className="text-ink-400">&mdash;</span>
        ),
    },
    {
      key: 'certification',
      header: 'Exam',
      render: (coupon) => coupon.certification_name ?? 'Any exam',
    },
    {
      key: 'used',
      header: 'Paid uses',
      align: 'right',
      render: (coupon) =>
        coupon.max_redemptions === null
          ? `${coupon.redemption_count}`
          : `${coupon.redemption_count} / ${coupon.max_redemptions}`,
    },
    {
      key: 'window',
      header: 'Valid',
      render: (coupon) => (
        <span className="text-xs text-ink-600">
          {coupon.starts_at ? formatDate(coupon.starts_at) : 'Now'}
          {' → '}
          {coupon.expires_at ? formatDate(coupon.expires_at) : 'No end'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (coupon) => (
        <Badge tone={STATUS[coupon.status].tone}>{STATUS[coupon.status].label}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (coupon) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(coupon)
              setDraft(toDraft(coupon))
              setOpen(true)
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:bg-rose-50"
            onClick={() => setPendingDelete(coupon)}
            aria-label={`Delete coupon ${coupon.code}`}
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
        title="Exam coupons"
        description="A code unlocks the price the exam is already advertised at — the same price a passed challenge paper unlocks. Record who you gave each batch to, and “Paid uses” is what that influencer brought in."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setDraft(BLANK)
              setOpen(true)
            }}
            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            New coupon
          </Button>
        }
      />
      <DataTable
        caption="Exam coupons"
        columns={columns}
        rows={data}
        rowKey={(coupon) => coupon.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No coupons yet"
      />

      <ConfirmDelete
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        loading={remove.isPending}
        title="Delete this coupon?"
        description="Anyone holding the code stops being able to use it. Payments already taken are not affected."
        itemName={pendingDelete?.code}
        confirmLabel="Delete coupon"
      />

      <Modal
        open={open}
        onClose={close}
        title={editing ? `Edit ${editing.code}` : 'New coupon'}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              disabled={draft.code.trim().length < 3 || windowBackwards}
              onClick={() => save.mutate()}
            >
              {editing ? 'Save coupon' : 'Create coupon'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Owner first: Generate reads it, so asking for the code before the
              name would make the button useless on the way down the form. */}
          <Field label="Given to" htmlFor="coupon-owner">
            <Input
              id="coupon-owner"
              value={draft.ownerName}
              onChange={(event) => set('ownerName', event.target.value)}
              placeholder="Influencer, college or community"
              maxLength={120}
            />
          </Field>
          <Field label="Their email" htmlFor="coupon-owner-email">
            <Input
              id="coupon-owner-email"
              type="email"
              value={draft.ownerEmail}
              onChange={(event) => set('ownerEmail', event.target.value)}
              placeholder="So you can reach them about the batch"
              maxLength={255}
            />
          </Field>

          <Field label="Code" htmlFor="coupon-code" required>
            <div className="flex gap-2">
              <Input
                id="coupon-code"
                value={draft.code}
                onChange={(event) => set('code', event.target.value)}
                placeholder="PRIYA-7K4MQ"
                className="uppercase placeholder:normal-case"
                maxLength={40}
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                variant="outline"
                loading={generate.isPending}
                onClick={() => generate.mutate()}
                leadingIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
              >
                Generate
              </Button>
            </div>
          </Field>
          <p className="-mt-3 text-xs leading-relaxed text-ink-500">
            Generate builds one from the name above and checks it is free. Lookalike
            characters are left out, so a code read off a video survives being retyped.
          </p>

          <Field label="Note" htmlFor="coupon-description">
            <Input
              id="coupon-description"
              value={draft.description}
              onChange={(event) => set('description', event.target.value)}
              placeholder="What this batch was handed out for"
              maxLength={200}
            />
          </Field>
          <Field label="Exam" htmlFor="coupon-certification">
            <Select
              id="coupon-certification"
              value={draft.certificationId}
              onChange={(event) => set('certificationId', event.target.value)}
            >
              <option value="">Any exam</option>
              {(certifications ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Valid from" htmlFor="coupon-starts">
              <Input
                id="coupon-starts"
                type="date"
                value={draft.startsAt}
                onChange={(event) => set('startsAt', event.target.value)}
              />
            </Field>
            <Field label="Valid until" htmlFor="coupon-expires">
              <Input
                id="coupon-expires"
                type="date"
                value={draft.expiresAt}
                onChange={(event) => set('expiresAt', event.target.value)}
                invalid={windowBackwards}
              />
            </Field>
          </div>
          {windowBackwards ? (
            <p className="-mt-3 text-xs font-medium text-rose-700">
              The end of the window has to come after its start.
            </p>
          ) : (
            <p className="-mt-3 text-xs text-ink-500">
              Leave either blank for an open end. A code with neither works from now
              until you switch it off.
            </p>
          )}

          <Field label="Maximum uses" htmlFor="coupon-max">
            <Input
              id="coupon-max"
              type="number"
              min={1}
              value={draft.maxRedemptions}
              onChange={(event) => set('maxRedemptions', event.target.value)}
              placeholder="Unlimited"
            />
          </Field>
          <Field label="Status" htmlFor="coupon-active">
            <Select
              id="coupon-active"
              value={draft.isActive ? 'true' : 'false'}
              onChange={(event) => set('isActive', event.target.value === 'true')}
            >
              <option value="true">Active</option>
              <option value="false">Off</option>
            </Select>
          </Field>
          <p className="text-xs leading-relaxed text-ink-500">
            A use is counted when the payment clears, not when the code is typed, so
            checking a code never spends it.
          </p>
        </div>
      </Modal>
    </>
  )
}
