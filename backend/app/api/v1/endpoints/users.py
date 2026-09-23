from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.db.session import get_db
from app.models.user import User
from app.models.book import Book
from app.models.edition import Edition
from app.models.comment import Comment
from app.models.reading_progress import ReadingProgress
from app.schemas.auth import UserResponse
from app.schemas.book import BookListItem
from app.schemas.comment import CommentWithContext


class CurrentlyReadingItem(BaseModel):
    edition_id: int
    last_page: int
    book_id: int
    book_title: str
    book_cover_url: str | None
    edition_number: int = 1

    model_config = {"from_attributes": True}


class UserProfile(BaseModel):
    user: UserResponse
    books_uploaded: list[BookListItem]
    recent_comments: list[CommentWithContext]
    currently_reading: list[CurrentlyReadingItem] = []

    model_config = {"from_attributes": True}


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{username}", response_model=UserProfile)
async def get_user_profile(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch books with edition count in one query
    books_result = await db.execute(
        select(Book, func.count(Edition.id).label("edition_count"))
        .outerjoin(Edition, Edition.book_id == Book.id)
        .where(Book.uploader_id == user.id)
        .group_by(Book.id)
        .order_by(Book.created_at.desc())
        .limit(20)
    )
    raw_books = books_result.all()
    book_ids_uploaded = [row[0].id for row in raw_books]

    comment_map_u: dict[int, int] = {}
    like_map_u: dict[int, int] = {}
    if book_ids_uploaded:
        from app.models.edition_like import EditionLike
        comment_res = await db.execute(
            select(Edition.book_id, func.count(Comment.id).label("cnt"))
            .join(Comment, Comment.edition_id == Edition.id)
            .where(Edition.book_id.in_(book_ids_uploaded), Comment.is_deleted.is_(False))
            .group_by(Edition.book_id)
        )
        comment_map_u = {r.book_id: r.cnt for r in comment_res.all()}
        like_res = await db.execute(
            select(Edition.book_id, func.count(EditionLike.id).label("cnt"))
            .join(EditionLike, EditionLike.edition_id == Edition.id)
            .where(Edition.book_id.in_(book_ids_uploaded))
            .group_by(Edition.book_id)
        )
        like_map_u = {r.book_id: r.cnt for r in like_res.all()}

    books = []
    for book, edition_count in raw_books:
        item = BookListItem.model_validate(book)
        item.edition_count = edition_count
        item.comment_count = comment_map_u.get(book.id, 0)
        item.like_count = like_map_u.get(book.id, 0)
        books.append(item)

    # Fetch recent comments with book and edition context
    comments_result = await db.execute(
        select(Comment, Book.title, Book.id.label("book_id"), Edition.edition_number)
        .join(Edition, Edition.id == Comment.edition_id)
        .join(Book, Book.id == Edition.book_id)
        .options(selectinload(Comment.author))
        .where(Comment.user_id == user.id, Comment.is_deleted.is_(False))
        .order_by(Comment.created_at.desc())
        .limit(20)
    )
    comment_rows = comments_result.all()

    # Currently reading -- editions with progress updated in the last 21 days
    # Books not opened in 3 weeks are considered inactive and removed from this section
    expiry_cutoff = datetime.now(timezone.utc) - timedelta(days=21)
    progress_result = await db.execute(
        select(ReadingProgress, Book, Edition)
        .join(Edition, Edition.id == ReadingProgress.edition_id)
        .join(Book, Book.id == Edition.book_id)
        .where(
            ReadingProgress.user_id == user.id,
            ReadingProgress.updated_at >= expiry_cutoff,
        )
        .order_by(ReadingProgress.updated_at.desc())
        .limit(20)
    )
    currently_reading = [
        CurrentlyReadingItem(
            edition_id=prog.edition_id,
            last_page=prog.last_page,
            book_id=book.id,
            book_title=book.title,
            book_cover_url=book.cover_url,
            edition_number=edition.edition_number,
        )
        for prog, book, edition in progress_result.all()
    ]

    return UserProfile(
        user=UserResponse.model_validate(user),
        books_uploaded=books,
        recent_comments=[
            CommentWithContext(
                id=c.id,
                body=c.body,
                page_number=c.page_number,
                edition_id=c.edition_id,
                user_id=c.user_id,
                parent_id=c.parent_id,
                vote_score=0,        # not computed on profile -- display only
                user_vote=None,
                is_deleted=c.is_deleted,
                created_at=c.created_at,
                updated_at=c.updated_at,
                edited_at=c.edited_at,
                book_title=book_title,
                book_id=int(book_id),
                edition_number=int(edition_number),
                reply_count=0,
            )
            for c, book_title, book_id, edition_number in comment_rows
        ],
        currently_reading=currently_reading,
    )
