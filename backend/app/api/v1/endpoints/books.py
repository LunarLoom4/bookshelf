import asyncio
import time
from collections import defaultdict
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.core.config import settings
from app.core.rate_limit import rate_limit_upload_book, rate_limit_add_edition
from app.db.session import get_db
from app.models.book import Book
from app.models.comment import Comment
from app.models.edition import Edition
from app.models.user import User
from app.schemas.book import BookListItem, BookResponse, CommenterInfo
from app.services import storage
from app.services.storage import get_pdf_page_count
from app.services.notifications import push_notification

router = APIRouter(prefix="/books", tags=["books"])

# Upload rate limiting: max 10 uploads per hour per user
_upload_attempts: dict[int, list[float]] = defaultdict(list)
_MAX_UPLOADS_PER_HOUR = 15
_UPLOAD_WINDOW = 3600  # 1 hour in seconds

def _check_upload_rate_limit(user_id: int) -> None:
    now = time.time()
    attempts = _upload_attempts[user_id]
    # Remove attempts older than 1 hour
    _upload_attempts[user_id] = [t for t in attempts if now - t < _UPLOAD_WINDOW]
    if len(_upload_attempts[user_id]) >= _MAX_UPLOADS_PER_HOUR:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Upload limit reached. You can upload up to {_MAX_UPLOADS_PER_HOUR} books per hour. Please try again later.",
        )

def _record_upload(user_id: int) -> None:
    _upload_attempts[user_id].append(time.time())

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
    # Rate limit: 5 uploads per hour per user
    await rate_limit_upload_book(current_user.id)

    # 33: Input length validation on book metadata
    title = title.strip()
    author = author.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title is required")
    if len(title) > 500:
        raise HTTPException(status_code=422, detail="Title must be 500 characters or fewer")
    if not author:
        raise HTTPException(status_code=422, detail="Author is required")
    if len(author) > 255:
        raise HTTPException(status_code=422, detail="Author must be 255 characters or fewer")
    if description and len(description) > 2000:
        raise HTTPException(status_code=422, detail="Description must be 2,000 characters or fewer")
    if publisher and len(publisher) > 255:
        raise HTTPException(status_code=422, detail="Publisher must be 255 characters or fewer")
    if language and len(language) > 30:
        raise HTTPException(status_code=422, detail="Language must be 30 characters or fewer")

    # Validate PDF
    if pdf_file.content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")
    pdf_bytes = await pdf_file.read()
    if len(pdf_bytes) > settings.max_pdf_bytes:
        raise HTTPException(status_code=413, detail=f"PDF exceeds {settings.MAX_PDF_SIZE_MB}MB limit")

    # 30: Magic byte validation -- check actual file content, not just MIME type
    # A valid PDF always starts with %PDF (hex: 25 50 44 46)
    if not pdf_bytes[:4] == b"%PDF":
        raise HTTPException(status_code=422, detail="File does not appear to be a valid PDF")

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
            detail=f"DUPLICATE_EDITION:{existing_edition.book_id}:This exact PDF is already on Bookshelf as '{book_title}' (Edition {existing_edition.edition_number}).",
        )

    # Secondary check: same title + author with a different PDF.
    # This could be a different edition or a different scan of the same book.
    # We warn but do not block -- the uploader decides.
    # (This check is handled on the frontend via a separate /check endpoint below.)

    # Validate cover file bytes BEFORE starting any uploads
    # so we can fail fast without wasting R2 bandwidth
    cover_bytes_validated: bytes | None = None
    cover_content_type_validated: str | None = None
    if cover_file and cover_file.filename:
        if cover_file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=422, detail="Cover must be JPEG, PNG, or WebP")
        cover_bytes_validated = await cover_file.read()
        if len(cover_bytes_validated) > settings.max_cover_bytes:
            raise HTTPException(status_code=413, detail=f"Cover exceeds {settings.MAX_COVER_SIZE_MB}MB limit")
        cover_content_type_validated = cover_file.content_type

    # Run PDF upload in a thread so it doesn't block the async event loop.
    # boto3 is synchronous; asyncio.to_thread() runs it on a thread pool.
    loop = asyncio.get_running_loop()

    if cover_bytes_validated:
        # User provided a cover -- upload PDF and cover IN PARALLEL
        try:
            results = await asyncio.gather(
                loop.run_in_executor(
                    None,
                    lambda: storage.upload_pdf(pdf_bytes, pdf_file.filename or "upload.pdf")
                ),
                loop.run_in_executor(
                    None,
                    lambda: storage.upload_cover(
                        cover_bytes_validated,
                        cover_file.filename,
                        cover_content_type_validated,
                    )
                ),
            )
            (pdf_key, pdf_url) = results[0]
            (cover_key, cover_url) = results[1]
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Upload to storage failed") from exc
    else:
        # No cover provided -- generate from page 1 synchronously in a thread,
        # then upload both PDF and generated cover in parallel.
        try:
            # Step 1: generate cover bytes from PDF (CPU-bound, run in thread)
            thumb = await loop.run_in_executor(
                None,
                lambda: storage.extract_first_page_as_cover(pdf_bytes)
            )

            if thumb:
                # Step 2: upload PDF and generated cover IN PARALLEL
                results = await asyncio.gather(
                    loop.run_in_executor(
                        None,
                        lambda: storage.upload_pdf(pdf_bytes, pdf_file.filename or "upload.pdf")
                    ),
                    loop.run_in_executor(
                        None,
                        lambda: storage.upload_cover(thumb, "cover.jpg", "image/jpeg")
                    ),
                )
                (pdf_key, pdf_url) = results[0]
                (cover_key, cover_url) = results[1]
            else:
                # PyMuPDF failed to render -- upload PDF only
                pdf_key, pdf_url = await loop.run_in_executor(
                    None,
                    lambda: storage.upload_pdf(pdf_bytes, pdf_file.filename or "upload.pdf")
                )
                cover_key = None
                cover_url = None
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Upload to storage failed") from exc

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
        page_count=get_pdf_page_count(pdf_bytes),
        uploader_id=current_user.id,
    )
    db.add(edition)
    await db.commit()

    result = await db.execute(
        select(Book).options(selectinload(Book.editions)).where(Book.id == book.id)
    )
    created_book = result.scalar_one()

    # 29: Record this upload for rate limiting
    _record_upload(current_user.id)
    return created_book


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
    # Rate limit: 10 edition uploads per hour per user
    await rate_limit_add_edition(current_user.id)

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

    # 29: Rate limit additions per user (counts against same hourly quota)
    _check_upload_rate_limit(current_user.id)

    if pdf_file.content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")
    pdf_bytes = await pdf_file.read()
    if len(pdf_bytes) > settings.max_pdf_bytes:
        raise HTTPException(status_code=413, detail=f"PDF exceeds {settings.MAX_PDF_SIZE_MB}MB limit")

    # 30: Magic byte validation
    if not pdf_bytes[:4] == b"%PDF":
        raise HTTPException(status_code=422, detail="File does not appear to be a valid PDF")

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
            detail=f"DUPLICATE_EDITION:{dup.book_id}:This exact PDF is already on Bookshelf as '{book_title}' (Edition {dup.edition_number}).",
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
        page_count=get_pdf_page_count(pdf_bytes),
        uploader_id=current_user.id,
    )
    db.add(edition)
    await db.commit()

    # 29: Record this edition upload for rate limiting
    _record_upload(current_user.id)

    # Notify the book uploader that a new edition was added (only if uploader != adder)
    await push_notification(
        db,
        recipient_id=book.uploader_id,
        actor_id=current_user.id,
        notif_type="new_edition_on_my_book",
        message=f"{current_user.username} added Edition {edition_number} to \"{book.title}\"",
        detail=None,
        link=f"/books/{book.id}",
        actor_username=current_user.username,
    )

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
    Redirect the browser directly to the R2 public URL for the PDF.
    This is much faster than proxying -- the browser fetches straight from
    Cloudflare's CDN edge without going through our API server.
    R2 sets immutable cache headers so subsequent loads are instant.
    """
    from fastapi.responses import RedirectResponse
    from app.models.edition import Edition as EditionModel

    result = await db.execute(
        select(EditionModel).where(
            EditionModel.id == edition_id,
            EditionModel.book_id == book_id,
        )
    )
    edition = result.scalar_one_or_none()
    if not edition:
        raise HTTPException(status_code=404, detail="Edition not found")

    # 301 permanent redirect -- browser caches this so repeat visits are instant
    return RedirectResponse(url=edition.pdf_url, status_code=302)


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
    sort: str = "newest",
    db: AsyncSession = Depends(get_db),
):
    """Books list with sort: newest, oldest, most_discussed, most_editions, most_liked."""
    from app.models.edition_like import EditionLike

    if sort in ("newest", "oldest"):
        # Fast path: no joins needed, just order by created_at
        order = Book.created_at.desc() if sort == "newest" else Book.created_at.asc()
        result = await db.execute(
            select(Book).order_by(order).offset(skip).limit(limit)
        )
        raw_books = result.scalars().all()

        # Fetch edition + comment counts in two efficient queries
        book_ids = [b.id for b in raw_books]
        if not book_ids:
            return []

        edition_counts_result = await db.execute(
            select(Edition.book_id, func.count(Edition.id).label("cnt"))
            .where(Edition.book_id.in_(book_ids))
            .group_by(Edition.book_id)
        )
        edition_map = {r.book_id: r.cnt for r in edition_counts_result.all()}

        comment_counts_result = await db.execute(
            select(Edition.book_id, func.count(Comment.id).label("cnt"))
            .join(Comment, Comment.edition_id == Edition.id)
            .where(Edition.book_id.in_(book_ids), Comment.is_deleted.is_(False))
            .group_by(Edition.book_id)
        )
        comment_map = {r.book_id: r.cnt for r in comment_counts_result.all()}

        books = []
        for b in raw_books:
            item = BookListItem.model_validate(b)
            item.edition_count = edition_map.get(b.id, 0)
            item.comment_count = comment_map.get(b.id, 0)
            books.append(item)
        return books

    elif sort == "most_discussed":
        # Join books with comment counts, order by comment count
        result = await db.execute(
            select(Book, func.count(Comment.id.distinct()).label("comment_count"))
            .outerjoin(Edition, Edition.book_id == Book.id)
            .outerjoin(Comment, (Comment.edition_id == Edition.id) & (Comment.is_deleted.is_(False)))
            .group_by(Book.id)
            .order_by(func.count(Comment.id.distinct()).desc(), Book.created_at.desc())
            .offset(skip).limit(limit)
        )
        rows = result.all()
        book_ids = [r[0].id for r in rows]
        edition_counts_result = await db.execute(
            select(Edition.book_id, func.count(Edition.id).label("cnt"))
            .where(Edition.book_id.in_(book_ids))
            .group_by(Edition.book_id)
        )
        edition_map = {r.book_id: r.cnt for r in edition_counts_result.all()}
        books = []
        for book, comment_count in rows:
            item = BookListItem.model_validate(book)
            item.edition_count = edition_map.get(book.id, 0)
            item.comment_count = comment_count
            books.append(item)
        return books

    elif sort == "most_editions":
        result = await db.execute(
            select(Book, func.count(Edition.id.distinct()).label("edition_count"))
            .outerjoin(Edition, Edition.book_id == Book.id)
            .group_by(Book.id)
            .order_by(func.count(Edition.id.distinct()).desc(), Book.created_at.desc())
            .offset(skip).limit(limit)
        )
        rows = result.all()
        book_ids = [r[0].id for r in rows]
        comment_counts_result = await db.execute(
            select(Edition.book_id, func.count(Comment.id).label("cnt"))
            .join(Comment, Comment.edition_id == Edition.id)
            .where(Edition.book_id.in_(book_ids), Comment.is_deleted.is_(False))
            .group_by(Edition.book_id)
        )
        comment_map = {r.book_id: r.cnt for r in comment_counts_result.all()}
        books = []
        for book, edition_count in rows:
            item = BookListItem.model_validate(book)
            item.edition_count = edition_count
            item.comment_count = comment_map.get(book.id, 0)
            books.append(item)
        return books

    else:  # most_liked
        result = await db.execute(
            select(Book, func.count(EditionLike.id.distinct()).label("like_count"))
            .outerjoin(Edition, Edition.book_id == Book.id)
            .outerjoin(EditionLike, EditionLike.edition_id == Edition.id)
            .group_by(Book.id)
            .order_by(func.count(EditionLike.id.distinct()).desc(), Book.created_at.desc())
            .offset(skip).limit(limit)
        )
        rows = result.all()
        book_ids = [r[0].id for r in rows]
        edition_counts_result = await db.execute(
            select(Edition.book_id, func.count(Edition.id).label("cnt"))
            .where(Edition.book_id.in_(book_ids))
            .group_by(Edition.book_id)
        )
        edition_map = {r.book_id: r.cnt for r in edition_counts_result.all()}
        comment_counts_result = await db.execute(
            select(Edition.book_id, func.count(Comment.id).label("cnt"))
            .join(Comment, Comment.edition_id == Edition.id)
            .where(Edition.book_id.in_(book_ids), Comment.is_deleted.is_(False))
            .group_by(Edition.book_id)
        )
        comment_map = {r.book_id: r.cnt for r in comment_counts_result.all()}
        books = []
        for book, _ in rows:
            item = BookListItem.model_validate(book)
            item.edition_count = edition_map.get(book.id, 0)
            item.comment_count = comment_map.get(book.id, 0)
            books.append(item)
        return books


@router.get("/popular", response_model=list[BookListItem])
async def popular_books(
    days: int = 7,
    limit: int = 6,
    db: AsyncSession = Depends(get_db),
):
    """Books with the most comments in the last N days."""
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import and_
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            Book,
            func.count(Edition.id.distinct()).label("edition_count"),
            func.count(Comment.id.distinct()).label("comment_count"),
        )
        .outerjoin(Edition, Edition.book_id == Book.id)
        .outerjoin(
            Comment,
            and_(
                Comment.edition_id == Edition.id,
                Comment.is_deleted.is_(False),
                Comment.created_at >= cutoff,
            )
        )
        .group_by(Book.id)
        .having(func.count(Comment.id.distinct()) > 0)
        .order_by(func.count(Comment.id.distinct()).desc())
        .limit(limit)
    )
    books = []
    for row in result.all():
        book, edition_count, comment_count = row
        item = BookListItem.model_validate(book)
        item.edition_count = edition_count
        item.comment_count = comment_count
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

    # Fetch full book rows with edition and comment counts, preserving similarity order
    rows = await db.execute(
        select(
            Book,
            func.count(Edition.id.distinct()).label("edition_count"),
            func.count(Comment.id.distinct()).label("comment_count"),
        )
        .outerjoin(Edition, Edition.book_id == Book.id)
        .outerjoin(Comment, (Comment.edition_id == Edition.id) & (Comment.is_deleted.is_(False)))
        .where(Book.id.in_(book_ids))
        .group_by(Book.id)
    )
    # Re-order by the similarity rank
    id_order = {bid: i for i, bid in enumerate(book_ids)}
    books = []
    for row in rows.all():
        book, edition_count, comment_count = row
        item = BookListItem.model_validate(book)
        item.edition_count = edition_count
        item.comment_count = comment_count
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

    # 19: Fetch up to 8 distinct recent commenters for avatar row
    edition_ids = [e.id for e in book.editions]
    if edition_ids:
        commenters_result = await db.execute(
            select(User.username, User.avatar_url)
            .join(Comment, Comment.user_id == User.id)
            .where(
                Comment.edition_id.in_(edition_ids),
                Comment.is_deleted.is_(False),
            )
            .distinct(User.id)
            .order_by(User.id, Comment.created_at.desc())
            .limit(8)
        )
        response.recent_commenters = [
            CommenterInfo(username=row.username, avatar_url=row.avatar_url)
            for row in commenters_result.all()
        ]
    return response
