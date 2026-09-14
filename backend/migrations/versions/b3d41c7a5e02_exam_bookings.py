"""exam bookings

Revision ID: b3d41c7a5e02
Revises: 9f6729bfefab
Create Date: 2026-09-14 10:12:44.108320
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3d41c7a5e02'
down_revision: Union[str, None] = '9f6729bfefab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('exam_bookings',
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('full_name', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('phone', sa.String(length=40), nullable=False),
    sa.Column('country', sa.String(length=80), nullable=False),
    sa.Column('city', sa.String(length=120), nullable=True),
    sa.Column('certification_id', sa.UUID(), nullable=True),
    sa.Column('certification_name', sa.String(length=220), nullable=False),
    sa.Column('exam_code', sa.String(length=60), nullable=True),
    sa.Column('preferred_date', sa.Date(), nullable=False),
    sa.Column('alternate_date', sa.Date(), nullable=True),
    sa.Column('preferred_time_slot', sa.String(length=40), nullable=False),
    sa.Column('timezone', sa.String(length=80), nullable=False),
    sa.Column('delivery_mode', sa.String(length=30), nullable=False),
    sa.Column('reference_code', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('admin_notes', sa.Text(), nullable=True),
    sa.Column('source_ip', sa.String(length=64), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("delivery_mode IN ('online_proctored', 'test_center')", name=op.f('ck_exam_bookings_delivery_mode_valid')),
    sa.CheckConstraint("status IN ('new', 'contacted', 'scheduled', 'completed', 'cancelled')", name=op.f('ck_exam_bookings_status_valid')),
    sa.ForeignKeyConstraint(['certification_id'], ['certifications.id'], name=op.f('fk_exam_bookings_certification_id_certifications'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_exam_bookings_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_exam_bookings'))
    )
    op.create_index(op.f('ix_exam_bookings_certification_id'), 'exam_bookings', ['certification_id'], unique=False)
    op.create_index(op.f('ix_exam_bookings_email'), 'exam_bookings', ['email'], unique=False)
    op.create_index(op.f('ix_exam_bookings_preferred_date'), 'exam_bookings', ['preferred_date'], unique=False)
    op.create_index(op.f('ix_exam_bookings_reference_code'), 'exam_bookings', ['reference_code'], unique=True)
    op.create_index(op.f('ix_exam_bookings_status'), 'exam_bookings', ['status'], unique=False)
    op.create_index(op.f('ix_exam_bookings_user_id'), 'exam_bookings', ['user_id'], unique=False)
    op.create_index('ix_exam_bookings_status_created', 'exam_bookings', ['status', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_exam_bookings_status_created', table_name='exam_bookings')
    op.drop_index(op.f('ix_exam_bookings_user_id'), table_name='exam_bookings')
    op.drop_index(op.f('ix_exam_bookings_status'), table_name='exam_bookings')
    op.drop_index(op.f('ix_exam_bookings_reference_code'), table_name='exam_bookings')
    op.drop_index(op.f('ix_exam_bookings_preferred_date'), table_name='exam_bookings')
    op.drop_index(op.f('ix_exam_bookings_email'), table_name='exam_bookings')
    op.drop_index(op.f('ix_exam_bookings_certification_id'), table_name='exam_bookings')
    op.drop_table('exam_bookings')
