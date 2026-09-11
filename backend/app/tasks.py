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
