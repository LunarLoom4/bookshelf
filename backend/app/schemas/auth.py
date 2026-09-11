from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
import re

# Reserved usernames that cannot be registered
RESERVED_USERNAMES = {
    "admin", "administrator", "root", "api", "bookshelf", "me", "null",
    "undefined", "anonymous", "system", "support", "help", "contact",
    "about", "terms", "privacy", "login", "register", "signup", "signin",
    "logout", "settings", "profile", "account", "user", "users", "browse",
    "upload", "search", "static", "assets", "favicon", "robots",
}


def validate_username(v: str) -> str:
    v = v.strip()
    if not 3 <= len(v) <= 30:
        raise ValueError("Username must be 3-30 characters")
    if not re.match(r"^[a-zA-Z0-9_-]+$", v):
        raise ValueError("Only letters, numbers, underscores and hyphens allowed")
    if v.lower() in RESERVED_USERNAMES:
        raise ValueError(f"'{v}' is a reserved name and cannot be used")
    if v.startswith("-") or v.startswith("_"):
        raise ValueError("Username cannot start with - or _")
    if v.endswith("-") or v.endswith("_"):
        raise ValueError("Username cannot end with - or _")
    if "--" in v or "__" in v:
        raise ValueError("Username cannot contain consecutive - or _")
    return v


def validate_password(v: str) -> str:
    """
    Strong password rules:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(v) > 128:
        raise ValueError("Password must be at most 128 characters")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain at least one number")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]", v):
        raise ValueError("Password must contain at least one special character (!@#$%^&* etc.)")
    return v


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        return validate_username(v)

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        return validate_password(v)


class LoginRequest(BaseModel):
    email: str   # accepts email address or username
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    created_at: datetime
    avatar_url: str | None = None
    has_password: bool = True

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user: object) -> "UserResponse":
        return cls(
            id=user.id,
            email=user.email,
            username=user.username,
            is_active=user.is_active,
            created_at=user.created_at,
            avatar_url=user.avatar_url,
            has_password=user.hashed_password is not None,
        )
