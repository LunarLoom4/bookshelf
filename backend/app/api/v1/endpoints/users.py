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
from app.schemas.comment import CommentResponse


class CurrentlyReadingItem(BaseModel):
    edition_id: int
    last_page: int
    book_id: int
    book_title: str
    book_cover_url: str | None

    model_config = {"from_attributes": True}


class UserProfile(BaseModel):
    user: UserResponse
    books_uploaded: list[BookListItem]
    recent_comments: list[CommentResponse]
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
    books = []
    for row in books_result.all():
        book, edition_count = row
        item = BookListItem.model_validate(book)
        item.edition_count = edition_count
        books.append(item)

    # Fetch recent comments with author loaded
    comments_result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.user_id == user.id, Comment.is_deleted.is_(False))
        .order_by(Comment.created_at.desc())
        .limit(20)
    )
    comments = list(comments_result.scalars())

    # 17: Currently reading -- editions the user has progress on, newest first
    progress_result = await db.execute(
        select(ReadingProgress, Book, Edition)
        .join(Edition, Edition.id == ReadingProgress.edition_id)
        .join(Book, Book.id == Edition.book_id)
        .where(ReadingProgress.user_id == user.id)
        .order_by(ReadingProgress.updated_at.desc())
        .limit(6)
    )
    currently_reading = [
        CurrentlyReadingItem(
            edition_id=prog.edition_id,
            last_page=prog.last_page,
            book_id=book.id,
            book_title=book.title,
            book_cover_url=book.cover_url,
        )
        for prog, book, edition in progress_result.all()
    ]

    return UserProfile(
        user=UserResponse.model_validate(user),
        books_uploaded=books,
        recent_comments=[CommentResponse.model_validate(c) for c in comments],
        currently_reading=currently_reading,
    )
