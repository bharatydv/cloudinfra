"""exam booking payments

Revision ID: e94c2a7f5d10
Revises: d71e93b4a8c6
Create Date: 2026-09-14 15:04:18.226904
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e94c2a7f5d10'
down_revision: Union[str, None] = 'd71e93b4a8c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Exam bookings are open to signed-out visitors, so a payment need not
    # belong to an account.
    op.alter_column('payments', 'user_id', existing_type=sa.UUID(), nullable=True)
    op.add_column('payments', sa.Column('exam_booking_id', sa.UUID(), nullable=True))
    op.create_index(
        op.f('ix_payments_exam_booking_id'), 'payments', ['exam_booking_id'], unique=False
    )
    op.create_foreign_key(
        op.f('fk_payments_exam_booking_id_exam_bookings'),
        'payments',
        'exam_bookings',
        ['exam_booking_id'],
        ['id'],
        ondelete='SET NULL',
    )

    op.add_column(
        'exam_bookings',
        sa.Column('payment_status', sa.String(length=20), nullable=False, server_default='unpaid'),
    )
    # Backfill done by the server_default; the model carries only a Python-side
    # default, so drop it to keep the two in step.
    op.alter_column('exam_bookings', 'payment_status', server_default=None)
    op.create_index(
        op.f('ix_exam_bookings_payment_status'), 'exam_bookings', ['payment_status'], unique=False
    )
    op.create_check_constraint(
        'payment_status_valid',
        'exam_bookings',
        "payment_status IN ('unpaid', 'pending', 'successful', 'failed', 'refunded')",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f('ck_exam_bookings_payment_status_valid'), 'exam_bookings', type_='check'
    )
    op.drop_index(op.f('ix_exam_bookings_payment_status'), table_name='exam_bookings')
    op.drop_column('exam_bookings', 'payment_status')

    op.drop_constraint(
        op.f('fk_payments_exam_booking_id_exam_bookings'), 'payments', type_='foreignkey'
    )
    op.drop_index(op.f('ix_payments_exam_booking_id'), table_name='payments')
    op.drop_column('payments', 'exam_booking_id')
    # Rows without a user cannot exist under the old constraint; they are
    # booking payments and must be reassigned or removed before downgrading.
    op.execute("DELETE FROM payments WHERE user_id IS NULL")
    op.alter_column('payments', 'user_id', existing_type=sa.UUID(), nullable=False)
