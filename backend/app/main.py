from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing needed -- Alembic handles migrations
    yield
    # Shutdown


app = FastAPI(
    title="Bookshelf API",
    version="1.0.0",
    description="Public book PDF sharing and discussion platform",
    lifespan=lifespan,
)

# Compress responses >1KB with gzip -- reduces JSON transfer size by ~60-80%
# minimum_size=1000 avoids compressing tiny responses where overhead > benefit
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
