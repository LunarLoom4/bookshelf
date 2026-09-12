"""Add pdf_hash to editions for content-based duplicate detection

Revision ID: 007_pdf_hash
Revises: 006_comment_edit_delete
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa

revision = "007_pdf_hash"
down_revision = "006_comment_edit_delete"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # sha256 hex digest is always 64 chars
    op.add_column("editions", sa.Column("pdf_hash", sa.String(64), nullable=True))
    # Index for fast duplicate lookup
    op.create_index("ix_editions_pdf_hash", "editions", ["pdf_hash"])


def downgrade() -> None:
    op.drop_index("ix_editions_pdf_hash", "editions")
    op.drop_column("editions", "pdf_hash")
