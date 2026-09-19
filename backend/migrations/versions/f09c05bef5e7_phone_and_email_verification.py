"""phone and email verification

Revision ID: f09c05bef5e7
Revises: f2b7d41c9a83
Create Date: 2026-09-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f09c05bef5e7'
down_revision: Union[str, None] = 'f2b7d41c9a83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing accounts predate the phone field; backfill with an empty
    # string rather than block the migration, then require it going forward.
    op.add_column('users', sa.Column('phone', sa.String(length=30), nullable=False, server_default=''))
    op.alter_column('users', 'phone', server_default=None)

    op.create_table(
        'email_verification_tokens',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('code_hash', sa.String(length=128), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_email_verification_tokens')),
        sa.UniqueConstraint('code_hash', name=op.f('uq_email_verification_tokens_code_hash')),
    )
    op.create_index(
        op.f('ix_email_verification_tokens_user_id'),
        'email_verification_tokens',
        ['user_id'],
        unique=False,
    )

    # Login now refuses unverified accounts. Existing users signed up under the
    # old rules (no verification step) and must not be locked out by this
    # change -- only accounts created from here on go through the new flow.
    op.execute("UPDATE users SET is_email_verified = true WHERE is_email_verified = false")


def downgrade() -> None:
    op.drop_index(
        op.f('ix_email_verification_tokens_user_id'), table_name='email_verification_tokens'
    )
    op.drop_table('email_verification_tokens')
    op.drop_column('users', 'phone')
