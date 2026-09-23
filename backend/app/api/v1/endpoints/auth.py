import re
from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.core.rate_limit import rate_limit_register, rate_limit_login
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

# Simple in-memory login rate limiting
# Tracks failed attempts per identifier (email/username/IP)
# In production, replace with Redis-backed rate limiting
import time
from collections import defaultdict

_login_attempts: dict[str, list[float]] = defaultdict(list)
_MAX_ATTEMPTS = 5        # max failed attempts
_WINDOW_SECONDS = 300    # per 5-minute window
_LOCKOUT_SECONDS = 300   # 5-minute lockout after max attempts


def _check_rate_limit(identifier: str) -> None:
    now = time.time()
    attempts = _login_attempts[identifier]
    # Remove attempts older than the window
    _login_attempts[identifier] = [t for t in attempts if now - t < _WINDOW_SECONDS]
    if len(_login_attempts[identifier]) >= _MAX_ATTEMPTS:
        wait = int(_LOCKOUT_SECONDS - (now - _login_attempts[identifier][0]))
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Please try again in {wait // 60} minutes.",
        )


def _record_failed_attempt(identifier: str) -> None:
    _login_attempts[identifier].append(time.time())


def _clear_attempts(identifier: str) -> None:
    _login_attempts.pop(identifier, None)


# ── Email / password auth ──────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await rate_limit_register(request)
    # Check email and username separately to give specific error messages
    from sqlalchemy import func as sqlfunc
    email_taken = await db.execute(select(User).where(User.email == payload.email))
    if email_taken.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in instead.")
    username_taken = await db.execute(
        select(User).where(sqlfunc.lower(User.username) == payload.username.lower())
    )
    if username_taken.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This username is already taken. Please choose a different one.")

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Email or username already registered")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        is_new_user=True,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await rate_limit_login(request)
    # Allow login with email address or username
    from sqlalchemy import or_
    result = await db.execute(
        select(User).where(
            or_(User.email == payload.email, User.username == payload.email)
        )
    )
    user = result.scalar_one_or_none()

    identifier = payload.email.lower()
    _check_rate_limit(identifier)

    if not user:
        _record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="No account found with this email or username. Please register first.")
    if not user.hashed_password:
        raise HTTPException(status_code=401, detail="This account uses Google Sign-In. Please use the Google button to sign in.")
    if not verify_password(payload.password, user.hashed_password):
        _record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    _clear_attempts(identifier)  # Reset on successful login
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = int(data["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse.from_user(current_user)


# ── Google OAuth ───────────────────────────────────────────────────────────────

class GoogleLoginRequest(BaseModel):
    credential: str   # The ID token Google sends after the user approves


def _make_username_from_email(email: str) -> str:
    """Derive a clean username from the email local part."""
    base = re.sub(r"[^a-zA-Z0-9_-]", "", email.split("@")[0])[:28] or "user"
    return base


@router.post("/google", response_model=TokenResponse)
async def google_login(payload: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Verify a Google ID token and return our own JWT tokens.
    - If the email already exists → log in.
    - If not → create a new account automatically, then log in.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail="Google Sign-In is not configured on this server. Set GOOGLE_CLIENT_ID in .env.",
        )

    # Verify the token with Google's servers
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests

        idinfo = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Google Sign-In failed: {exc}")

    google_id: str = idinfo["sub"]
    email: str = idinfo["email"]
    name: str = idinfo.get("name", "")
    is_new = False  # Will be set True only if a brand-new account is created

    # Try to find by google_id first (fastest path for returning users)
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        # Try to find by email (user may have registered with email first)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is not None:
            # Existing email-registered account: link the Google ID to it
            user.google_id = google_id
            await db.commit()
            await db.refresh(user)
        else:
            # Brand new user: create account automatically
            base_username = _make_username_from_email(email)
            username = base_username

            # Make username unique by appending a number if taken
            suffix = 1
            while True:
                taken = await db.execute(select(User).where(User.username == username))
                if not taken.scalar_one_or_none():
                    break
                username = f"{base_username}{suffix}"
                suffix += 1

            user = User(
                email=email,
                username=username,
                hashed_password=None,   # No password for Google users
                google_id=google_id,
            )
            db.add(user)
            try:
                await db.commit()
                await db.refresh(user)
            except IntegrityError:
                await db.rollback()
                # Race condition: someone registered between our check and insert
                result = await db.execute(select(User).where(User.email == email))
                user = result.scalar_one_or_none()
                if not user:
                    raise HTTPException(status_code=500, detail="Account creation failed")
            else:
                is_new = True  # Only set True when the INSERT actually succeeded

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        is_new_user=is_new,
    )
