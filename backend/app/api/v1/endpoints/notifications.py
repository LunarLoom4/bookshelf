"""
Notifications endpoint — returns events that happened to the logged-in user
that they didn't cause themselves:
  - New comments on books they uploaded
  - New editions added to books they uploaded
  - Replies to their comments (by other users)
  - New reading-list additions of their books
"""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.book import Book
from app.models.comment import Comment
from app.models.edition import Edition
from app.models.reading_list import ReadingList, ReadingListItem
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days: int = 30,
):
    """
    Returns up to 20 most recent notification events for the current user.
    All events are caused by OTHER users, never by the current user themselves.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    uid = current_user.id
    events = []

    # 1. New comments on books the current user uploaded
    # (top-level comments only, not replies -- replies are handled separately below)
    books_i_own = select(Book.id).where(Book.uploader_id == uid)
    editions_of_my_books = select(Edition.id).where(Edition.book_id.in_(books_i_own))

    new_comments_result = await db.execute(
        select(Comment, User.username, Book.title)
        .join(User, User.id == Comment.user_id)
        .join(Edition, Edition.id == Comment.edition_id)
        .join(Book, Book.id == Edition.book_id)
        .where(
            Comment.edition_id.in_(editions_of_my_books),
            Comment.user_id != uid,           # not my own comment
            Comment.parent_id.is_(None),       # top-level only
            Comment.is_deleted.is_(False),
            Comment.created_at >= cutoff,
        )
        .order_by(Comment.created_at.desc())
        .limit(10)
    )
    for comment, username, book_title in new_comments_result.all():
        events.append({
            "type": "new_comment_on_my_book",
            "message": f"{username} commented on \"{book_title}\"",
            "detail": comment.body[:100] + ("…" if len(comment.body) > 100 else ""),
            "link": f"/read/{comment.edition_id}",
            "created_at": comment.created_at.isoformat(),
            "actor": username,
        })

    # 2. Replies to MY comments by other users
    my_comment_ids = select(Comment.id).where(
        Comment.user_id == uid,
        Comment.is_deleted.is_(False),
    )
    replies_result = await db.execute(
        select(Comment, User.username, Book.title)
        .join(User, User.id == Comment.user_id)
        .join(Edition, Edition.id == Comment.edition_id)
        .join(Book, Book.id == Edition.book_id)
        .where(
            Comment.parent_id.in_(my_comment_ids),
            Comment.user_id != uid,
            Comment.is_deleted.is_(False),
            Comment.created_at >= cutoff,
        )
        .order_by(Comment.created_at.desc())
        .limit(10)
    )
    for comment, username, book_title in replies_result.all():
        events.append({
            "type": "reply_to_my_comment",
            "message": f"{username} replied to your comment in \"{book_title}\"",
            "detail": comment.body[:100] + ("…" if len(comment.body) > 100 else ""),
            "link": f"/read/{comment.edition_id}",
            "created_at": comment.created_at.isoformat(),
            "actor": username,
        })

    # 3. New editions added to books I uploaded (by other users)
    new_editions_result = await db.execute(
        select(Edition, User.username, Book.title)
        .join(User, User.id == Edition.uploader_id)
        .join(Book, Book.id == Edition.book_id)
        .where(
            Edition.book_id.in_(books_i_own),
            Edition.uploader_id != uid,
            Edition.created_at >= cutoff,
        )
        .order_by(Edition.created_at.desc())
        .limit(5)
    )
    for edition, username, book_title in new_editions_result.all():
        events.append({
            "type": "new_edition_on_my_book",
            "message": f"{username} added Edition {edition.edition_number} to \"{book_title}\"",
            "detail": None,
            "link": f"/books/{edition.book_id}",
            "created_at": edition.created_at.isoformat(),
            "actor": username,
        })

    # 4. Books I uploaded added to someone's reading list
    my_books_in_lists_result = await db.execute(
        select(ReadingListItem, User.username, Book.title, ReadingList.name)
        .join(ReadingList, ReadingList.id == ReadingListItem.list_id)
        .join(User, User.id == ReadingList.user_id)
        .join(Edition, Edition.book_id == ReadingListItem.book_id)
        .join(Book, Book.id == ReadingListItem.book_id)
        .where(
            Book.uploader_id == uid,
            ReadingList.user_id != uid,
            ReadingListItem.added_at >= cutoff,
        )
        .order_by(ReadingListItem.added_at.desc())
        .limit(5)
    )
    for item, username, book_title, list_name in my_books_in_lists_result.all():
        events.append({
            "type": "book_added_to_list",
            "message": f"{username} added \"{book_title}\" to their list \"{list_name}\"",
            "detail": None,
            "link": f"/books/{item.book_id}",
            "created_at": item.added_at.isoformat(),
            "actor": username,
        })

    # Sort all events by time, newest first, take top 20
    events.sort(key=lambda e: e["created_at"], reverse=True)
    return events[:20]
