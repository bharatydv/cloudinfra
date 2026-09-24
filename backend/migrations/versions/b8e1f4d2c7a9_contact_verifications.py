"""contact verifications

Revision ID: b8e1f4d2c7a9
Revises: a7d3e5c1b9f2
Create Date: 2026-09-23 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b8e1f4d2c7a9'
down_revision: Union[str, None] = 'a7d3e5c1b9f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A guest proves their email and phone with one-time codes before a
    # challenge paper is issued, so the callback the campaign promises can
    # actually reach them.
    op.create_table(
        'contact_verifications',
        sa.Column('channel', sa.String(length=10), nullable=False),
        sa.Column('target', sa.String(length=255), nullable=False),
        sa.Column('code_hash', sa.String(length=128), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('source_ip', sa.String(length=64), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "channel IN ('email', 'phone')", name=op.f('ck_contact_verifications_channel_valid')
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_contact_verifications')),
    )
    op.create_index(
        'ix_contact_verifications_lookup',
        'contact_verifications',
        ['channel', 'target', 'created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_contact_verifications_lookup', table_name='contact_verifications')
    op.drop_table('contact_verifications')
