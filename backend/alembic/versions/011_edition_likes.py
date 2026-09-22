"""Create edition_likes table

Revision ID: 011_edition_likes
Revises: 010_notifications_table
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa

revision = "011_edition_likes"
down_revision = "010_notifications_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "edition_likes",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("edition_id", sa.Integer(), sa.ForeignKey("editions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "edition_id", name="uq_edition_like_user_edition"),
    )


def downgrade() -> None:
    op.drop_table("edition_likes")
