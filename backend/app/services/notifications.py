"""
Notification push helper.

Call push_notification() immediately after committing the triggering event.
It writes a row to the notifications table for the recipient.

All writes are fire-and-forget within the same request:
we catch and swallow exceptions so a notification failure never
blocks the primary action (comment creation, edition upload, etc.).
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

logger = logging.getLogger(__name__)


async def push_notification(
    db: AsyncSession,
    *,
    recipient_id: int,
    actor_id: int,
    notif_type: str,
    message: str,
    link: str,
    detail: str | None = None,
    actor_username: str,
) -> None:
    """
    Write a notification row for recipient_id.

    Does nothing if recipient_id == actor_id (no self-notifications).
    Catches all exceptions -- a notification write failure must never
    break the calling request.
    """
    if recipient_id == actor_id:
        return

    try:
        notif = Notification(
            user_id=recipient_id,
            type=notif_type,
            message=message,
            detail=detail,
            link=link,
            actor=actor_username,
        )
        db.add(notif)
        # We do NOT commit here -- the caller's existing commit (or the
        # next one in the same request) will flush this row together with
        # the primary change. If the caller already committed, call
        # push_notification before commit instead, or call db.commit()
        # here explicitly (see usage notes below).
        #
        # Pattern used in this codebase:
        #   db.add(primary_object)
        #   await db.commit()
        #   await push_notification(db, ...)  <- separate commit below
        #   await db.commit()
        #
        # To keep it simple and safe we commit here ourselves.
        await db.commit()
    except Exception:
        logger.exception(
            "Failed to push notification type=%s recipient=%d actor=%s",
            notif_type,
            recipient_id,
            actor_username,
        )
        await db.rollback()
