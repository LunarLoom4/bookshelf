"""Delete books that have no editions (orphaned after edition-only deletion bug)

Revision ID: 013
Revises: 012
Create Date: 2026-09-25
"""
from alembic import op
import sqlalchemy as sa

revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Delete all books that have zero editions -- these are orphaned records
    # created when the "Delete Edition" button deleted the only edition but
    # left the parent book row intact (bug fixed in code, this cleans the DB).
    op.execute("""
        DELETE FROM books
        WHERE id NOT IN (
            SELECT DISTINCT book_id FROM editions
        )
    """)


def downgrade() -> None:
    pass  # Cannot restore deleted rows
