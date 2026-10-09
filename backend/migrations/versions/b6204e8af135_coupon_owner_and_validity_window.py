"""coupon owner and validity window

Revision ID: b6204e8af135
Revises: a37f2c6b91d4
Create Date: 2026-10-09 14:22:36.401957
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b6204e8af135'
down_revision: Union[str, None] = 'a37f2c6b91d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Codes are handed to influencers and partners in batches, so a coupon
    # records who it went to and when it is live. The owner is a label, not an
    # account -- nobody signs in as one.
    op.add_column('exam_coupons', sa.Column('owner_name', sa.String(length=120), nullable=True))
    op.add_column('exam_coupons', sa.Column('owner_email', sa.String(length=255), nullable=True))
    op.add_column(
        'exam_coupons', sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(
        op.f('ix_exam_coupons_owner_name'), 'exam_coupons', ['owner_name'], unique=False
    )
    op.create_check_constraint(
        op.f('ck_exam_coupons_window_ordered'),
        'exam_coupons',
        'starts_at IS NULL OR expires_at IS NULL OR starts_at < expires_at',
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f('ck_exam_coupons_window_ordered'), 'exam_coupons', type_='check'
    )
    op.drop_index(op.f('ix_exam_coupons_owner_name'), table_name='exam_coupons')
    op.drop_column('exam_coupons', 'starts_at')
    op.drop_column('exam_coupons', 'owner_email')
    op.drop_column('exam_coupons', 'owner_name')
