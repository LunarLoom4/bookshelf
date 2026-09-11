"""google oauth columns

Revision ID: 004_google_oauth
Revises: 003_phase3_tables
Create Date: 2026-09-10
"""
from alembic import op
import sqlalchemy as sa

revision = "004_google_oauth"
down_revision = "003_phase3_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make hashed_password nullable (Google users have no password)
    op.alter_column("users", "hashed_password", nullable=True)

    # Add google_id column for OAuth account linking
    op.add_column(
        "users",
        sa.Column("google_id", sa.String(255), nullable=True),
    )
    op.create_index("ix_users_google_id", "users", ["google_id"])
    op.create_unique_constraint("uq_users_google_id", "users", ["google_id"])


def downgrade() -> None:
    op.drop_constraint("uq_users_google_id", "users", type_="unique")
    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_column("users", "google_id")
    op.alter_column("users", "hashed_password", nullable=False)
