"""phase3 tables

Revision ID: 003_phase3_tables
Revises: 002_phase2_search_tuning
Create Date: 2026-09-10
"""
from alembic import op
import sqlalchemy as sa

revision = "003_phase3_tables"
down_revision = "002_phase2_search_tuning"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── reading_progress ───────────────────────────────────────────────────────
    op.create_table(
        "reading_progress",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("edition_id", sa.Integer(),
                  sa.ForeignKey("editions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("last_page", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "edition_id", name="uq_progress_user_edition"),
    )
    op.create_index("ix_reading_progress_user_id", "reading_progress", ["user_id"])
    op.create_index("ix_reading_progress_edition_id", "reading_progress", ["edition_id"])

    # ── bookmarks ──────────────────────────────────────────────────────────────
    op.create_table(
        "bookmarks",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("edition_id", sa.Integer(),
                  sa.ForeignKey("editions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_bookmarks_user_id", "bookmarks", ["user_id"])
    op.create_index("ix_bookmarks_edition_id", "bookmarks", ["edition_id"])

    # ── reading_lists ──────────────────────────────────────────────────────────
    op.create_table(
        "reading_lists",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_reading_lists_user_id", "reading_lists", ["user_id"])

    # ── reading_list_items ─────────────────────────────────────────────────────
    op.create_table(
        "reading_list_items",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("list_id", sa.Integer(),
                  sa.ForeignKey("reading_lists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("book_id", sa.Integer(),
                  sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("list_id", "book_id", name="uq_list_item_book"),
    )
    op.create_index("ix_reading_list_items_list_id", "reading_list_items", ["list_id"])
    op.create_index("ix_reading_list_items_book_id", "reading_list_items", ["book_id"])


def downgrade() -> None:
    op.drop_table("reading_list_items")
    op.drop_table("reading_lists")
    op.drop_table("bookmarks")
    op.drop_table("reading_progress")
