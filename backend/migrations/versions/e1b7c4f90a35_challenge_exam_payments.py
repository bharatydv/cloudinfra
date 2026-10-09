"""challenge exam payments

Revision ID: e1b7c4f90a35
Revises: d4a9c1e07b52
Create Date: 2026-10-08 10:12:04.118320
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e1b7c4f90a35'
down_revision: Union[str, None] = 'd4a9c1e07b52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A passed test can now be paid for at the discount it earned, so a payment
    # may belong to an attempt the way one already belongs to a booking.
    op.add_column('payments', sa.Column('challenge_attempt_id', sa.UUID(), nullable=True))
    op.create_index(
        op.f('ix_payments_challenge_attempt_id'),
        'payments',
        ['challenge_attempt_id'],
        unique=False,
    )
    op.create_foreign_key(
        op.f('fk_payments_challenge_attempt_id_challenge_attempts'),
        'payments',
        'challenge_attempts',
        ['challenge_attempt_id'],
        ['id'],
        ondelete='SET NULL',
    )

    op.add_column(
        'challenge_attempts',
        sa.Column(
            'payment_status', sa.String(length=20), nullable=False, server_default='unpaid'
        ),
    )
    # The server default backfills existing rows; the model carries only a
    # Python-side default, so it is dropped to keep the two in step.
    op.alter_column('challenge_attempts', 'payment_status', server_default=None)
    op.create_index(
        op.f('ix_challenge_attempts_payment_status'),
        'challenge_attempts',
        ['payment_status'],
        unique=False,
    )
    op.create_check_constraint(
        'payment_status_valid',
        'challenge_attempts',
        "payment_status IN ('unpaid', 'pending', 'successful', 'failed', 'refunded')",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f('ck_challenge_attempts_payment_status_valid'),
        'challenge_attempts',
        type_='check',
    )
    op.drop_index(
        op.f('ix_challenge_attempts_payment_status'), table_name='challenge_attempts'
    )
    op.drop_column('challenge_attempts', 'payment_status')

    op.drop_constraint(
        op.f('fk_payments_challenge_attempt_id_challenge_attempts'),
        'payments',
        type_='foreignkey',
    )
    op.drop_index(op.f('ix_payments_challenge_attempt_id'), table_name='payments')
    op.drop_column('payments', 'challenge_attempt_id')
