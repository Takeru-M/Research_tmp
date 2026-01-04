"""add completion_stage to comments

Revision ID: f4b6c1234567
Revises: e124e5ca533c
Create Date: 2026-01-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4b6c1234567'
down_revision: Union[str, None] = 'e124e5ca533c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('comments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('completion_stage', sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('comments', schema=None) as batch_op:
        batch_op.drop_column('completion_stage')
