"""Add is_deleted and edited_at to comments

Revision ID: 006
Revises: 005
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa

revision = "006_comment_edit_delete"
down_revision = "005_user_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Soft-delete flag -- keeps row so replies aren't orphaned
    op.add_column("comments", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"))
    # Track when a comment was edited
    op.add_column("comments", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("comments", "edited_at")
    op.drop_column("comments", "is_deleted")
