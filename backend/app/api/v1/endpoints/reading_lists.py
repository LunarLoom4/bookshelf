"""
Reading lists: named, optionally public lists of books.
Users manage their own lists; public lists are visible to anyone.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.book import Book
from app.models.reading_list import ReadingList, ReadingListItem
from app.models.user import User
from app.services.notifications import push_notification
from app.schemas.phase3 import (
    BookSummary,
    ReadingListCreate,
    ReadingListDetailResponse,
    ReadingListResponse,
    ReadingListUpdate,
)

router = APIRouter(prefix="/lists", tags=["reading_lists"])


async def _attach_covers(lists: list, db) -> list:
    """Attach up to 4 book cover URLs to each ReadingListResponse for collage display."""
    if not lists:
        return lists
    list_ids = [r.id for r in lists]
    # Fetch first 4 book covers per list
    from sqlalchemy import and_
    covers_result = await db.execute(
        select(ReadingListItem.list_id, Book.cover_url)
        .join(Book, Book.id == ReadingListItem.book_id)
        .where(
            ReadingListItem.list_id.in_(list_ids),
            Book.cover_url.isnot(None),
        )
        .order_by(ReadingListItem.list_id, ReadingListItem.added_at.desc())
    )
    # Group by list_id, keep first 4 per list
    covers_map: dict[int, list[str]] = {}
    for list_id, cover_url in covers_result.all():
        if list_id not in covers_map:
            covers_map[list_id] = []
        if len(covers_map[list_id]) < 4:
            covers_map[list_id].append(cover_url)
    for r in lists:
        r.cover_urls = covers_map.get(r.id, [])
    return lists


# ── Fixed-path routes FIRST (before parametric {list_id}) ─────────────────────

@router.get("/mine", response_model=list[ReadingListResponse])
async def get_my_lists(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all reading lists owned by the current user."""
    rows = await db.execute(
        select(ReadingList, func.count(ReadingListItem.id).label("item_count"))
        .outerjoin(ReadingListItem, ReadingListItem.list_id == ReadingList.id)
        .where(ReadingList.user_id == current_user.id)
        .group_by(ReadingList.id)
        .order_by(ReadingList.updated_at.desc())
    )
    result = []
    for rl, count in rows.all():
        r = ReadingListResponse.model_validate(rl)
        r.item_count = count
        result.append(r)
    return await _attach_covers(result, db)


@router.get("/by-user/{username}", response_model=list[ReadingListResponse])
async def get_user_public_lists(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Get reading lists for a user by username.
    Returns all lists if the requester is the owner; public lists only otherwise.
    """
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_owner = current_user is not None and current_user.id == user.id

    q = (
        select(ReadingList, func.count(ReadingListItem.id).label("item_count"))
        .outerjoin(ReadingListItem, ReadingListItem.list_id == ReadingList.id)
        .where(ReadingList.user_id == user.id)
        .group_by(ReadingList.id)
        .order_by(ReadingList.updated_at.desc())
    )
    if not is_owner:
        q = q.where(ReadingList.is_public.is_(True))

    rows = await db.execute(q)
    result = []
    for rl, count in rows.all():
        r = ReadingListResponse.model_validate(rl)
        r.item_count = count
        result.append(r)
    return await _attach_covers(result, db)


@router.post("/", response_model=ReadingListResponse, status_code=status.HTTP_201_CREATED)
async def create_list(
    payload: ReadingListCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new reading list."""
    reading_list = ReadingList(
        user_id=current_user.id,
        name=payload.name,
        is_public=payload.is_public,
    )
    db.add(reading_list)
    await db.commit()
    await db.refresh(reading_list)
    r = ReadingListResponse.model_validate(reading_list)
    r.item_count = 0
    return r


# ── Parametric {list_id} routes AFTER fixed-path routes ──────────────────────

@router.get("/{list_id}", response_model=ReadingListDetailResponse)
async def get_list(
    list_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Get a reading list with its items.
    Private lists are only visible to their owner.
    """
    result = await db.execute(
        select(ReadingList)
        .options(
            selectinload(ReadingList.items).selectinload(ReadingListItem.book)
        )
        .where(ReadingList.id == list_id)
    )
    reading_list = result.scalar_one_or_none()
    if not reading_list:
        raise HTTPException(status_code=404, detail="Reading list not found")
    if not reading_list.is_public:
        if not current_user or current_user.id != reading_list.user_id:
            raise HTTPException(status_code=403, detail="This list is private")

    # Fetch edition counts for all books in one query
    book_ids = [item.book_id for item in reading_list.items]
    edition_counts: dict[int, int] = {}
    if book_ids:
        from sqlalchemy import func as sqlfunc
        from app.models.edition import Edition
        counts_result = await db.execute(
            select(Edition.book_id, sqlfunc.count(Edition.id).label("edition_count"))
            .where(Edition.book_id.in_(book_ids))
            .group_by(Edition.book_id)
        )
        edition_counts = {row.book_id: row.edition_count for row in counts_result.all()}

    # Build response -- book is already loaded via selectinload, no lazy loads
    response = ReadingListDetailResponse.model_validate(reading_list)
    for resp_item, orm_item in zip(response.items, reading_list.items):
        if orm_item.book:
            resp_item.book = BookSummary(
                id=orm_item.book.id,
                title=orm_item.book.title,
                author=orm_item.book.author,
                description=orm_item.book.description,
                cover_url=orm_item.book.cover_url,
                created_at=orm_item.book.created_at,
                edition_count=edition_counts.get(orm_item.book.id, 0),
            )
    return response


@router.patch("/{list_id}", response_model=ReadingListResponse)
async def update_list(
    list_id: int,
    payload: ReadingListUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rename a list or change its visibility."""
    reading_list = await db.get(ReadingList, list_id)
    if not reading_list or reading_list.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Reading list not found")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="name cannot be empty")
        reading_list.name = name
    if payload.is_public is not None:
        reading_list.is_public = payload.is_public

    await db.commit()
    await db.refresh(reading_list)

    count_result = await db.execute(
        select(func.count(ReadingListItem.id)).where(ReadingListItem.list_id == list_id)
    )
    r = ReadingListResponse.model_validate(reading_list)
    r.item_count = count_result.scalar_one()
    return r


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(
    list_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a reading list and all its items."""
    reading_list = await db.get(ReadingList, list_id)
    if not reading_list or reading_list.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Reading list not found")
    await db.delete(reading_list)
    await db.commit()


# ── Items ──────────────────────────────────────────────────────────────────────

@router.post("/{list_id}/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_book_to_list(
    list_id: int,
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a book to a reading list. Idempotent -- no error if already present."""
    reading_list = await db.get(ReadingList, list_id)
    if not reading_list or reading_list.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Reading list not found")

    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    existing = await db.execute(
        select(ReadingListItem).where(
            ReadingListItem.list_id == list_id,
            ReadingListItem.book_id == book_id,
        )
    )
    if existing.scalar_one_or_none():
        return  # Already present -- idempotent

    item = ReadingListItem(list_id=list_id, book_id=book_id)
    db.add(item)
    await db.commit()

    # Notify the book uploader that someone added their book to a list
    await push_notification(
        db,
        recipient_id=book.uploader_id,
        actor_id=current_user.id,
        notif_type="book_added_to_list",
        message=f"{current_user.username} added \"{book.title}\" to their list \"{reading_list.name}\"",
        detail=None,
        link=f"/books/{book_id}",
        actor_username=current_user.username,
    )


@router.delete("/{list_id}/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_book_from_list(
    list_id: int,
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a book from a reading list."""
    reading_list = await db.get(ReadingList, list_id)
    if not reading_list or reading_list.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Reading list not found")

    item_result = await db.execute(
        select(ReadingListItem).where(
            ReadingListItem.list_id == list_id,
            ReadingListItem.book_id == book_id,
        )
    )
    item_obj = item_result.scalar_one_or_none()
    if item_obj:
        await db.delete(item_obj)
        await db.commit()
