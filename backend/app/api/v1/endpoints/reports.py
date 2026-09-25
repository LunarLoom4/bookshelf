"""
POST /books/{book_id}/editions/{edition_id}/report

Lets any authenticated user send a report to the book's uploader.
The report is emailed via Resend (Celery task) and stored in the DB
in a lightweight `edition_reports` table for audit purposes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit_report
from app.db.session import get_db
from app.models.book import Book
from app.models.edition import Edition
from app.models.user import User

router = APIRouter()


class ReportCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    message_html: str = Field(..., min_length=10, max_length=20000)


@router.post(
    "/books/{book_id}/editions/{edition_id}/report",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def report_edition(
    book_id: int,
    edition_id: int,
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a report about an edition to its uploader via email."""
    # Rate limit: 10 reports per hour per user
    await rate_limit_report(current_user.id)

    # Fetch book + edition
    book_result = await db.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    ed_result = await db.execute(
        select(Edition).where(Edition.id == edition_id, Edition.book_id == book_id)
    )
    edition = ed_result.scalar_one_or_none()
    if not edition:
        raise HTTPException(status_code=404, detail="Edition not found")

    # Prevent uploader from reporting their own edition
    if book.uploader_id == current_user.id:
        raise HTTPException(status_code=403, detail="You cannot report your own edition")

    # Fetch uploader
    uploader_result = await db.execute(select(User).where(User.id == book.uploader_id))
    uploader = uploader_result.scalar_one_or_none()
    if not uploader or not uploader.email:
        raise HTTPException(status_code=404, detail="Uploader not found")

    # Fire Celery task (non-blocking)
    from app.tasks import send_uploader_report
    send_uploader_report.delay(
        uploader_email=uploader.email,
        uploader_username=uploader.username,
        reporter_username=current_user.username,
        book_title=book.title,
        edition_number=edition.edition_number,
        subject_line=body.subject,
        message_html=body.message_html,
        book_id=book_id,
        edition_id=edition_id,
    )
