"""
Private bookmarks for a user on an edition.
All endpoints require authentication; bookmarks are private (owner-only).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.bookmark import Bookmark
from app.models.edition import Edition
from app.models.user import User
from app.schemas.phase3 import BookmarkCreate, BookmarkUpdate, BookmarkResponse

router = APIRouter(prefix="/editions/{edition_id}/bookmarks", tags=["bookmarks"])


@router.get("/", response_model=list[BookmarkResponse])
async def list_bookmarks(
    edition_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all bookmarks the current user has for this edition, ordered by page."""
    result = await db.execute(
        select(Bookmark)
        .where(
            Bookmark.user_id == current_user.id,
            Bookmark.edition_id == edition_id,
        )
        .order_by(Bookmark.page_number)
    )
    return list(result.scalars())


@router.post("/", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
async def create_bookmark(
    edition_id: int,
    payload: BookmarkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a bookmark on a specific page of this edition."""
    edition = await db.get(Edition, edition_id)
    if not edition:
        raise HTTPException(status_code=404, detail="Edition not found")

    bookmark = Bookmark(
        user_id=current_user.id,
        edition_id=edition_id,
        page_number=payload.page_number,
        note=payload.note,
    )
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)
    return bookmark


@router.patch("/{bookmark_id}", response_model=BookmarkResponse)
async def update_bookmark(
    edition_id: int,
    bookmark_id: int,
    payload: BookmarkUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the note on an existing bookmark."""
    bookmark = await db.get(Bookmark, bookmark_id)
    if not bookmark or bookmark.user_id != current_user.id or bookmark.edition_id != edition_id:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    bookmark.note = payload.note
    await db.commit()
    await db.refresh(bookmark)
    return bookmark


@router.delete("/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bookmark(
    edition_id: int,
    bookmark_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a bookmark."""
    bookmark = await db.get(Bookmark, bookmark_id)
    if not bookmark or bookmark.user_id != current_user.id or bookmark.edition_id != edition_id:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    await db.delete(bookmark)
    await db.commit()
