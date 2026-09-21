"""
Notifications endpoint.

GET  /notifications/           -- list latest 30 for current user, newest first
POST /notifications/mark-read  -- mark all (or specific IDs) as read
"""
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
    # If ids is empty/null, ALL notifications for the user are marked read
    ids: list[int] | None = None


@router.get("/", response_model=list[NotificationResponse])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the 30 most recent notifications for the current user, newest first.
    Both read and unread are returned so the popup can show history.
    The frontend uses read_at to style unread vs read items.
    """
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(30)
    )
    return result.scalars().all()


@router.post("/mark-read", status_code=204)
async def mark_read(
    payload: MarkReadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark notifications as read.
    - payload.ids = None or []  ->  mark ALL unread notifications read ("Mark all as read")
    - payload.ids = [1, 2, 3]  ->  mark only those IDs read (single click)
    Always filters by user_id so users can only mark their own notifications.
    """
    now = datetime.now(timezone.utc)

    if not payload.ids:
        # Mark all unread for this user
        await db.execute(
            update(Notification)
            .where(
                Notification.user_id == current_user.id,
                Notification.read_at.is_(None),
            )
            .values(read_at=now)
        )
    else:
        # Mark specific IDs -- still enforce ownership
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
