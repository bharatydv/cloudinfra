"""google sign-in

Revision ID: d4a9c1e07b52
Revises: c1f83a6d2e75
Create Date: 2026-10-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd4a9c1e07b52'
down_revision: Union[str, None] = 'c1f83a6d2e75'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('google_sub', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_users_google_sub'), 'users', ['google_sub'], unique=True)

    # An account created through Google has no password at all. A placeholder
    # hash would look like a usable credential, so the column goes null
    # instead: every existing row keeps its hash untouched.
    op.alter_column('users', 'password_hash', existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    # Going back needs a non-null hash for the Google-only accounts. An empty
    # string matches no password under argon2 or bcrypt, so those accounts
    # cannot sign in -- which is the pre-Google behaviour for them anyway.
    op.execute("UPDATE users SET password_hash = '' WHERE password_hash IS NULL")
    op.alter_column('users', 'password_hash', existing_type=sa.String(length=255), nullable=False)

    op.drop_index(op.f('ix_users_google_sub'), table_name='users')
    op.drop_column('users', 'google_sub')
