"""Add performance indexes for hot query paths

Revision ID: 008_perf_indexes
Revises: 007_pdf_hash
Create Date: 2026-09-12
"""
from alembic import op

revision = "008_perf_indexes"
down_revision = "007_pdf_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS to be safe against indexes that may
    # already exist from model-level index=True declarations.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_books_created_at_desc
        ON books (created_at DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_comments_edition_created
        ON comments (edition_id, created_at)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_votes_user_id
        ON votes (user_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_reading_progress_user_id
        ON reading_progress (user_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_bookmarks_user_id
        ON bookmarks (user_id)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_bookmarks_user_id")
    op.execute("DROP INDEX IF EXISTS ix_reading_progress_user_id")
    op.execute("DROP INDEX IF EXISTS ix_votes_user_id")
    op.execute("DROP INDEX IF EXISTS ix_comments_edition_created")
    op.execute("DROP INDEX IF EXISTS ix_books_created_at_desc")
