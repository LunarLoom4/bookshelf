"""
User comment feed endpoints.

GET /users/{username}/commented-books
  Returns every book the user has commented on, with total comment count
  and per-edition breakdown.

GET /users/{username}/comments
  Paginated, sortable, searchable comment feed for one book.

  Sort logic:
    newest:    created_at DESC, id DESC              -- most recent first
    oldest:    created_at ASC, id ASC               -- chronological
    upvotes:   coalesce(score,0) DESC, created_at DESC  -- highest score first; ties go to newest
    downvotes: coalesce(score,0) ASC, created_at DESC   -- lowest (most negative) first; ties newest
    replies:   reply_count DESC, created_at DESC    -- most engaged threads first

  Only TOP-LEVEL comments are shown (parent_id IS NULL). Replies live in
  the reader and showing them here would be confusing and misleading.

  Pagination is per-edition: each edition independently fetches page N of
  its own comments in the requested sort order. This ensures that:
    - The comment count badge on each edition header matches what's shown
    - Sorting criteria apply within each edition independently
    - Page 2 for Edition 6 doesn't mix with Edition 5's comments
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

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
    file_size_bytes: int | None
    page_count: int | None
    comment_count: int           # total matching top-level comments for this edition
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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_sort_order(sort: str, vote_score_sq, reply_sq):
    """
    Return SQLAlchemy order_by clauses for the given sort key.
    Always includes a stable tiebreaker (created_at DESC, id DESC) so
    the sort is deterministic even when the primary criterion is equal.

    NULL handling:
      - vote scores: coalesce(score, 0) so unvoted comments are treated
        as score=0, sitting between positive and negative comments.
      - reply counts: coalesce(cnt, 0) so no-reply comments sort last
        on replies sort.
    """
    score_col = func.coalesce(vote_score_sq.c.score, 0)
    reply_col = func.coalesce(reply_sq.c.cnt, 0)

    if sort == "oldest":
        return [Comment.created_at.asc(), Comment.id.asc()]
    elif sort == "upvotes":
        # Highest net score first; ties broken by newest
        return [score_col.desc(), Comment.created_at.desc(), Comment.id.desc()]
    elif sort == "downvotes":
        # Lowest net score first (most negative); ties broken by newest
        return [score_col.asc(), Comment.created_at.desc(), Comment.id.desc()]
    elif sort == "replies":
        # Most-replied-to first; ties broken by newest
        return [reply_col.desc(), Comment.created_at.desc(), Comment.id.desc()]
    else:  # "newest" and any unknown sort
        return [Comment.created_at.desc(), Comment.id.desc()]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{username}/commented-books", response_model=list[CommentedBook])
async def get_commented_books(
    username: str,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """
    Return all books the user has commented on (top-level comments only),
    with per-edition counts. Sorted by most commented book first.
    """
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

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
        )
        .group_by(Book.id, Book.title, Book.author, Book.cover_url, Edition.id, Edition.edition_number)
        .order_by(Book.id, Edition.edition_number)
    )

    books: dict[int, CommentedBook] = {}
    for row in rows.all():
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
                comment_count=row.edition_comment_count,
            )
        )
        books[row.id].total_comments += row.edition_comment_count

    sorted_books = sorted(books.values(), key=lambda b: b.total_comments, reverse=True)
    return sorted_books[skip: skip + limit]


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
    Paginated comment feed for a specific user + book.

    Pagination is per-edition: each edition independently paginates its own
    comments in the requested sort order, so the comment count shown in each
    edition's header always matches the comments actually displayed.

    Only top-level comments (parent_id IS NULL) are shown. Replies belong
    in the reader context, not in a linear feed.
    """
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    book_result = await db.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Fetch all editions for this book, newest edition first
    editions_result = await db.execute(
        select(Edition)
        .where(Edition.book_id == book_id)
        .order_by(Edition.edition_number.desc())
    )
    editions = editions_result.scalars().all()

    if not editions:
        return CommentFeedResponse(
            book_id=book_id, book_title=book.title, book_author=book.author,
            book_cover_url=book.cover_url, editions=[], total=0,
            page=page, limit=limit, has_more=False,
        )

    # Build shared subqueries for vote scores and reply counts
    # These cover ALL comments so they work regardless of which edition we filter
    vote_score_sq = (
        select(Vote.comment_id, func.sum(Vote.value).label("score"))
        .group_by(Vote.comment_id)
        .subquery()
    )
    reply_sq = (
        select(Comment.parent_id, func.count(Comment.id).label("cnt"))
        .where(Comment.is_deleted.is_(False), Comment.parent_id.isnot(None))
        .group_by(Comment.parent_id)
        .subquery()
    )
    order_clauses = _build_sort_order(sort, vote_score_sq, reply_sq)

    edition_list: list[CommentFeedEdition] = []
    grand_total = 0
    any_has_more = False

    for ed in editions:
        # Base filter for this edition: this user, top-level only, not deleted
        base_filter = [
            Comment.user_id == user.id,
            Comment.edition_id == ed.id,
            Comment.is_deleted.is_(False),
        ]
        if q.strip():
            base_filter.append(Comment.body.ilike(f"%{q.strip()}%"))

        # Count matching comments for this edition
        count_result = await db.execute(
            select(func.count(Comment.id)).where(*base_filter)
        )
        edition_total = count_result.scalar_one()
        grand_total += edition_total

        if edition_total == 0:
            # Include the edition in the response so the accordion always renders
            # but with an empty comment list -- user can see all their editions
            edition_list.append(CommentFeedEdition(
                edition_id=ed.id,
                edition_number=ed.edition_number,
                year=ed.year,
                publisher=ed.publisher,
                file_size_bytes=ed.file_size_bytes,
                page_count=ed.page_count,
                comment_count=0,
                comments=[],
            ))
            continue

        # Paginated, sorted fetch for this edition
        offset = (page - 1) * limit
        rows = await db.execute(
            select(Comment, vote_score_sq.c.score, reply_sq.c.cnt)
            .outerjoin(vote_score_sq, vote_score_sq.c.comment_id == Comment.id)
            .outerjoin(reply_sq, reply_sq.c.parent_id == Comment.id)
            .where(*base_filter)
            .order_by(*order_clauses)
            .offset(offset)
            .limit(limit)
        )
        rows_all = rows.all()

        if (offset + len(rows_all)) < edition_total:
            any_has_more = True

        comments = [
            CommentFeedItem(
                id=c.id,
                body=c.body,
                page_number=c.page_number,
                edition_id=c.edition_id,
                edition_number=ed.edition_number,
                parent_id=c.parent_id,
                vote_score=int(score or 0),
                created_at=c.created_at.isoformat(),
                edited_at=c.edited_at.isoformat() if c.edited_at else None,
                is_deleted=c.is_deleted,
            )
            for c, score, _ in rows_all
        ]

        # Only include editions that have comments on this page
        # (editions with no matches on this page were already handled above with empty list)
        if comments:
            edition_list.append(CommentFeedEdition(
                edition_id=ed.id,
                edition_number=ed.edition_number,
                year=ed.year,
                publisher=ed.publisher,
                file_size_bytes=ed.file_size_bytes,
                page_count=ed.page_count,
                comment_count=edition_total,
                comments=comments,
            ))

    # Editions already sorted newest first from the DB query above
    return CommentFeedResponse(
        book_id=book_id,
        book_title=book.title,
        book_author=book.author,
        book_cover_url=book.cover_url,
        editions=edition_list,
        total=grand_total,
        page=page,
        limit=limit,
        has_more=any_has_more,
    )
