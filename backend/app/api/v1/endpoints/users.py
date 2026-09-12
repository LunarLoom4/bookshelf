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
from app.schemas.auth import UserResponse
from app.schemas.book import BookListItem
from app.schemas.comment import CommentResponse


class UserProfile(BaseModel):
    user: UserResponse
    books_uploaded: list[BookListItem]
    recent_comments: list[CommentResponse]

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

    return UserProfile(
        user=UserResponse.model_validate(user),
        books_uploaded=books,
        recent_comments=[CommentResponse.model_validate(c) for c in comments],
    )
