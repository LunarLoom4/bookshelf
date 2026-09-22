from fastapi import APIRouter

from app.api.v1.endpoints.account import router as account_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.books import router as books_router
from app.api.v1.endpoints.bookmarks import router as bookmarks_router
from app.api.v1.endpoints.comments import router as comments_router
from app.api.v1.endpoints.editions import router as editions_router
from app.api.v1.endpoints.progress import router as progress_router
from app.api.v1.endpoints.reading_lists import router as reading_lists_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.notifications import router as notifications_router
from app.api.v1.endpoints.user_comments import router as user_comments_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(account_router)
api_router.include_router(books_router)
api_router.include_router(editions_router)
api_router.include_router(comments_router)
api_router.include_router(progress_router)
api_router.include_router(bookmarks_router)
api_router.include_router(reading_lists_router)
api_router.include_router(users_router)
api_router.include_router(notifications_router)
api_router.include_router(user_comments_router)
