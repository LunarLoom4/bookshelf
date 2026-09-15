from datetime import datetime
from pydantic import BaseModel, field_validator


class CommentAuthor(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    body: str
    page_number: int | None = None
    parent_id: int | None = None

    @field_validator("body")
    @classmethod
    def body_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Comment body cannot be empty")
        if len(v) > 10000:
            raise ValueError("Comment must be 10,000 characters or fewer")
        return v.strip()


class CommentUpdate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def body_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Comment body cannot be empty")
        if len(v) > 10000:
            raise ValueError("Comment must be 10,000 characters or fewer")
        return v.strip()


class CommentWithContext(BaseModel):
    """CommentResponse extended with book and edition context for profile page."""
    id: int
    body: str
    page_number: int | None
    edition_id: int
    user_id: int
    parent_id: int | None
    vote_score: int
    user_vote: int | None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    edited_at: datetime | None
    book_title: str
    book_id: int
    edition_number: int
    reply_count: int = 0

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: int
    edition_id: int
    body: str
    page_number: int | None
    parent_id: int | None
    author: CommentAuthor
    vote_score: int = 0
    user_vote: int | None = None
    reply_count: int = 0
    is_deleted: bool = False
    edited_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VoteRequest(BaseModel):
    value: int  # +1 or -1

    @field_validator("value")
    @classmethod
    def value_must_be_vote(cls, v: int) -> int:
        if v not in (1, -1):
            raise ValueError("value must be +1 or -1")
        return v
