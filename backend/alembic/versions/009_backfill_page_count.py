"""Backfill page_count for existing editions by reading PDF from R2

Revision ID: 009_backfill_page_count
Revises: 008_perf_indexes
Create Date: 2026-09-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

revision = "009_backfill_page_count"
down_revision = "008_perf_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # For editions where page_count is NULL, try to count pages from the PDF
    # We use fitz (PyMuPDF) which is already installed, and fetch the PDF from R2
    bind = op.get_bind()
    session = Session(bind=bind)

    try:
        import fitz
        import httpx

        rows = session.execute(
            sa.text("SELECT id, pdf_url FROM editions WHERE page_count IS NULL AND pdf_url IS NOT NULL")
        ).fetchall()

        print(f"Backfilling page_count for {len(rows)} editions...")
        for edition_id, pdf_url in rows:
            try:
                resp = httpx.get(pdf_url, timeout=60, follow_redirects=True)
                if resp.status_code == 200:
                    doc = fitz.open(stream=resp.content, filetype="pdf")
                    pc = doc.page_count
                    if pc > 0:
                        session.execute(
                            sa.text("UPDATE editions SET page_count = :pc WHERE id = :id"),
                            {"pc": pc, "id": edition_id}
                        )
                        print(f"  Edition {edition_id}: {pc} pages")
            except Exception as e:
                print(f"  Edition {edition_id}: failed ({e})")

        session.commit()
        print("Backfill complete.")
    except Exception as e:
        print(f"Backfill skipped: {e}")
        session.rollback()


def downgrade() -> None:
    pass  # No downgrade needed -- page_count column stays, just nulled out
