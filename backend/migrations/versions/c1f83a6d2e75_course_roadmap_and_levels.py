"""course roadmap and certification levels

Revision ID: c1f83a6d2e75
Revises: b8e1f4d2c7a9
Create Date: 2026-09-29 11:40:18.204513
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c1f83a6d2e75'
down_revision: Union[str, None] = 'b8e1f4d2c7a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Both default to an empty list so every existing course keeps working and
    # simply renders neither section. A course only shows a study plan or a
    # certification ladder once someone has actually written one for it.
    op.add_column(
        'courses',
        sa.Column(
            'roadmap',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        'courses',
        sa.Column(
            'certification_levels',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column('courses', 'certification_levels')
    op.drop_column('courses', 'roadmap')
