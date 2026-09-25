"""
Celery background tasks.
"""
import logging
from app.core.celery_app import celery_app
from app.core.config import settings

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.send_reply_notification", bind=True, max_retries=3)
def send_reply_notification(self, commenter_email: str, commenter_username: str,
                             reply_author: str, comment_body: str,
                             edition_id: int) -> None:
    """
    Send an email to the original commenter when someone replies to their comment.
    Retries up to 3 times with exponential backoff on failure.
    """
    if not settings.RESEND_API_KEY:
        logger.info("RESEND_API_KEY not set -- skipping email notification")
        return

    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY

        reading_url = f"https://yourdomain.com/read/{edition_id}"

        resend.Emails.send({
            "from": settings.FROM_EMAIL,
            "to": commenter_email,
            "subject": f"{reply_author} replied to your comment",
            "html": f"""
            <div style="font-family: serif; max-width: 520px; margin: 0 auto; padding: 32px;">
              <h2 style="font-size: 20px; color: #1c3089;">New reply on Bookshelf</h2>
              <p style="color: #374151; line-height: 1.6;">
                <strong>{reply_author}</strong> replied to your comment:
              </p>
              <blockquote style="border-left: 3px solid #3b6ef4; padding-left: 16px;
                                  color: #6b7280; font-style: italic; margin: 16px 0;">
                {comment_body[:300]}{"..." if len(comment_body) > 300 else ""}
              </blockquote>
              <a href="{reading_url}"
                 style="display: inline-block; background: #1c3089; color: white;
                         padding: 10px 20px; border-radius: 6px; text-decoration: none;
                         font-family: sans-serif; font-size: 14px;">
                View discussion
              </a>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
                You received this because someone replied to your comment on Bookshelf.
              </p>
            </div>
            """,
        })
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 30)


@celery_app.task(name="tasks.send_uploader_report", bind=True, max_retries=3)
def send_uploader_report(
    self,
    uploader_email: str,
    uploader_username: str,
    reporter_username: str,
    book_title: str,
    edition_number: int,
    subject_line: str,
    message_html: str,
    book_id: int,
    edition_id: int,
) -> None:
    """
    Email the uploader when another user submits a report about one of their editions.
    """
    if not settings.RESEND_API_KEY:
        logger.info("RESEND_API_KEY not set -- skipping uploader report email")
        return

    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY

        book_url = f"https://bookshelf-app.up.railway.app/books/{book_id}"

        resend.Emails.send({
            "from": settings.FROM_EMAIL,
            "to": uploader_email,
            "subject": f"[Bookshelf] Report on \"{book_title}\" (Ed. {edition_number}): {subject_line}",
            "html": f"""
            <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 32px;">
              <h2 style="font-size: 20px; color: #1c3089; margin-bottom: 4px;">
                Report on your book edition
              </h2>
              <p style="color: #6b7280; font-size: 13px; margin-top: 0;">
                {reporter_username} sent a report about
                <strong>{book_title}</strong> &mdash; Edition {edition_number}
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="font-size: 14px; color: #374151; margin-bottom: 4px;">
                <strong>Subject:</strong> {subject_line}
              </p>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
                          padding: 16px; font-size: 14px; color: #374151; line-height: 1.7;
                          margin-top: 12px;">
                {message_html}
              </div>
              <a href="{book_url}"
                 style="display: inline-block; margin-top: 24px; background: #1c3089;
                         color: white; padding: 10px 20px; border-radius: 6px;
                         text-decoration: none; font-size: 14px;">
                View book &rarr;
              </a>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 28px;">
                This report was submitted via Bookshelf by user
                <strong>{reporter_username}</strong>. You can edit the book's
                information using the Edit Info option on the book page.
              </p>
            </div>
            """,
        })
        logger.info("Uploader report email sent to %s", uploader_email)
    except Exception as exc:
        logger.error("send_uploader_report failed: %s", exc)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 30)


@celery_app.task(name="tasks.generate_cover_for_edition", bind=True, max_retries=2)
def generate_cover_for_edition(self, edition_id: int, pdf_r2_key: str, book_id: int) -> None:
    """
    Background task: download the PDF from R2, render page 1 as a JPEG cover,
    upload it to R2, and update the book's cover_url in the database.

    Called after a book is created without a user-provided cover so the user
    gets an immediate response without waiting for PyMuPDF rendering (~3-5s).
    """
    import asyncio
    from app.services import storage
    from app.db.session import AsyncSessionLocal
    from app.models.book import Book
    from app.models.edition import Edition
    from sqlalchemy import select

    async def _run() -> None:
        try:
            # Download the PDF from R2 (boto3 is synchronous -- run in thread)
            import boto3
            from botocore.config import Config
            client = boto3.client(
                "s3",
                endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4"),
                region_name="auto",
            )
            obj = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=pdf_r2_key)
            pdf_bytes = obj["Body"].read()

            # Render cover
            cover_bytes = storage.extract_first_page_as_cover(pdf_bytes)
            if not cover_bytes:
                logger.warning("generate_cover_for_edition: could not render cover for edition %s", edition_id)
                return

            # Upload cover to R2
            cover_key, cover_url = storage.upload_cover(cover_bytes, "cover.jpg", "image/jpeg")

            # Update book in DB
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Book).where(Book.id == book_id))
                book = result.scalar_one_or_none()
                if book and not book.cover_url:
                    # Only set if not already set (user may have uploaded one manually)
                    book.cover_url = cover_url
                    book.cover_r2_key = cover_key
                    await db.commit()
                    logger.info("generate_cover_for_edition: cover set for book %s", book_id)

        except Exception as exc:
            logger.error("generate_cover_for_edition failed: %s", exc)
            raise

    asyncio.run(_run())
