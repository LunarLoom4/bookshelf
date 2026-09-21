from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.book import Book
from app.models.comment import Comment
from app.models.edition import Edition
from app.models.user import User
from app.models.vote import Vote
from app.schemas.comment import CommentCreate, CommentUpdate, CommentResponse, VoteRequest
from app.services.notifications import push_notification
from app.tasks import send_reply_notification

router = APIRouter(prefix="/editions/{edition_id}/comments", tags=["comments"])


async def _enrich(comments: list[Comment], current_user: User | None, db: AsyncSession) -> list[CommentResponse]:
    """Attach vote_score and user_vote to each comment."""
    if not comments:
        return []

    comment_ids = [c.id for c in comments]

    # Vote scores
    score_rows = await db.execute(
        select(Vote.comment_id, func.sum(Vote.value).label("score"))
        .where(Vote.comment_id.in_(comment_ids))
        .group_by(Vote.comment_id)
    )
    scores = {row.comment_id: int(row.score or 0) for row in score_rows}

    # Reply counts
    reply_rows = await db.execute(
        select(Comment.parent_id, func.count(Comment.id).label("cnt"))
        .where(Comment.parent_id.in_(comment_ids))
        .group_by(Comment.parent_id)
    )
    reply_counts = {row.parent_id: row.cnt for row in reply_rows}

    # Current user's votes
    user_votes: dict[int, int] = {}
    if current_user:
        vote_rows = await db.execute(
            select(Vote.comment_id, Vote.value)
            .where(Vote.user_id == current_user.id, Vote.comment_id.in_(comment_ids))
        )
        user_votes = {row.comment_id: row.value for row in vote_rows}

    result = []
    for c in comments:
        cr = CommentResponse.model_validate(c)
        cr.vote_score = scores.get(c.id, 0)
        cr.user_vote = user_votes.get(c.id)
        cr.reply_count = reply_counts.get(c.id, 0)
        result.append(cr)
    return result


@router.post("/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    edition_id: int,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify edition exists
    edition = await db.get(Edition, edition_id)
    if not edition:
        raise HTTPException(status_code=404, detail="Edition not found")

    # Verify parent comment belongs to same edition (if threaded reply)
    if payload.parent_id:
        parent = await db.get(Comment, payload.parent_id)
        if not parent or parent.edition_id != edition_id:
            raise HTTPException(status_code=400, detail="Invalid parent comment")

    comment = Comment(
        edition_id=edition_id,
        user_id=current_user.id,
        body=payload.body.strip(),
        page_number=payload.page_number,
        parent_id=payload.parent_id,
    )
    db.add(comment)
    await db.commit()

    # ── In-app notifications (push model) ────────────────────────────────────
    if payload.parent_id:
        # Notify the parent comment author that someone replied
        from sqlalchemy.orm import selectinload as _sil
        parent_result = await db.execute(
            select(Comment)
            .options(_sil(Comment.author))
            .where(Comment.id == payload.parent_id)
        )
        parent_comment = parent_result.scalar_one_or_none()
        if parent_comment:
            # Fetch book title for the message
            book_result = await db.execute(
                select(Book)
                .join(Edition, Edition.book_id == Book.id)
                .where(Edition.id == edition_id)
            )
            book = book_result.scalar_one_or_none()
            book_title = book.title if book else "a book"

            await push_notification(
                db,
                recipient_id=parent_comment.user_id,
                actor_id=current_user.id,
                notif_type="reply_to_my_comment",
                message=f"{current_user.username} replied to your comment in \"{book_title}\"",
                detail=comment.body[:100] + ("…" if len(comment.body) > 100 else ""),
                link=f"/read/{edition_id}",
                actor_username=current_user.username,
            )

            # Also fire legacy email notification (non-blocking)
            if parent_comment.author.id != current_user.id:
                send_reply_notification.delay(
                    commenter_email=parent_comment.author.email,
                    commenter_username=parent_comment.author.username,
                    reply_author=current_user.username,
                    comment_body=comment.body,
                    edition_id=edition_id,
                )
    else:
        # Top-level comment -- notify the book uploader
        book_result = await db.execute(
            select(Book)
            .join(Edition, Edition.book_id == Book.id)
            .where(Edition.id == edition_id)
        )
        book = book_result.scalar_one_or_none()
        if book:
            await push_notification(
                db,
                recipient_id=book.uploader_id,
                actor_id=current_user.id,
                notif_type="new_comment_on_my_book",
                message=f"{current_user.username} commented on \"{book.title}\"",
                detail=comment.body[:100] + ("…" if len(comment.body) > 100 else ""),
                link=f"/read/{edition_id}",
                actor_username=current_user.username,
            )

    # Reload with author
    result = await db.execute(
        select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment.id)
    )
    enriched = await _enrich([result.scalar_one()], current_user, db)
    return enriched[0]


@router.get("/", response_model=list[CommentResponse])
async def list_comments(
    edition_id: int,
    sort: str = "newest",      # "newest" | "top"
    parent_id: int | None = None,  # null = top-level, int = replies to that comment
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    q = (
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.edition_id == edition_id, Comment.parent_id == parent_id)
    )
    if sort == "top":
        # Sort by vote score subquery
        score_sub = (
            select(Vote.comment_id, func.sum(Vote.value).label("score"))
            .group_by(Vote.comment_id)
            .subquery()
        )
        q = q.outerjoin(score_sub, Comment.id == score_sub.c.comment_id).order_by(
            score_sub.c.score.desc().nullslast(), Comment.created_at.desc()
        )
    else:
        q = q.order_by(Comment.created_at.desc())

    result = await db.execute(q.offset(skip).limit(limit))
    comments = list(result.scalars())
    return await _enrich(comments, current_user, db)


@router.patch("/{comment_id}", response_model=CommentResponse)
async def edit_comment(
    edition_id: int,
    comment_id: int,
    payload: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit a comment body. Only the author can edit. Sets edited_at timestamp."""
    result = await db.execute(
        select(Comment).options(selectinload(Comment.author)).where(
            Comment.id == comment_id,
            Comment.edition_id == edition_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.is_deleted:
        raise HTTPException(status_code=410, detail="Cannot edit a deleted comment")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    from datetime import datetime, timezone
    comment.body = payload.body
    comment.edited_at = datetime.now(timezone.utc)
    await db.commit()

    result = await db.execute(
        select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment_id)
    )
    enriched = await _enrich([result.scalar_one()], current_user, db)
    return enriched[0]


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    edition_id: int,
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft-delete a comment. Only the author can delete.
    Sets is_deleted=True, clears body. Author info is also cleared.
    Replies are kept intact -- they render under a tombstone.
    """
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.edition_id == edition_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    # Soft delete: mark as deleted, clear sensitive content
    comment.is_deleted = True
    comment.body = ""
    await db.commit()


@router.post("/{comment_id}/vote", response_model=CommentResponse)
async def vote_comment(
    edition_id: int,
    comment_id: int,
    payload: VoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = await db.get(Comment, comment_id)
    if not comment or comment.edition_id != edition_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = await db.execute(
        select(Vote).where(Vote.user_id == current_user.id, Vote.comment_id == comment_id)
    )
    vote = existing.scalar_one_or_none()

    if vote:
        if vote.value == payload.value:
            # Toggle off -- remove vote
            await db.delete(vote)
        else:
            # Switch direction
            vote.value = payload.value
    else:
        vote = Vote(user_id=current_user.id, comment_id=comment_id, value=payload.value)
        db.add(vote)

    await db.commit()

    result = await db.execute(
        select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment_id)
    )
    enriched = await _enrich([result.scalar_one()], current_user, db)
    return enriched[0]
