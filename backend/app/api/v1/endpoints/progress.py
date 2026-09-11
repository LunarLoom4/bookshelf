"""
Reading progress: GET and POST /editions/{edition_id}/progress
Upserts last_page for the current user on a given edition.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.edition import Edition
from app.models.reading_progress import ReadingProgress
from app.models.user import User
from app.schemas.phase3 import ProgressResponse, ProgressUpsert

router = APIRouter(prefix="/editions/{edition_id}/progress", tags=["progress"])


@router.get("/", response_model=ProgressResponse | None)
async def get_progress(
    edition_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the caller's last-read page for this edition, or null if not started."""
    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.user_id == current_user.id,
            ReadingProgress.edition_id == edition_id,
        )
    )
    return result.scalar_one_or_none()


@router.post("/", response_model=ProgressResponse)
async def upsert_progress(
    edition_id: int,
    payload: ProgressUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save (or update) the caller's last-read page for this edition.
    Uses PostgreSQL INSERT … ON CONFLICT DO UPDATE for an atomic upsert.
    """
    # Verify edition exists
    edition = await db.get(Edition, edition_id)
    if not edition:
        raise HTTPException(status_code=404, detail="Edition not found")

    stmt = (
        pg_insert(ReadingProgress)
        .values(
            user_id=current_user.id,
            edition_id=edition_id,
            last_page=payload.last_page,
        )
        .on_conflict_do_update(
            constraint="uq_progress_user_edition",
            set_={
                "last_page": payload.last_page,
                "updated_at": func.now(),
            },
        )
    )
    await db.execute(stmt)
    await db.commit()

    # Re-fetch to get server-side updated_at (RETURNING may not reflect onupdate)
    row = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.user_id == current_user.id,
            ReadingProgress.edition_id == edition_id,
        )
    )
    return row.scalar_one()
