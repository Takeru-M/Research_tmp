"""Fixed comments and highlights table

Revision ID: aa32b7c541e8
Revises: a52348852470
Create Date: 2025-11-23 01:54:54.087345

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'aa32b7c541e8'
down_revision: Union[str, None] = 'a52348852470'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # テーブルの存在確認
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    # 1. project_files テーブルの存在確認と作成（必要な場合のみ）
    if 'project_files' not in existing_tables:
        op.create_table('project_files',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('file_name', sa.String(), nullable=False),
            sa.Column('file_key', sa.String(length=500), nullable=False),
            sa.Column('file_url', sa.String(length=500), nullable=True),
            sa.Column('file_size', sa.Integer(), nullable=True),
            sa.Column('project_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
    
    # 2. highlights テーブルを作成
    if 'highlights' not in existing_tables:
        op.create_table('highlights',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('project_file_id', sa.Integer(), nullable=False),
            sa.Column('created_by', sa.String(length=255), nullable=False),
            sa.Column('memo', sa.Text(), nullable=True),
            sa.Column('text', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['project_file_id'], ['project_files.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
    
    # 3. comments テーブルを作成
    if 'comments' not in existing_tables:
        op.create_table('comments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('highlight_id', sa.Integer(), nullable=True),
            sa.Column('parent_id', sa.Integer(), nullable=True),
            sa.Column('author', sa.String(length=255), nullable=False),
            sa.Column('text', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['highlight_id'], ['highlights.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['parent_id'], ['comments.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
    
    # 4. highlight_rects テーブルを作成（CASCADE 付き）
    if 'highlight_rects' not in existing_tables:
        op.create_table('highlight_rects',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('highlight_id', sa.Integer(), nullable=False),
            sa.Column('page_num', sa.Integer(), nullable=False),
            sa.Column('x1', sa.Float(), nullable=False),
            sa.Column('y1', sa.Float(), nullable=False),
            sa.Column('x2', sa.Float(), nullable=False),
            sa.Column('y2', sa.Float(), nullable=False),
            sa.Column('element_type', sa.String(), nullable=True),
            sa.ForeignKeyConstraint(['highlight_id'], ['highlights.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade() -> None:
    # 削除は逆順
    op.drop_table('highlight_rects')
    op.drop_table('comments')
    op.drop_table('highlights')
    # project_files は他のマイグレーションで管理されている可能性があるため削除しない
