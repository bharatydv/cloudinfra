"""certification pricing

Revision ID: c5a82f1d9b47
Revises: b3d41c7a5e02
Create Date: 2026-09-14 11:48:02.554311
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c5a82f1d9b47'
down_revision: Union[str, None] = 'b3d41c7a5e02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('certifications', sa.Column('exam_fee_amount', sa.Numeric(precision=10, scale=2), nullable=True))
    # server_default backfills existing rows, then it is dropped so the column
    # matches the model, which carries only a Python-side default.
    op.add_column(
        'certifications',
        sa.Column('exam_fee_currency', sa.String(length=3), nullable=False, server_default='USD'),
    )
    op.alter_column('certifications', 'exam_fee_currency', server_default=None)
    op.add_column('certifications', sa.Column('exam_fee_checked_on', sa.Date(), nullable=True))
    op.add_column('certifications', sa.Column('offer_price_amount', sa.Numeric(precision=10, scale=2), nullable=True))
    op.create_check_constraint(
        'exam_fee_non_negative', 'certifications', 'exam_fee_amount IS NULL OR exam_fee_amount >= 0'
    )
    op.create_check_constraint(
        'offer_price_non_negative', 'certifications', 'offer_price_amount IS NULL OR offer_price_amount >= 0'
    )


def downgrade() -> None:
    op.drop_constraint(op.f('ck_certifications_offer_price_non_negative'), 'certifications', type_='check')
    op.drop_constraint(op.f('ck_certifications_exam_fee_non_negative'), 'certifications', type_='check')
    op.drop_column('certifications', 'offer_price_amount')
    op.drop_column('certifications', 'exam_fee_checked_on')
    op.drop_column('certifications', 'exam_fee_currency')
    op.drop_column('certifications', 'exam_fee_amount')
