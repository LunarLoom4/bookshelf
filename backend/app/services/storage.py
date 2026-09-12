import uuid
from io import BytesIO
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings


def _get_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(
            signature_version="s3v4",
            # Increase connection pool for faster parallel uploads
            max_pool_connections=20,
        ),
        region_name="auto",
    )


def _make_key(prefix: str, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return f"{prefix}/{uuid.uuid4().hex}{ext}"


def upload_pdf(file_bytes: bytes, original_filename: str) -> tuple[str, str]:
    """Upload a PDF to R2. Returns (r2_key, public_url)."""
    key = _make_key("pdfs", original_filename)
    client = _get_client()
    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType="application/pdf",
        # Allow browser to cache the PDF -- it won't change once uploaded
        CacheControl="public, max-age=31536000, immutable",
    )
    public_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"
    return key, public_url


def upload_cover(file_bytes: bytes, original_filename: str, content_type: str) -> tuple[str, str]:
    """Upload a cover image to R2. Returns (r2_key, public_url)."""
    key = _make_key("covers", original_filename)
    client = _get_client()
    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",
    )
    public_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"
    return key, public_url


def delete_object(r2_key: str) -> None:
    """Delete a file from R2 by its key. Best-effort -- never raises."""
    try:
        client = _get_client()
        client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=r2_key)
    except ClientError:
        pass


def generate_presigned_url(r2_key: str, expires_in: int = 3600) -> str:
    """Generate a pre-signed download URL."""
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": r2_key},
        ExpiresIn=expires_in,
    )


def extract_first_page_as_cover(pdf_bytes: bytes) -> bytes | None:
    """
    Extract the first page of a PDF and return it as a JPEG image.
    Used to auto-generate a cover when the user doesn't provide one.
    Returns None if extraction fails.
    """
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if doc.page_count == 0:
            return None
        page = doc[0]
        # Render at 1.5x resolution -- good quality, ~40% faster than 2x
        # (pixel count is 1.5^2 = 2.25x instead of 4x vs 1x)
        mat = fitz.Matrix(1.5, 1.5)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        # JPEG quality 85 -- visually identical to 95 at 30% smaller size
        return pix.tobytes("jpeg", jpg_quality=85)
    except Exception:
        return None
