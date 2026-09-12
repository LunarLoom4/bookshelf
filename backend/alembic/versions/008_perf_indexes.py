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
    # Book list ordered by created_at DESC -- the Browse page default sort
    op.create_index(
        "ix_books_created_at_desc",
        "books",
        ["created_at"],
        postgresql_ops={"created_at": "DESC"},
    )

    # Comment list per edition ordered by created_at DESC (newest sort)
    # Composite index covers both the WHERE and ORDER BY in one scan
    op.create_index(
        "ix_comments_edition_created",
        "comments",
        ["edition_id", "created_at"],
    )

    # Votes lookup per user (for enriching comment lists with user's own vote)
    op.create_index(
        "ix_votes_user_id",
        "votes",
        ["user_id"],
    )

    # Reading progress lookup per user
    op.create_index(
        "ix_reading_progress_user_id",
        "reading_progress",
        ["user_id"],
    )

    # Bookmarks lookup per user
    op.create_index(
        "ix_bookmarks_user_id",
        "bookmarks",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_bookmarks_user_id", "bookmarks")
    op.drop_index("ix_reading_progress_user_id", "reading_progress")
    op.drop_index("ix_votes_user_id", "votes")
    op.drop_index("ix_comments_edition_created", "comments")
    op.drop_index("ix_books_created_at_desc", "books")
