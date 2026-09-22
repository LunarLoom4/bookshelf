"""
User comment feed endpoints.

GET /users/{username}/commented-books
  Returns every book the user has commented on, with total comment count
  and per-edition breakdown (edition_id, edition_number, comment count).
  Used by the profile page Comments grid.

GET /users/{username}/comments
  Paginated comment feed for one book (book_id required).
  Supports: sort, search (q), page, limit.
  Returns comments + edition metadata so the frontend can group by edition.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.book import Book
from app.models.comment import Comment
from app.models.edition import Edition
from app.models.user import User
from app.models.vote import Vote

router = APIRouter(prefix="/users", tags=["user_comments"])


# ── Response schemas ──────────────────────────────────────────────────────────

class EditionCommentCount(BaseModel):
    edition_id: int
    edition_number: int
    comment_count: int


class CommentedBook(BaseModel):
    book_id: int
    title: str
    author: str
    cover_url: str | None
    total_comments: int
    editions: list[EditionCommentCount]


class CommentFeedItem(BaseModel):
    id: int
    body: str
    page_number: int | None
    edition_id: int
    edition_number: int
    parent_id: int | None
    vote_score: int
    created_at: str
    edited_at: str | None
    is_deleted: bool


class CommentFeedEdition(BaseModel):
    edition_id: int
    edition_number: int
    year: int | None
    publisher: str | None
    comment_count: int           # total matching comments in this edition
    comments: list[CommentFeedItem]


class CommentFeedResponse(BaseModel):
    book_id: int
    book_title: str
    book_author: str
    book_cover_url: str | None
    editions: list[CommentFeedEdition]
    total: int                   # total matching comments across all editions
    page: int
    limit: int
    has_more: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{username}/commented-books", response_model=list[CommentedBook])
async def get_commented_books(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Return all books the user has commented on, with per-edition counts.
    Used by the profile page Comments section.
    """
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get distinct books + editions with comment counts in one query
    rows = await db.execute(
        select(
            Book.id,
            Book.title,
            Book.author,
            Book.cover_url,
            Edition.id.label("edition_id"),
            Edition.edition_number,
            func.count(Comment.id).label("edition_comment_count"),
        )
        .join(Edition, Edition.book_id == Book.id)
        .join(Comment, Comment.edition_id == Edition.id)
        .where(
            Comment.user_id == user.id,
            Comment.is_deleted.is_(False),
            Comment.parent_id.is_(None),   # top-level only for the count
        )
        .group_by(Book.id, Book.title, Book.author, Book.cover_url, Edition.id, Edition.edition_number)
        .order_by(Book.id, Edition.edition_number)
    )

    # Also count replies
    reply_rows = await db.execute(
        select(
            Edition.book_id,
            Edition.id.label("edition_id"),
            func.count(Comment.id).label("reply_count"),
        )
        .join(Comment, Comment.edition_id == Edition.id)
        .where(
            Comment.user_id == user.id,
            Comment.is_deleted.is_(False),
            Comment.parent_id.isnot(None),
        )
        .group_by(Edition.book_id, Edition.id)
    )
    reply_map: dict[int, int] = {}
    for r in reply_rows.all():
        reply_map[r.edition_id] = reply_map.get(r.edition_id, 0) + r.reply_count

    # Aggregate into per-book structure
    books: dict[int, CommentedBook] = {}
    for row in rows.all():
        edition_count = row.edition_comment_count + reply_map.get(row.edition_id, 0)
        if row.id not in books:
            books[row.id] = CommentedBook(
                book_id=row.id,
                title=row.title,
                author=row.author,
                cover_url=row.cover_url,
                total_comments=0,
                editions=[],
            )
        books[row.id].editions.append(
            EditionCommentCount(
                edition_id=row.edition_id,
                edition_number=row.edition_number,
                comment_count=edition_count,
            )
        )
        books[row.id].total_comments += edition_count

    # Sort by most commented first
    return sorted(books.values(), key=lambda b: b.total_comments, reverse=True)


SORT_MAP = {
    "newest":    Comment.created_at.desc(),
    "oldest":    Comment.created_at.asc(),
    "upvotes":   None,   # handled with subquery
    "downvotes": None,   # handled with subquery
    "replies":   None,   # handled with subquery
    "page":      None,   # page_number asc
}


@router.get("/{username}/comments", response_model=CommentFeedResponse)
async def get_user_comments_for_book(
    username: str,
    book_id: int = Query(...),
    sort: str = Query("newest"),
    q: str = Query(""),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Paginated comment feed for a specific user + book combination.
    Returns comments grouped by edition, sorted and filtered.
    """
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    book_result = await db.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Edition ids for this book
    editions_result = await db.execute(
        select(Edition).where(Edition.book_id == book_id).order_by(Edition.edition_number.desc())
    )
    editions = editions_result.scalars().all()
    edition_ids = [e.id for e in editions]
    edition_map = {e.id: e for e in editions}

    if not edition_ids:
        return CommentFeedResponse(
            book_id=book_id, book_title=book.title, book_author=book.author,
            book_cover_url=book.cover_url, editions=[], total=0,
            page=page, limit=limit, has_more=False,
        )

    # Base filter
    base_filter = [
        Comment.user_id == user.id,
        Comment.edition_id.in_(edition_ids),
        Comment.is_deleted.is_(False),
    ]
    if q.strip():
        base_filter.append(Comment.body.ilike(f"%{q.strip()}%"))

    # Vote score subquery for sorting
    vote_score_sq = (
        select(Vote.comment_id, func.sum(Vote.value).label("score"))
        .group_by(Vote.comment_id)
        .subquery()
    )

    # Reply count subquery
    reply_sq = (
        select(Comment.parent_id, func.count(Comment.id).label("cnt"))
        .where(Comment.is_deleted.is_(False), Comment.parent_id.isnot(None))
        .group_by(Comment.parent_id)
        .subquery()
    )

    base_q = (
        select(Comment, vote_score_sq.c.score, reply_sq.c.cnt)
        .outerjoin(vote_score_sq, vote_score_sq.c.comment_id == Comment.id)
        .outerjoin(reply_sq, reply_sq.c.parent_id == Comment.id)
        .where(*base_filter)
    )

    # Apply sort
    if sort == "newest":
        base_q = base_q.order_by(Comment.created_at.desc())
    elif sort == "oldest":
        base_q = base_q.order_by(Comment.created_at.asc())
    elif sort == "upvotes":
        base_q = base_q.order_by((vote_score_sq.c.score).desc().nulls_last())
    elif sort == "downvotes":
        base_q = base_q.order_by((vote_score_sq.c.score).asc().nulls_last())
    elif sort == "replies":
        base_q = base_q.order_by((reply_sq.c.cnt).desc().nulls_last())
    elif sort == "page":
        base_q = base_q.order_by(Comment.page_number.asc().nulls_last())
    else:
        base_q = base_q.order_by(Comment.created_at.desc())

    # Total count
    count_result = await db.execute(
        select(func.count()).select_from(
            select(Comment.id).where(*base_filter).subquery()
        )
    )
    total = count_result.scalar_one()

    # Paginated fetch
    offset = (page - 1) * limit
    rows = await db.execute(base_q.offset(offset).limit(limit))
    rows_all = rows.all()

    # Group by edition
    edition_buckets: dict[int, list[CommentFeedItem]] = {}
    for comment, score, reply_cnt in rows_all:
        item = CommentFeedItem(
            id=comment.id,
            body=comment.body,
            page_number=comment.page_number,
            edition_id=comment.edition_id,
            edition_number=edition_map[comment.edition_id].edition_number,
            parent_id=comment.parent_id,
            vote_score=int(score or 0),
            created_at=comment.created_at.isoformat(),
            edited_at=comment.edited_at.isoformat() if comment.edited_at else None,
            is_deleted=comment.is_deleted,
        )
        edition_buckets.setdefault(comment.edition_id, []).append(item)

    # Per-edition comment counts (all matching, not just this page)
    count_by_edition_result = await db.execute(
        select(Comment.edition_id, func.count(Comment.id))
        .where(*base_filter)
        .group_by(Comment.edition_id)
    )
    count_by_edition = {eid: cnt for eid, cnt in count_by_edition_result.all()}

    # Build edition list -- only include editions with results on this page
    edition_list = []
    for eid, comments in edition_buckets.items():
        ed = edition_map[eid]
        edition_list.append(CommentFeedEdition(
            edition_id=eid,
            edition_number=ed.edition_number,
            year=ed.year if hasattr(ed, "year") else None,
            publisher=ed.publisher if hasattr(ed, "publisher") else None,
            comment_count=count_by_edition.get(eid, len(comments)),
            comments=comments,
        ))
    # Sort editions newest first
    edition_list.sort(key=lambda e: e.edition_number, reverse=True)

    return CommentFeedResponse(
        book_id=book_id,
        book_title=book.title,
        book_author=book.author,
        book_cover_url=book.cover_url,
        editions=edition_list,
        total=total,
        page=page,
        limit=limit,
        has_more=(offset + len(rows_all)) < total,
    )
