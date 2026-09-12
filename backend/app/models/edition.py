from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func, Integer, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Edition(Base):
    __tablename__ = "editions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    edition_number: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    publisher: Mapped[str | None] = mapped_column(String(255), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    pdf_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    pdf_r2_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pdf_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    uploader_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    book: Mapped["Book"] = relationship("Book", back_populates="editions")
    comments: Mapped[list["Comment"]] = relationship(
        "Comment", back_populates="edition", cascade="all, delete-orphan"
    )
    uploader: Mapped["User"] = relationship("User", foreign_keys=[uploader_id])
