"""Extend author column to 500 chars

Revision ID: 012
Revises: 011_edition_likes
Create Date: 2026-09-24
"""
from alembic import op
import sqlalchemy as sa

revision = '012'
down_revision = '011_edition_likes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('books', 'author',
        existing_type=sa.String(255),
        type_=sa.String(500),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column('books', 'author',
        existing_type=sa.String(500),
        type_=sa.String(255),
        existing_nullable=False,
    )
