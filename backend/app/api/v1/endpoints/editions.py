from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.edition import Edition
from app.models.book import Book
from app.schemas.book import EditionResponse, BookResponse
from pydantic import BaseModel


class EditionWithBook(BaseModel):
    edition: EditionResponse
    book: BookResponse

    model_config = {"from_attributes": True}


router = APIRouter(prefix="/editions", tags=["editions"])


@router.get("/{edition_id}", response_model=EditionWithBook)
async def get_edition(edition_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Edition).where(Edition.id == edition_id)
    )
    edition = result.scalar_one_or_none()
    if not edition:
        raise HTTPException(status_code=404, detail="Edition not found")

    book_result = await db.execute(
        select(Book)
        .options(selectinload(Book.editions))
        .where(Book.id == edition.book_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return EditionWithBook(
        edition=EditionResponse.model_validate(edition),
        book=BookResponse.model_validate(book),
    )
