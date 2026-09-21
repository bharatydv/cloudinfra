"""challenge booking preferences

Revision ID: a7d3e5c1b9f2
Revises: f09c05bef5e7
Create Date: 2026-09-21 23:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a7d3e5c1b9f2'
down_revision: Union[str, None] = 'a1c4e7d2b906'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A sitting started from the scheduling form carries the slot the applicant
    # asked for, so the discount call can book it. Nullable: the challenge page
    # itself asks for no dates.
    op.add_column(
        'challenge_attempts',
        sa.Column('booking_preferences', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('challenge_attempts', 'booking_preferences')
