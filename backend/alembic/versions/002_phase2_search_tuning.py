"""phase2 search tuning

Revision ID: 002_phase2_search_tuning
Revises: 001_initial
Create Date: 2026-09-07
"""
from alembic import op

revision = "002_phase2_search_tuning"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Set pg_trgm similarity threshold to 0.1 (permissive -- short queries still hit).
    # ALTER DATABASE requires a literal name, so we use a DO block to get the
    # current database name dynamically and run the ALTER via EXECUTE.
    op.execute("""
        DO $$
        DECLARE
            dbname text := current_database();
        BEGIN
            EXECUTE format(
                'ALTER DATABASE %I SET pg_trgm.similarity_threshold = 0.1',
                dbname
            );
        END
        $$;
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        DECLARE
            dbname text := current_database();
        BEGIN
            EXECUTE format(
                'ALTER DATABASE %I RESET pg_trgm.similarity_threshold',
                dbname
            );
        END
        $$;
    """)
