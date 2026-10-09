"""exam coupons

Revision ID: a37f2c6b91d4
Revises: e1b7c4f90a35
Create Date: 2026-10-09 12:04:11.882014
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a37f2c6b91d4'
down_revision: Union[str, None] = 'e1b7c4f90a35'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A second route to the discounted exam fee: a code, instead of a passed
    # paper. The code carries no rate of its own -- it unlocks the price the
    # catalogue already advertises.
    op.create_table(
        'exam_coupons',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=40), nullable=False),
        sa.Column('description', sa.String(length=200), nullable=True),
        sa.Column('certification_id', sa.UUID(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('max_redemptions', sa.Integer(), nullable=True),
        sa.Column('redemption_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.CheckConstraint(
            'max_redemptions IS NULL OR max_redemptions > 0',
            name=op.f('ck_exam_coupons_limit_positive'),
        ),
        sa.CheckConstraint(
            'redemption_count >= 0',
            name=op.f('ck_exam_coupons_redemptions_non_negative'),
        ),
        sa.ForeignKeyConstraint(
            ['certification_id'],
            ['certifications.id'],
            name=op.f('fk_exam_coupons_certification_id_certifications'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_exam_coupons')),
    )
    op.create_index(op.f('ix_exam_coupons_code'), 'exam_coupons', ['code'], unique=True)
    op.create_index(
        op.f('ix_exam_coupons_certification_id'),
        'exam_coupons',
        ['certification_id'],
        unique=False,
    )

    # A coupon payment has no booking and no attempt behind it, so the exam it
    # bought is recorded on the payment itself.
    op.add_column('payments', sa.Column('exam_coupon_id', sa.UUID(), nullable=True))
    op.add_column('payments', sa.Column('certification_id', sa.UUID(), nullable=True))
    op.create_index(
        op.f('ix_payments_exam_coupon_id'), 'payments', ['exam_coupon_id'], unique=False
    )
    op.create_index(
        op.f('ix_payments_certification_id'),
        'payments',
        ['certification_id'],
        unique=False,
    )
    op.create_foreign_key(
        op.f('fk_payments_exam_coupon_id_exam_coupons'),
        'payments',
        'exam_coupons',
        ['exam_coupon_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_foreign_key(
        op.f('fk_payments_certification_id_certifications'),
        'payments',
        'certifications',
        ['certification_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f('fk_payments_certification_id_certifications'), 'payments', type_='foreignkey'
    )
    op.drop_constraint(
        op.f('fk_payments_exam_coupon_id_exam_coupons'), 'payments', type_='foreignkey'
    )
    op.drop_index(op.f('ix_payments_certification_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_exam_coupon_id'), table_name='payments')
    op.drop_column('payments', 'certification_id')
    op.drop_column('payments', 'exam_coupon_id')

    op.drop_index(op.f('ix_exam_coupons_certification_id'), table_name='exam_coupons')
    op.drop_index(op.f('ix_exam_coupons_code'), table_name='exam_coupons')
    op.drop_table('exam_coupons')
