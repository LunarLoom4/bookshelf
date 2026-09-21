"""
Notifications endpoint.

GET  /notifications/           -- list latest 30 for current user, newest first
POST /notifications/mark-read  -- mark all (or specific IDs) as read

Both endpoints gracefully return empty/204 if the notifications table
does not yet exist (migration 010 pending). This prevents the Navbar
polling from causing 500 errors before alembic upgrade head has run.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


class NotificationResponse(BaseModel):
    id: int
    type: str
    message: str
    detail: str | None
    link: str
    actor: str
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MarkReadRequest(BaseModel):
    ids: list[int] | None = None


@router.get("/", response_model=list[NotificationResponse])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the 30 most recent notifications for the current user, newest first.
    Returns [] if the notifications table does not exist yet.
    """
    try:
        result = await db.execute(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(30)
        )
        return result.scalars().all()
    except Exception:
        logger.warning(
            "get_notifications failed -- notifications table may not exist yet "
            "(run alembic upgrade head)"
        )
        await db.rollback()
        return []


@router.post("/mark-read", status_code=204)
async def mark_read(
    payload: MarkReadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark notifications as read.
    No-ops gracefully if the notifications table does not exist yet.
    """
    try:
        now = datetime.now(timezone.utc)

        if not payload.ids:
            await db.execute(
                update(Notification)
                .where(
                    Notification.user_id == current_user.id,
                    Notification.read_at.is_(None),
                )
                .values(read_at=now)
            )
        else:
            await db.execute(
                update(Notification)
                .where(
                    Notification.id.in_(payload.ids),
                    Notification.user_id == current_user.id,
                    Notification.read_at.is_(None),
                )
                .values(read_at=now)
            )

        await db.commit()
    except Exception:
        logger.warning(
            "mark_read failed -- notifications table may not exist yet "
            "(run alembic upgrade head)"
        )
        await db.rollback()
