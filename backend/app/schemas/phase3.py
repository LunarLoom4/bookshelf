from datetime import datetime
from pydantic import BaseModel, field_validator


# ── Reading Progress ───────────────────────────────────────────────────────────
class ProgressResponse(BaseModel):
    edition_id: int
    last_page: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProgressUpsert(BaseModel):
    last_page: int

    @field_validator("last_page")
    @classmethod
    def page_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("last_page must be >= 1")
        return v


# ── Bookmarks ──────────────────────────────────────────────────────────────────
class BookmarkCreate(BaseModel):
    page_number: int
    note: str | None = None

    @field_validator("page_number")
    @classmethod
    def page_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("page_number must be >= 1")
        return v


class BookmarkUpdate(BaseModel):
    note: str | None = None


class BookmarkResponse(BaseModel):
    id: int
    edition_id: int
    page_number: int
    note: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Reading Lists ──────────────────────────────────────────────────────────────
class ReadingListCreate(BaseModel):
    name: str
    is_public: bool = True

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        if len(v) > 100:
            raise ValueError("name must be 100 characters or fewer")
        return v


class ReadingListUpdate(BaseModel):
    name: str | None = None
    is_public: bool | None = None


class BookSummary(BaseModel):
    """Minimal book data embedded in reading list items."""
    id: int
    title: str
    author: str
    description: str | None
    cover_url: str | None
    created_at: datetime
    edition_count: int = 0

    model_config = {"from_attributes": True}


class ReadingListItemResponse(BaseModel):
    id: int
    book_id: int
    added_at: datetime
    book: BookSummary | None = None

    model_config = {"from_attributes": True}


class ReadingListResponse(BaseModel):
    id: int
    user_id: int
    name: str
    is_public: bool
    created_at: datetime
    updated_at: datetime
    item_count: int = 0
    cover_urls: list[str] = []  # 24: up to 4 book covers for collage display

    model_config = {"from_attributes": True}


class ReadingListDetailResponse(BaseModel):
    id: int
    user_id: int
    name: str
    is_public: bool
    created_at: datetime
    updated_at: datetime
    items: list[ReadingListItemResponse] = []

    model_config = {"from_attributes": True}
