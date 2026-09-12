from datetime import datetime
from pydantic import BaseModel


class EditionResponse(BaseModel):
    id: int
    book_id: int
    edition_number: int
    year: int | None
    publisher: str | None
    language: str
    pdf_url: str
    file_size_bytes: int | None
    page_count: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BookResponse(BaseModel):
    id: int
    title: str
    author: str
    description: str | None
    cover_url: str | None
    uploader_id: int | None
    uploader_username: str | None = None
    created_at: datetime
    editions: list[EditionResponse] = []

    model_config = {"from_attributes": True}


class BookListItem(BaseModel):
    id: int
    title: str
    author: str
    description: str | None
    cover_url: str | None
    uploader_id: int | None
    created_at: datetime
    edition_count: int = 0
    comment_count: int = 0  # 16: total comments across all editions

    model_config = {"from_attributes": True}
