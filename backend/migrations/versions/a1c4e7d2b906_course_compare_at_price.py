"""course compare-at price

Revision ID: a1c4e7d2b906
Revises: f09c05bef5e7
Create Date: 2026-09-20 10:05:12.441907
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1c4e7d2b906'
down_revision: Union[str, None] = 'f09c05bef5e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable and left empty on purpose: existing courses have never carried a
    # list price, and back-filling one would invent a discount that was never
    # offered. A saving appears on a course only once an operator enters the
    # figure it was previously sold at.
    op.add_column(
        'courses', sa.Column('compare_at_price', sa.Numeric(precision=10, scale=2), nullable=True)
    )
    op.create_check_constraint(
        'compare_at_price_non_negative',
        'courses',
        'compare_at_price IS NULL OR compare_at_price >= 0',
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f('ck_courses_compare_at_price_non_negative'), 'courses', type_='check'
    )
    op.drop_column('courses', 'compare_at_price')
