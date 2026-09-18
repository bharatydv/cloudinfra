"""certification challenge

Revision ID: f2b7d41c9a83
Revises: e94c2a7f5d10
Create Date: 2026-09-18 11:42:05.310922
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f2b7d41c9a83'
down_revision: Union[str, None] = 'e94c2a7f5d10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('challenge_questions',
    sa.Column('reference', sa.String(length=80), nullable=False),
    sa.Column('provider_slug', sa.String(length=140), nullable=False),
    sa.Column('certification_id', sa.UUID(), nullable=True),
    sa.Column('prompt', sa.Text(), nullable=False),
    sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('correct_option', sa.String(length=4), nullable=False),
    sa.Column('explanation', sa.Text(), nullable=True),
    sa.Column('topic', sa.String(length=120), nullable=True),
    sa.Column('difficulty', sa.String(length=20), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("difficulty IN ('easy', 'medium', 'hard')", name=op.f('ck_challenge_questions_difficulty_valid')),
    sa.ForeignKeyConstraint(['certification_id'], ['certifications.id'], name=op.f('fk_challenge_questions_certification_id_certifications'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_challenge_questions'))
    )
    op.create_index(op.f('ix_challenge_questions_certification_id'), 'challenge_questions', ['certification_id'], unique=False)
    op.create_index(op.f('ix_challenge_questions_is_active'), 'challenge_questions', ['is_active'], unique=False)
    op.create_index(op.f('ix_challenge_questions_provider_slug'), 'challenge_questions', ['provider_slug'], unique=False)
    op.create_index(op.f('ix_challenge_questions_reference'), 'challenge_questions', ['reference'], unique=True)
    op.create_index('ix_challenge_questions_pool', 'challenge_questions', ['provider_slug', 'certification_id', 'is_active'], unique=False)

    op.create_table('challenge_attempts',
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('full_name', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('phone', sa.String(length=40), nullable=False),
    sa.Column('country', sa.String(length=80), nullable=True),
    sa.Column('certification_id', sa.UUID(), nullable=True),
    sa.Column('certification_name', sa.String(length=220), nullable=False),
    sa.Column('exam_code', sa.String(length=60), nullable=True),
    sa.Column('question_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('answers', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('warnings', sa.Integer(), nullable=False),
    sa.Column('violations', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('auto_submitted', sa.Boolean(), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reference_code', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('question_count', sa.Integer(), nullable=False),
    sa.Column('correct_count', sa.Integer(), nullable=False),
    sa.Column('score_percentage', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('passed', sa.Boolean(), nullable=True),
    sa.Column('discount_percentage', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('pass_mark', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('lead_status', sa.String(length=20), nullable=False),
    sa.Column('admin_notes', sa.Text(), nullable=True),
    sa.Column('source_ip', sa.String(length=64), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("lead_status IN ('new', 'contacted', 'scheduled', 'converted', 'lost')", name=op.f('ck_challenge_attempts_lead_status_valid')),
    sa.CheckConstraint("score_percentage IS NULL OR (score_percentage >= 0 AND score_percentage <= 100)", name=op.f('ck_challenge_attempts_score_percentage_valid')),
    sa.CheckConstraint("status IN ('in_progress', 'submitted', 'expired')", name=op.f('ck_challenge_attempts_status_valid')),
    sa.CheckConstraint('warnings >= 0', name=op.f('ck_challenge_attempts_warnings_non_negative')),
    sa.ForeignKeyConstraint(['certification_id'], ['certifications.id'], name=op.f('fk_challenge_attempts_certification_id_certifications'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_challenge_attempts_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_challenge_attempts'))
    )
    op.create_index(op.f('ix_challenge_attempts_certification_id'), 'challenge_attempts', ['certification_id'], unique=False)
    op.create_index(op.f('ix_challenge_attempts_email'), 'challenge_attempts', ['email'], unique=False)
    op.create_index(op.f('ix_challenge_attempts_expires_at'), 'challenge_attempts', ['expires_at'], unique=False)
    op.create_index(op.f('ix_challenge_attempts_lead_status'), 'challenge_attempts', ['lead_status'], unique=False)
    op.create_index(op.f('ix_challenge_attempts_reference_code'), 'challenge_attempts', ['reference_code'], unique=True)
    op.create_index(op.f('ix_challenge_attempts_status'), 'challenge_attempts', ['status'], unique=False)
    op.create_index(op.f('ix_challenge_attempts_token_hash'), 'challenge_attempts', ['token_hash'], unique=False)
    op.create_index(op.f('ix_challenge_attempts_user_id'), 'challenge_attempts', ['user_id'], unique=False)
    op.create_index('ix_challenge_attempts_email_created', 'challenge_attempts', ['email', 'created_at'], unique=False)
    op.create_index('ix_challenge_attempts_lead_created', 'challenge_attempts', ['lead_status', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_challenge_attempts_lead_created', table_name='challenge_attempts')
    op.drop_index('ix_challenge_attempts_email_created', table_name='challenge_attempts')
    op.drop_index(op.f('ix_challenge_attempts_user_id'), table_name='challenge_attempts')
    op.drop_index(op.f('ix_challenge_attempts_token_hash'), table_name='challenge_attempts')
    op.drop_index(op.f('ix_challenge_attempts_status'), table_name='challenge_attempts')
    op.drop_index(op.f('ix_challenge_attempts_reference_code'), table_name='challenge_attempts')
    op.drop_index(op.f('ix_challenge_attempts_lead_status'), table_name='challenge_attempts')
    op.drop_index(op.f('ix_challenge_attempts_expires_at'), table_name='challenge_attempts')
    op.drop_index(op.f('ix_challenge_attempts_email'), table_name='challenge_attempts')
    op.drop_index(op.f('ix_challenge_attempts_certification_id'), table_name='challenge_attempts')
    op.drop_table('challenge_attempts')

    op.drop_index('ix_challenge_questions_pool', table_name='challenge_questions')
    op.drop_index(op.f('ix_challenge_questions_reference'), table_name='challenge_questions')
    op.drop_index(op.f('ix_challenge_questions_provider_slug'), table_name='challenge_questions')
    op.drop_index(op.f('ix_challenge_questions_is_active'), table_name='challenge_questions')
    op.drop_index(op.f('ix_challenge_questions_certification_id'), table_name='challenge_questions')
    op.drop_table('challenge_questions')
