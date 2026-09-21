"""
Notification push helper.

Uses its OWN independent DB session, never the caller's request session.
This is critical: if the notifications table doesn't exist yet (migration
pending) or any other DB error occurs, it cannot corrupt or roll back the
caller's already-committed transaction.

Fire-and-forget: exceptions are caught and logged, never re-raised.
"""
import logging
from app.db.session import AsyncSessionLocal
from app.models.notification import Notification

logger = logging.getLogger(__name__)


async def push_notification(
    db,  # kept for call-site compatibility but intentionally NOT used
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
    Write a notification row for recipient_id using a fresh DB session.

    The `db` parameter is accepted for call-site compatibility but is
    deliberately ignored -- we open our own session so that a failure here
    (e.g. notifications table not yet migrated) can never affect the
    caller's already-committed transaction.

    Does nothing if recipient_id == actor_id (no self-notifications).
    """
    if recipient_id == actor_id:
        return

    try:
        async with AsyncSessionLocal() as session:
            notif = Notification(
                user_id=recipient_id,
                type=notif_type,
                message=message,
                detail=detail,
                link=link,
                actor=actor_username,
            )
            session.add(notif)
            await session.commit()
    except Exception:
        logger.exception(
            "push_notification failed (type=%s recipient=%d actor=%s) -- "
            "primary operation is unaffected",
            notif_type,
            recipient_id,
            actor_username,
        )
