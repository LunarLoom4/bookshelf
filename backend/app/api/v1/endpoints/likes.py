"""
Edition likes: POST /editions/{id}/like to toggle, GET /editions/{id}/like for status.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.book import Book
from app.models.edition import Edition
from app.models.edition_like import EditionLike
from app.models.user import User
from app.services.notifications import push_notification

router = APIRouter(tags=["likes"])


class LikeStatus(BaseModel):
    liked: bool
    count: int


@router.get("/editions/{edition_id}/like", response_model=LikeStatus)
async def get_like_status(
    edition_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    count_result = await db.execute(
        select(func.count(EditionLike.id)).where(EditionLike.edition_id == edition_id)
    )
    count = count_result.scalar_one()

    liked = False
    if current_user:
        existing = await db.execute(
            select(EditionLike).where(
                EditionLike.user_id == current_user.id,
                EditionLike.edition_id == edition_id,
            )
        )
        liked = existing.scalar_one_or_none() is not None

    return LikeStatus(liked=liked, count=count)


@router.post("/editions/{edition_id}/like", response_model=LikeStatus)
async def toggle_like(
    edition_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    edition_result = await db.execute(
        select(Edition).where(Edition.id == edition_id)
    )
    edition = edition_result.scalar_one_or_none()
    if not edition:
        raise HTTPException(status_code=404, detail="Edition not found")

    existing = await db.execute(
        select(EditionLike).where(
            EditionLike.user_id == current_user.id,
            EditionLike.edition_id == edition_id,
        )
    )
    existing_like = existing.scalar_one_or_none()

    if existing_like:
        # Unlike
        await db.execute(
            delete(EditionLike).where(
                EditionLike.user_id == current_user.id,
                EditionLike.edition_id == edition_id,
            )
        )
        await db.commit()
        liked = False
    else:
        # Like
        db.add(EditionLike(user_id=current_user.id, edition_id=edition_id))
        await db.commit()
        liked = True

        # Notify book uploader (not if they liked their own edition)
        book_result = await db.execute(
            select(Book).where(Book.id == edition.book_id)
        )
        book = book_result.scalar_one_or_none()
        if book:
            await push_notification(
                db,
                recipient_id=book.uploader_id,
                actor_id=current_user.id,
                notif_type="edition_liked",
                message=f"{current_user.username} liked Edition {edition.edition_number} of \"{book.title}\"",
                detail=None,
                link=f"/books/{book.id}",
                actor_username=current_user.username,
            )

    count_result = await db.execute(
        select(func.count(EditionLike.id)).where(EditionLike.edition_id == edition_id)
    )
    count = count_result.scalar_one()
    return LikeStatus(liked=liked, count=count)
