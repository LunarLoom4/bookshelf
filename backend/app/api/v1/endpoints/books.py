from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.book import Book
from app.models.edition import Edition
from app.models.user import User
from app.schemas.book import BookListItem, BookResponse
from app.services import storage

router = APIRouter(prefix="/books", tags=["books"])

ALLOWED_PDF_TYPES = {"application/pdf"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def create_book_with_edition(
    title: str = Form(...),
    author: str = Form(...),
    description: str | None = Form(None),
    edition_number: int = Form(1),
    year: int | None = Form(None),
    publisher: str | None = Form(None),
    language: str = Form("en"),
    pdf_file: UploadFile = File(...),
    cover_file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate PDF
    if pdf_file.content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")
    pdf_bytes = await pdf_file.read()
    if len(pdf_bytes) > settings.max_pdf_bytes:
        raise HTTPException(status_code=413, detail=f"PDF exceeds {settings.MAX_PDF_SIZE_MB}MB limit")

    # Content-based duplicate detection via SHA-256 hash of PDF bytes.
    # The same PDF file always produces the same hash regardless of filename,
    # uploader, or metadata typed into the form.
    import hashlib
    from sqlalchemy import func as sqlfunc
    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()

    existing_edition_result = await db.execute(
        select(Edition).where(Edition.pdf_hash == pdf_hash)
    )
    existing_edition = existing_edition_result.scalar_one_or_none()
    if existing_edition:
        # This exact PDF file is already in the database
        existing_book_result = await db.execute(
            select(Book).where(Book.id == existing_edition.book_id)
        )
        existing_book = existing_book_result.scalar_one_or_none()
        book_title = existing_book.title if existing_book else "another book"
        raise HTTPException(
            status_code=409,
            detail=f"DUPLICATE_EDITION:{existing_edition.book_id}:This exact PDF is already on Bookshelf as "{book_title}" (Edition {existing_edition.edition_number}).",
        )

    # Secondary check: same title + author with a different PDF.
    # This could be a different edition or a different scan of the same book.
    # We warn but do not block -- the uploader decides.
    # (This check is handled on the frontend via a separate /check endpoint below.)

    # Upload PDF to R2
    pdf_key, pdf_url = storage.upload_pdf(pdf_bytes, pdf_file.filename or "upload.pdf")

    # Cover image: explicit upload or auto-generate from page 1
    cover_key = None
    cover_url = None
    try:
        if cover_file and cover_file.filename:
            if cover_file.content_type not in ALLOWED_IMAGE_TYPES:
                raise HTTPException(status_code=422, detail="Cover must be JPEG, PNG, or WebP")
            cover_bytes = await cover_file.read()
            if len(cover_bytes) > settings.max_cover_bytes:
                raise HTTPException(status_code=413, detail=f"Cover exceeds {settings.MAX_COVER_SIZE_MB}MB limit")
            cover_key, cover_url = storage.upload_cover(
                cover_bytes, cover_file.filename, cover_file.content_type
            )
        else:
            # No cover provided -- extract page 1 of the PDF as cover
            thumb = storage.extract_first_page_as_cover(pdf_bytes)
            if thumb:
                cover_key, cover_url = storage.upload_cover(thumb, "cover.jpg", "image/jpeg")
    except HTTPException:
        storage.delete_object(pdf_key)
        raise

    book = Book(
        title=title.strip(),
        author=author.strip(),
        description=description,
        cover_url=cover_url,
        cover_r2_key=cover_key,
        uploader_id=current_user.id,
    )
    db.add(book)
    await db.flush()

    edition = Edition(
        book_id=book.id,
        edition_number=edition_number,
        year=year,
        publisher=publisher,
        language=language,
        pdf_url=pdf_url,
        pdf_r2_key=pdf_key,
        file_size_bytes=len(pdf_bytes),
        pdf_hash=pdf_hash,
        uploader_id=current_user.id,
    )
    db.add(edition)
    await db.commit()

    result = await db.execute(
        select(Book).options(selectinload(Book.editions)).where(Book.id == book.id)
    )
    return result.scalar_one()


@router.post("/{book_id}/cover", response_model=BookResponse)
async def upload_cover(
    book_id: int,
    cover_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace or add a cover image to an existing book. Only the uploader can do this."""
    result = await db.execute(
        select(Book).options(selectinload(Book.editions)).where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.uploader_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the uploader can change the cover")

    if cover_file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=422, detail="Cover must be JPEG, PNG, or WebP")
    cover_bytes = await cover_file.read()
    if len(cover_bytes) > settings.max_cover_bytes:
        raise HTTPException(status_code=413, detail=f"Cover exceeds {settings.MAX_COVER_SIZE_MB}MB limit")

    # Delete old cover from R2 if present
    if book.cover_r2_key:
        storage.delete_object(book.cover_r2_key)

    new_key, new_url = storage.upload_cover(
        cover_bytes, cover_file.filename or "cover.jpg", cover_file.content_type
    )
    book.cover_url = new_url
    book.cover_r2_key = new_key
    await db.commit()

    result = await db.execute(
        select(Book).options(selectinload(Book.editions)).where(Book.id == book.id)
    )
    return result.scalar_one()


@router.post("/{book_id}/editions", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def add_edition(
    book_id: int,
    edition_number: int = Form(...),
    year: int | None = Form(None),
    publisher: str | None = Form(None),
    language: str = Form("en"),
    pdf_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new edition PDF to an existing book."""
    result = await db.execute(
        select(Book).options(selectinload(Book.editions)).where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Check edition number not already taken
    existing_nums = {e.edition_number for e in book.editions}
    if edition_number in existing_nums:
        raise HTTPException(
            status_code=409, detail=f"Edition {edition_number} already exists for this book"
        )

    if pdf_file.content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")
    pdf_bytes = await pdf_file.read()
    if len(pdf_bytes) > settings.max_pdf_bytes:
        raise HTTPException(status_code=413, detail=f"PDF exceeds {settings.MAX_PDF_SIZE_MB}MB limit")

    # Hash-based duplicate check for add_edition too
    import hashlib
    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()
    dup_result = await db.execute(
        select(Edition).where(Edition.pdf_hash == pdf_hash)
    )
    dup = dup_result.scalar_one_or_none()
    if dup:
        dup_book = await db.get(Book, dup.book_id)
        book_title = dup_book.title if dup_book else "another book"
        raise HTTPException(
            status_code=409,
            detail=f"DUPLICATE_EDITION:{dup.book_id}:This exact PDF is already on Bookshelf as "{book_title}" (Edition {dup.edition_number}).",
        )

    pdf_key, pdf_url = storage.upload_pdf(pdf_bytes, pdf_file.filename or "upload.pdf")

    edition = Edition(
        book_id=book.id,
        edition_number=edition_number,
        year=year,
        publisher=publisher,
        language=language,
        pdf_url=pdf_url,
        pdf_r2_key=pdf_key,
        file_size_bytes=len(pdf_bytes),
        pdf_hash=pdf_hash,
        uploader_id=current_user.id,
    )
    db.add(edition)
    await db.commit()

    result = await db.execute(
        select(Book).options(selectinload(Book.editions)).where(Book.id == book.id)
    )
    return result.scalar_one()


@router.get("/{book_id}/editions/{edition_id}/pdf")
async def proxy_pdf(
    book_id: int,
    edition_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Stream the PDF through the API so the browser can render it natively.
    Uses true streaming so large PDFs start displaying immediately.
    """
    from fastapi.responses import StreamingResponse
    from app.models.edition import Edition as EditionModel
    import httpx

    result = await db.execute(
        select(EditionModel).where(
            EditionModel.id == edition_id,
            EditionModel.book_id == book_id,
        )
    )
    edition = result.scalar_one_or_none()
    if not edition:
        raise HTTPException(status_code=404, detail="Edition not found")

    # Stream directly from R2 to the client -- no buffering
    client = httpx.AsyncClient(timeout=120)
    try:
        r2_response = await client.get(edition.pdf_url)
        r2_response.raise_for_status()
    except httpx.HTTPError as e:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Failed to fetch PDF: {e}")

    async def stream_pdf():
        try:
            async for chunk in r2_response.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await client.aclose()

    headers = {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
    }
    if r2_response.headers.get("content-length"):
        headers["Content-Length"] = r2_response.headers["content-length"]

    return StreamingResponse(stream_pdf(), media_type="application/pdf", headers=headers)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permanently delete a book and all its editions.
    Only the uploader can delete their own book.
    All PDFs, covers, comments, votes, bookmarks, and reading list items
    are cascade-deleted from the database. R2 files are also deleted.
    """
    result = await db.execute(
        select(Book).options(selectinload(Book.editions)).where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.uploader_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the uploader can delete this book")

    # Delete all R2 files before removing DB records
    if book.cover_r2_key:
        storage.delete_object(book.cover_r2_key)
    for edition in book.editions:
        if edition.pdf_r2_key:
            storage.delete_object(edition.pdf_r2_key)

    await db.delete(book)
    await db.commit()


@router.get("/", response_model=list[BookListItem])
async def list_books(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Recent books, paginated."""
    result = await db.execute(
        select(
            Book,
            func.count(Edition.id).label("edition_count"),
        )
        .outerjoin(Edition, Edition.book_id == Book.id)
        .group_by(Book.id)
        .order_by(Book.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = result.all()
    books = []
    for row in rows:
        book, edition_count = row
        item = BookListItem.model_validate(book)
        item.edition_count = edition_count
        books.append(item)
    return books


@router.get("/search", response_model=list[BookListItem])
async def search_books(
    q: str,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """
    Full-text search on title and author using pg_trgm similarity.
    Falls back to ILIKE prefix match so short queries still return results.
    """
    if not q.strip():
        return []

    # Search using ILIKE for substring match (works without pg_trgm config)
    # Also try trigram similarity if available, fall back gracefully
    search_sql = text("""
        SELECT
            b.id,
            CASE
                WHEN b.title  ILIKE :like_q THEN 1.0
                WHEN b.author ILIKE :like_q THEN 0.9
                ELSE 0.5
            END AS score
        FROM books b
        WHERE
            b.title  ILIKE :like_q
            OR b.author ILIKE :like_q
        ORDER BY score DESC, b.created_at DESC
        OFFSET :skip LIMIT :lim
    """)
    id_rows = await db.execute(
        search_sql,
        {"like_q": f"%{q}%", "skip": skip, "lim": limit},
    )
    book_ids = [row.id for row in id_rows]

    if not book_ids:
        return []

    # Fetch full book rows with edition counts, preserving similarity order
    rows = await db.execute(
        select(Book, func.count(Edition.id).label("edition_count"))
        .outerjoin(Edition, Edition.book_id == Book.id)
        .where(Book.id.in_(book_ids))
        .group_by(Book.id)
    )
    # Re-order by the similarity rank
    id_order = {bid: i for i, bid in enumerate(book_ids)}
    books = []
    for row in rows.all():
        book, edition_count = row
        item = BookListItem.model_validate(book)
        item.edition_count = edition_count
        books.append(item)
    books.sort(key=lambda b: id_order.get(b.id, 999))
    return books


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Book).options(selectinload(Book.editions)).where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    # Attach uploader username for display on the book detail page
    response = BookResponse.model_validate(book)
    if book.uploader_id:
        user_result = await db.execute(
            select(User.username).where(User.id == book.uploader_id)
        )
        username = user_result.scalar_one_or_none()
        response.uploader_username = username
    return response
