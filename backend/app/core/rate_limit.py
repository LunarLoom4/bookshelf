"""
In-memory async rate limiter.

Uses a sliding window: each (key) maps to a deque of UTC timestamps.
On each check, timestamps older than `window_seconds` are evicted.
If the remaining count >= `max_requests`, the request is rejected.

Limits chosen to block abuse while not inconveniencing real users:

  Action                    limit   window
  ─────────────────────────────────────────
  register (per IP)           5    1 hour   -- prevent account farms
  login (per IP)             20    1 hour   -- brute-force protection
  upload_book (per user)      5    1 hour   -- no spam uploads
  add_edition (per user)     10    1 hour   -- edition flooding
  post_comment (per user)    30    1 hour   -- comment spam
  vote_comment (per user)    60    1 hour   -- vote manipulation
  like_edition (per user)    60    1 hour   -- like spam

Thread safety: asyncio.Lock per-bucket guarantees no race conditions
under asyncio concurrency. Does NOT work across multiple processes --
for multi-process deploys, swap the store for Redis.
"""
import asyncio
import time
from collections import defaultdict, deque
from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self) -> None:
        # bucket_key -> deque of timestamps
        self._store: dict[str, deque] = defaultdict(deque)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def check(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        detail: str = "Too many requests. Please slow down.",
    ) -> None:
        """
        Raise HTTP 429 if `key` has exceeded `max_requests` in the last
        `window_seconds`. Otherwise record this request and return.
        """
        async with self._locks[key]:
            now = time.monotonic()
            cutoff = now - window_seconds
            bucket = self._store[key]

            # Evict expired timestamps
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=detail,
                )

            bucket.append(now)


# Singleton shared across the app
_limiter = RateLimiter()


# ── Convenience dependency factories ─────────────────────────────────────────
# Each returns a FastAPI dependency (callable) that enforces the stated limit.

def limit_by_ip(max_requests: int, window_seconds: int, action: str):
    """Rate-limit by client IP address. Used for auth endpoints."""
    async def dep(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        key = f"{action}:ip:{ip}"
        await _limiter.check(
            key, max_requests, window_seconds,
            detail=f"Too many {action} attempts. Try again later.",
        )
    return dep


def limit_by_user(max_requests: int, window_seconds: int, action: str):
    """
    Rate-limit by authenticated user ID.
    Must be used AFTER get_current_user in the dependency chain.
    Caller passes the user object directly (see usage in endpoints).
    """
    async def dep(user_id: int) -> None:
        key = f"{action}:user:{user_id}"
        await _limiter.check(
            key, max_requests, window_seconds,
            detail=f"Too many {action} requests. Please slow down.",
        )
    return dep


# ── Pre-configured limiters ───────────────────────────────────────────────────

async def rate_limit_register(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    await _limiter.check(f"register:ip:{ip}", 5, 3600, "Too many registrations from this IP.")

async def rate_limit_login(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    await _limiter.check(f"login:ip:{ip}", 20, 3600, "Too many login attempts. Try again later.")

async def rate_limit_upload_book(user_id: int) -> None:
    await _limiter.check(f"upload_book:user:{user_id}", 5, 3600, "Upload limit reached (5 per hour).")

async def rate_limit_add_edition(user_id: int) -> None:
    await _limiter.check(f"add_edition:user:{user_id}", 10, 3600, "Edition limit reached (10 per hour).")

async def rate_limit_post_comment(user_id: int) -> None:
    await _limiter.check(f"post_comment:user:{user_id}", 30, 3600, "Comment limit reached (30 per hour).")

async def rate_limit_vote(user_id: int) -> None:
    await _limiter.check(f"vote:user:{user_id}", 60, 3600, "Vote limit reached (60 per hour).")

async def rate_limit_like(user_id: int) -> None:
    await _limiter.check(f"like:user:{user_id}", 60, 3600, "Like limit reached (60 per hour).")
