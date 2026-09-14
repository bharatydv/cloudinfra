"""discount percentage replaces offer price

Revision ID: d71e93b4a8c6
Revises: c5a82f1d9b47
Create Date: 2026-09-14 13:22:41.907553
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd71e93b4a8c6'
down_revision: Union[str, None] = 'c5a82f1d9b47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'certifications', sa.Column('discount_percentage', sa.Numeric(precision=5, scale=2), nullable=True)
    )
    # Carry existing prices over as the equivalent percentage so nothing is
    # repriced by this migration. Rows priced at or above the vendor fee become
    # an explicit 0 rather than NULL, so they are not swept into a later
    # site-wide sale by accident.
    op.execute(
        """
        UPDATE certifications
           SET discount_percentage = CASE
                 WHEN offer_price_amount IS NULL OR exam_fee_amount IS NULL
                      OR exam_fee_amount <= 0 THEN NULL
                 WHEN offer_price_amount >= exam_fee_amount THEN 0
                 ELSE ROUND(
                     (exam_fee_amount - offer_price_amount) / exam_fee_amount * 100, 2
                 )
               END
        """
    )
    op.drop_constraint(op.f('ck_certifications_offer_price_non_negative'), 'certifications', type_='check')
    op.drop_column('certifications', 'offer_price_amount')
    op.create_check_constraint(
        'discount_percentage_valid',
        'certifications',
        'discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)',
    )


def downgrade() -> None:
    op.drop_constraint(op.f('ck_certifications_discount_percentage_valid'), 'certifications', type_='check')
    op.add_column(
        'certifications', sa.Column('offer_price_amount', sa.Numeric(precision=10, scale=2), nullable=True)
    )
    op.execute(
        """
        UPDATE certifications
           SET offer_price_amount = CASE
                 WHEN discount_percentage IS NULL OR exam_fee_amount IS NULL THEN NULL
                 ELSE ROUND(exam_fee_amount * (100 - discount_percentage) / 100, 2)
               END
        """
    )
    op.drop_column('certifications', 'discount_percentage')
    op.create_check_constraint(
        'offer_price_non_negative', 'certifications', 'offer_price_amount IS NULL OR offer_price_amount >= 0'
    )
