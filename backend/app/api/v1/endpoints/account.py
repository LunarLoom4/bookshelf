"""
Account management endpoints -- settings for the currently logged-in user.
All routes require authentication.

PATCH /account/username   -- change username
PATCH /account/password   -- change password (email accounts only)
POST  /account/avatar     -- upload avatar image
DELETE /account           -- permanently delete account
"""
import re
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, field_validator

from app.core.deps import get_current_user
from app.schemas.auth import validate_username, validate_password, RESERVED_USERNAMES
from app.core.security import hash_password, verify_password
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserResponse
from app.services import storage

router = APIRouter(prefix="/account", tags=["account"])

ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB


# ── Schemas ────────────────────────────────────────────────────────────────────

class UsernameUpdate(BaseModel):
    username: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        return validate_username(v)


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        return validate_password(v)


class SetPasswordRequest(BaseModel):
    """For Google users who want to add a password to their account."""
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        return validate_password(v)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.patch("/username", response_model=UserResponse)
async def update_username(
    payload: UsernameUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the current user's username. Must be unique."""
    if payload.username == current_user.username:
        return UserResponse.from_user(current_user)

    # Case-insensitive uniqueness check
    from sqlalchemy import func as sqlfunc
    existing = await db.execute(
        select(User).where(
            sqlfunc.lower(User.username) == payload.username.lower()
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken (usernames are case-insensitive)")

    current_user.username = payload.username
    try:
        await db.commit()
        await db.refresh(current_user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Username already taken")

    return UserResponse.from_user(current_user)


@router.patch("/password", response_model=UserResponse)
async def update_password(
    payload: PasswordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change password. Requires current password for verification."""
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=400,
            detail="Your account uses Google Sign-In and has no password. Use 'Set password' instead.",
        )
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")

    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.from_user(current_user)


@router.post("/password", response_model=UserResponse)
async def set_password(
    payload: SetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """For Google-only accounts: add a password so the user can also sign in via email."""
    if current_user.hashed_password:
        raise HTTPException(
            status_code=400,
            detail="Account already has a password. Use 'Change password' instead.",
        )
    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.from_user(current_user)


@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    avatar: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload or replace the user's avatar image."""
    if avatar.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=422, detail="Avatar must be JPEG, PNG, WebP, or GIF")

    data = await avatar.read()
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Avatar must be under 5 MB")

    # Delete old avatar from R2 if present
    if current_user.avatar_r2_key:
        storage.delete_object(current_user.avatar_r2_key)

    key, url = storage.upload_cover(data, avatar.filename or "avatar.jpg", avatar.content_type)
    current_user.avatar_url = url
    current_user.avatar_r2_key = key
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.from_user(current_user)


@router.delete("/avatar", response_model=UserResponse)
async def remove_avatar(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove the user's avatar, reverting to the default initial letter."""
    if current_user.avatar_r2_key:
        storage.delete_object(current_user.avatar_r2_key)
    current_user.avatar_url = None
    current_user.avatar_r2_key = None
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.from_user(current_user)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permanently delete the account and all associated data.
    Books, comments, votes, bookmarks, reading lists are cascade-deleted by the DB.
    """
    # Delete avatar from R2 if present
    if current_user.avatar_r2_key:
        storage.delete_object(current_user.avatar_r2_key)

    await db.delete(current_user)
    await db.commit()
