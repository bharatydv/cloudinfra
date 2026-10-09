import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

/**
 * The confirmation step in front of an irreversible delete.
 *
 * Courses, articles and certifications already asked before deleting; leads,
 * messages, lessons and taxonomy did not, so a single mis-click destroyed a
 * customer record or a lesson's content along with its progress. One component
 * so every surface asks the same way, naming the thing being deleted.
 */
export function ConfirmDelete({
  open,
  onClose,
  onConfirm,
  loading,
  title,
  description,
  itemName,
  confirmLabel = 'Delete',
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
  title: string
  /** What goes with it, and whether anything can be recovered. */
  description: string
  /** The record's own name, so the operator can see what they picked. */
  itemName?: string | null
  confirmLabel?: string
  children?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children ?? (
        <p className="text-sm text-ink-700">
          You are about to delete{' '}
          <strong className="font-semibold text-ink-900">{itemName ?? 'this record'}</strong>.
        </p>
      )}
    </Modal>
  )
}
