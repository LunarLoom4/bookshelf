"""user settings columns

Revision ID: 005_user_settings
Revises: 004_google_oauth
Create Date: 2026-09-10
"""
from alembic import op
import sqlalchemy as sa

revision = "005_user_settings"
down_revision = "004_google_oauth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(1000), nullable=True))
    op.add_column("users", sa.Column("avatar_r2_key", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_r2_key")
    op.drop_column("users", "avatar_url")
