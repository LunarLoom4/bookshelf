# Bookshelf — Technical Documentation

Full technical reference for the Bookshelf application. This document covers the architecture, every API endpoint, the database schema, authentication flows, all major subsystems, and the design system. Read README.md first for setup instructions.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Docker Services](#docker-services)
3. [Backend Structure](#backend-structure)
4. [Frontend Structure](#frontend-structure)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Authentication](#authentication)
8. [File Upload and Storage](#file-upload-and-storage)
9. [PDF Viewer](#pdf-viewer)
10. [Comment System](#comment-system)
11. [Reading Progress](#reading-progress)
12. [Bookmarks](#bookmarks)
13. [Reading Lists](#reading-lists)
14. [User Accounts and Settings](#user-accounts-and-settings)
15. [Theme System](#theme-system)
16. [Search](#search)
17. [Email Notifications](#email-notifications)
18. [Design System](#design-system)
19. [Environment Variables](#environment-variables)

---

## Architecture Overview

Bookshelf is a full-stack web application built as seven Docker containers orchestrated by Docker Compose. The backend is a Python FastAPI application using async SQLAlchemy and PostgreSQL. The frontend is a React 18 single-page application built with Vite. Files are stored on Cloudflare R2 (S3-compatible object storage). Background tasks run through Celery with Redis as the broker.

```
Browser
  │
  ├──► Nginx (port 80) ──► React frontend (port 5173) ──► FastAPI (port 8000)
  └──► React frontend (port 5173, direct)                      │
                                                               ├──► PostgreSQL (port 5432)
                                                               ├──► Redis (port 6379)
                                                               └──► Cloudflare R2 (external)
                                                    Celery Worker ──► Redis ──► Resend (external)
```

All API requests from the frontend go through the Vite dev server proxy (`/api → http://api:8000`) in development. In production behind Nginx, the proxy routes `/api` to the FastAPI container.

---

## Docker Services

| Service | Image | Ports | Role |
|---------|-------|-------|------|
| `db` | postgres:15-alpine | 5432 | Primary relational database |
| `redis` | redis:7-alpine | 6379 | Celery message broker and result backend |
| `api` | `./backend` | 8000 | FastAPI application (uvicorn with --reload) |
| `worker` | `./backend` | — | Celery task worker (email, background jobs) |
| `beat` | `./backend` | — | Celery periodic task scheduler |
| `frontend` | `./frontend` | 5173 | Vite development server |
| `nginx` | nginx:alpine | 80 | Reverse proxy |

All services share a Docker network named `bookshelf_default`. Service names are used as hostnames within the network (e.g. `api` resolves to the FastAPI container from within other containers).

---

## Backend Structure

```
backend/
├── Dockerfile
├── requirements.txt
├── alembic.ini
├── scripts/
│   └── seed.py                   Sample data loader
├── alembic/
│   ├── env.py                    Alembic runner (async-compatible)
│   └── versions/
│       ├── 001_initial.py        Core tables: users, books, editions, comments, votes
│       ├── 002_phase2_search_tuning.py   pg_trgm extension and GIN indexes
│       ├── 003_phase3_tables.py  reading_progress, bookmarks, reading_lists, reading_list_items
│       ├── 004_google_oauth.py   google_id column on users
│       ├── 005_user_settings.py  avatar_url, avatar_r2_key columns on users
│       └── 006_comment_edit_delete.py   is_deleted, edited_at columns on comments
└── app/
    ├── main.py                   FastAPI app, CORS middleware, router registration
    ├── tasks.py                  Celery task: send_reply_notification
    ├── models/
    │   ├── user.py               users table
    │   ├── book.py               books table
    │   ├── edition.py            editions table
    │   ├── comment.py            comments table (self-referential for threading)
    │   ├── vote.py               votes table
    │   ├── reading_progress.py   reading_progress table
    │   ├── bookmark.py           bookmarks table
    │   └── reading_list.py       reading_lists and reading_list_items tables
    ├── schemas/
    │   ├── auth.py               RegisterRequest, LoginRequest, TokenResponse, UserResponse,
    │   │                         validate_username(), validate_password(), RESERVED_USERNAMES
    │   ├── comment.py            CommentCreate, CommentUpdate, CommentResponse, VoteRequest
    │   └── phase3.py             ReadingProgress, Bookmark, ReadingList schemas
    ├── api/v1/
    │   ├── router.py             Registers all endpoint routers under /api/v1
    │   └── endpoints/
    │       ├── auth.py           /auth — register, login, refresh, google, me
    │       ├── books.py          /books — CRUD, search, PDF proxy, cover upload, delete
    │       ├── editions.py       /editions/{id} — edition detail with parent book
    │       ├── comments.py       /editions/{id}/comments — create, list, edit, delete, vote
    │       ├── users.py          /users/{username} — public profile
    │       ├── progress.py       /editions/{id}/progress — get and upsert reading progress
    │       ├── bookmarks.py      /editions/{id}/bookmarks — list, create, delete
    │       ├── reading_lists.py  /lists — create, list, get, add/remove books
    │       └── account.py        /account — avatar, username, password, delete
    ├── core/
    │   ├── config.py             Pydantic Settings, reads all environment variables
    │   ├── security.py           bcrypt password hashing, JWT creation and verification
    │   ├── deps.py               get_db(), get_current_user(), get_current_user_optional()
    │   └── celery_app.py         Celery instance configured with Redis broker
    ├── db/
    │   └── session.py            Async SQLAlchemy engine, AsyncSessionLocal, Base
    └── services/
        └── storage.py            Cloudflare R2: upload_pdf(), upload_cover(),
                                  delete_object(), extract_first_page_as_cover()
```

### Key backend decisions

**Async throughout.** The FastAPI application uses `async def` route handlers with `asyncpg` as the database driver and `AsyncSession` from SQLAlchemy. This means the event loop is never blocked by database I/O.

**Migrations with Alembic.** All schema changes are tracked in versioned migration files. Running `alembic upgrade head` applies all pending migrations in order. The `env.py` file is configured for async execution.

**Soft deletes for comments.** When a comment is deleted, the row is not removed from the database. Instead, `is_deleted` is set to `True` and the body is cleared. This preserves the thread structure so replies to the deleted comment remain readable. The API returns deleted comments with a placeholder body and no author information.

**R2 storage.** All PDFs and images are uploaded to Cloudflare R2 via the boto3 S3-compatible API. The public URL is constructed as `{R2_PUBLIC_URL}/{key}` and stored in the database. When a book or edition is deleted, the corresponding R2 objects are deleted first before the database rows, so storage is never orphaned.

**PDF proxy.** The API proxies PDF files from R2 to the browser at `GET /books/{id}/editions/{id}/pdf`. This streams the PDF through the API rather than exposing R2 URLs directly, which avoids cross-origin issues with the browser's native PDF viewer. The response includes `Cache-Control: public, max-age=3600` so the browser caches the PDF and subsequent page navigation requests are fast.

---

## Frontend Structure

```
frontend/
├── Dockerfile
├── index.html                    GIS script tag, theme initialisation
├── package.json
├── vite.config.ts                Proxy: /api → http://api:8000, CORS headers
├── tailwind.config.ts            Custom color scales: ink-*, paper-*
└── src/
    ├── main.tsx                  React entry, QueryClient, theme initialisation
    ├── App.tsx                   BrowserRouter, routes, RequireAuth guard
    ├── index.css                 Tailwind, component classes, dark mode overrides
    ├── types/
    │   └── index.ts              TypeScript interfaces for all API responses
    ├── api/
    │   ├── client.ts             Axios instance, JWT interceptor, token refresh
    │   └── index.ts              authApi, booksApi, commentsApi, usersApi,
    │                             progressApi, bookmarksApi, readingListsApi, accountApi
    ├── stores/
    │   ├── authStore.ts          Zustand persist store: user, tokens, cross-tab sync
    │   └── themeStore.ts         Zustand persist store: theme preference, applies to <html>
    ├── hooks/
    │   ├── useBooks.ts           React Query hooks: useBooks, useBook, useComments,
    │   │                         useReplies, useCreateComment, useVoteComment,
    │   │                         useDeleteBook, COMMENTS_KEY
    │   └── usePostLoginToast.ts  Post-redirect toast via sessionStorage
    ├── components/
    │   ├── layout/
    │   │   └── Navbar.tsx        Sticky header, auth links, theme toggle
    │   ├── reader/
    │   │   ├── PDFViewer.tsx     Native browser PDF viewer via <iframe>, goToPage() handle
    │   │   ├── CommentBox.tsx    Comment and reply form with page number field
    │   │   ├── CommentThread.tsx Comment card: vote, edit, delete, reply, @mention, tombstone
    │   │   └── BookmarkPanel.tsx Private bookmarks list for current edition
    │   └── ui/
    │       ├── Avatar.tsx        Circular avatar: photo or initial fallback
    │       ├── BookCard.tsx      Cover, title, author, edition count, timestamp
    │       ├── AddToListPanel.tsx Reading list selector panel
    │       ├── GoogleSignInButton.tsx GIS popup mode button
    │       └── PasswordStrength.tsx  Live strength bar and requirements checklist
    └── pages/
        ├── Landing.tsx           Hero, feature grid, how-it-works, recent books
        ├── Browse.tsx            Debounced search, book grid
        ├── BookDetail.tsx        Cover, description, editions list, add edition, delete
        ├── ReadingPage.tsx       Draggable split: PDF left, discussion+bookmarks right
        ├── Upload.tsx            PDF and cover upload form
        ├── Login.tsx             Email/username + password, Google Sign-In
        ├── Register.tsx          Email, username, password + strength indicator
        ├── Settings.tsx          Two-tab layout: Account (avatar, username, password,
        │                         danger zone) and Appearance (theme picker)
        └── UserProfile.tsx       Public profile: books, comments, reading lists
```

### Key frontend decisions

**React Query for server state.** All API data is managed by TanStack Query (`@tanstack/react-query`). Cache invalidation is used after mutations rather than manual state updates, except where optimistic updates are needed (comment edit and delete update the query cache directly for instant UI feedback).

**Zustand for client state.** Auth tokens and user info are stored in a Zustand persist store backed by `localStorage`. A `window.addEventListener("storage", ...)` handler syncs the store across browser tabs so avatars and authentication state update everywhere instantly.

**Post-redirect toasts.** When a page redirect is required after a mutation (e.g. after login), `window.location.href` is used instead of `navigate()` to ensure Zustand's localStorage write completes before the next page renders. A toast message is stored in `sessionStorage` before the redirect and displayed after the new page mounts via the `usePostLoginToast` hook.

**Native PDF viewer.** PDF rendering uses the browser's built-in PDF viewer via an `<iframe>` element pointing to the API proxy URL. This gives Chrome/Edge native quality, text selection, the built-in bookmarks panel, search, and zoom. Navigating to a specific page reloads the iframe with a `#page=N` URL fragment and an incrementing React `key` prop to force a remount.

---

## Database Schema

All timestamps are stored as `TIMESTAMP WITH TIME ZONE`.

### users

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PK, auto-increment | |
| email | varchar(255) | unique, not null | |
| username | varchar(50) | unique, not null | 3–30 chars, letters/numbers/`_`/`-` only |
| hashed_password | varchar(255) | nullable | null for Google-only accounts |
| google_id | varchar(255) | unique, nullable | Google sub claim |
| avatar_url | varchar(1000) | nullable | public R2 URL |
| avatar_r2_key | varchar(500) | nullable | used to delete from R2 |
| is_active | boolean | default true | false = banned/deleted |
| created_at | timestamptz | server default now() | |
| updated_at | timestamptz | server default now(), on update | |

### books

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PK | |
| title | varchar(500) | not null | GIN trigram index |
| author | varchar(255) | not null | GIN trigram index |
| description | text | nullable | |
| cover_url | varchar(1000) | nullable | public R2 URL |
| cover_r2_key | varchar(500) | nullable | |
| uploader_id | integer | FK → users (SET NULL on delete) | |
| created_at | timestamptz | | |
| updated_at | timestamptz | | |

### editions

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PK | |
| book_id | integer | FK → books (CASCADE delete) | |
| edition_number | integer | not null | |
| year | integer | nullable | |
| publisher | varchar(255) | nullable | |
| language | varchar(10) | default 'en' | ISO 639-1 code |
| pdf_url | varchar(1000) | not null | public R2 URL |
| pdf_r2_key | varchar(500) | not null | |
| file_size_bytes | bigint | nullable | |
| page_count | integer | nullable | |
| uploader_id | integer | FK → users (SET NULL on delete) | |
| created_at | timestamptz | | |

### comments

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PK | |
| edition_id | integer | FK → editions (CASCADE delete) | |
| user_id | integer | FK → users (CASCADE delete) | |
| body | text | not null | empty string when `is_deleted = true` |
| page_number | integer | nullable | links comment to a specific page |
| parent_id | integer | FK → comments (CASCADE delete), nullable | null = top-level comment |
| is_deleted | boolean | default false | soft delete flag |
| edited_at | timestamptz | nullable | set when body is updated |
| created_at | timestamptz | | |
| updated_at | timestamptz | | |

### votes

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PK | |
| user_id | integer | FK → users (CASCADE delete) | |
| comment_id | integer | FK → comments (CASCADE delete) | |
| value | smallint | not null | +1 or -1 |
| created_at | timestamptz | | |
| | | unique(user_id, comment_id) | one vote per user per comment |

### reading_progress

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PK | |
| user_id | integer | FK → users (CASCADE delete) | |
| edition_id | integer | FK → editions (CASCADE delete) | |
| last_page | integer | not null | |
| updated_at | timestamptz | | |
| | | unique(user_id, edition_id) | upserted on each page change |

### bookmarks

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PK | |
| user_id | integer | FK → users (CASCADE delete) | |
| edition_id | integer | FK → editions (CASCADE delete) | |
| page_number | integer | not null | |
| note | varchar(500) | nullable | private note |
| created_at | timestamptz | | |

### reading_lists

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PK | |
| user_id | integer | FK → users (CASCADE delete) | |
| name | varchar(255) | not null | |
| is_public | boolean | default true | |
| created_at | timestamptz | | |
| updated_at | timestamptz | | |

### reading_list_items

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PK | |
| list_id | integer | FK → reading_lists (CASCADE delete) | |
| book_id | integer | FK → books (CASCADE delete) | |
| added_at | timestamptz | | |
| | | unique(list_id, book_id) | |

---

## API Reference

All endpoints are under the prefix `/api/v1`. The interactive Swagger UI is available at `http://localhost:8000/docs` while the application is running.

### Authentication — `/auth`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| POST | `/auth/register` | No | Create a new account. Body: `email`, `username`, `password`. Returns token pair and `is_new_user: true`. |
| POST | `/auth/login` | No | Sign in with email or username and password. Returns token pair. |
| POST | `/auth/refresh` | No | Exchange a valid refresh token for a new token pair. |
| POST | `/auth/google` | No | Sign in or register with a Google ID token from GIS. Returns token pair and `is_new_user` flag. |
| GET | `/auth/me` | Yes | Return the currently authenticated user's profile. |

### Books — `/books`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| POST | `/books/` | Yes | Upload a new book with its first edition. `multipart/form-data`: `pdf_file` (required), `cover_file` (optional), and metadata fields. If no cover is provided, the first PDF page is rendered and uploaded automatically. |
| GET | `/books/` | No | List books, newest first. Query params: `skip`, `limit`. |
| GET | `/books/search` | No | Search by title or author using trigram similarity. Query param: `q`. |
| GET | `/books/{book_id}` | No | Book detail with all editions and edition count. |
| GET | `/books/{book_id}/editions/{edition_id}/pdf` | No | Stream the edition's PDF from R2 through the API. Used by the iframe viewer to avoid cross-origin issues. |
| POST | `/books/{book_id}/cover` | Yes (owner) | Upload or replace the book's cover image. `multipart/form-data`: `cover_file`. |
| POST | `/books/{book_id}/editions` | Yes | Add a new edition to an existing book. `multipart/form-data`: `pdf_file` and edition metadata. |
| DELETE | `/books/{book_id}` | Yes (owner) | Permanently delete a book, all its editions, and all R2 files. Cascades to comments, votes, bookmarks, and reading list items. |

### Editions — `/editions`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| GET | `/editions/{edition_id}` | No | Edition detail with the parent book. Used by the reading page. |

### Comments — `/editions/{edition_id}/comments`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| POST | `/editions/{edition_id}/comments/` | Yes | Post a comment. Body: `body` (required), `page_number` (optional), `parent_id` (optional). |
| GET | `/editions/{edition_id}/comments/` | No | List comments. Query params: `sort` (`newest` or `top`), `parent_id` (null = top-level, integer = replies to that comment), `skip`, `limit`. |
| PATCH | `/editions/{edition_id}/comments/{comment_id}` | Yes (author) | Edit a comment's body. Sets `edited_at`. |
| DELETE | `/editions/{edition_id}/comments/{comment_id}` | Yes (author) | Soft-delete a comment. Sets `is_deleted = true`, clears body. Replies are preserved. |
| POST | `/editions/{edition_id}/comments/{comment_id}/vote` | Yes | Vote on a comment. Body: `value` (+1 or -1). Submitting the same value as an existing vote removes it. |

### Users — `/users`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| GET | `/users/{username}` | No | Public profile: user info, uploaded books (most recent 20), recent comments (most recent 20), public reading lists. |

### Reading Progress — `/editions/{edition_id}/progress`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| GET | `/editions/{edition_id}/progress` | Yes | Get the authenticated user's last-read page for this edition. Returns 404 if no progress recorded. |
| POST | `/editions/{edition_id}/progress` | Yes | Upsert reading progress. Body: `last_page`. Uses `ON CONFLICT DO UPDATE` for atomic upsert. |

### Bookmarks — `/editions/{edition_id}/bookmarks`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| GET | `/editions/{edition_id}/bookmarks` | Yes | List the authenticated user's bookmarks for this edition, ordered by page number. |
| POST | `/editions/{edition_id}/bookmarks` | Yes | Create a bookmark. Body: `page_number`, `note` (optional). |
| DELETE | `/editions/{edition_id}/bookmarks/{bookmark_id}` | Yes (owner) | Delete a bookmark. |

### Reading Lists — `/lists`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| GET | `/lists/mine` | Yes | All reading lists belonging to the authenticated user. |
| GET | `/lists/by-user/{username}` | No | Public reading lists belonging to a given user. |
| POST | `/lists/` | Yes | Create a new reading list. Body: `name`, `is_public`. |
| GET | `/lists/{list_id}` | Conditional | Get a reading list with all books. Requires auth if `is_public = false`. |
| DELETE | `/lists/{list_id}` | Yes (owner) | Delete a reading list. |
| POST | `/lists/{list_id}/books/{book_id}` | Yes (owner) | Add a book to a reading list. |
| DELETE | `/lists/{list_id}/books/{book_id}` | Yes (owner) | Remove a book from a reading list. |

### Account — `/account`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| POST | `/account/avatar` | Yes | Upload a new avatar image. `multipart/form-data`: `avatar`. Deletes the previous R2 object if one exists. Returns updated user. |
| DELETE | `/account/avatar` | Yes | Remove the current avatar. Deletes the R2 object and clears the database fields. Returns updated user. |
| PATCH | `/account/username` | Yes | Change username. Enforces the same validation as registration. Case-insensitive uniqueness check. |
| PATCH | `/account/password` | Yes | Change password. Requires `current_password` and `new_password`. Only available for email-registered accounts. |
| DELETE | `/account/` | Yes | Permanently delete the authenticated user's account and all associated data. Deletes R2 avatar. Cascades to books, editions, comments, votes, bookmarks, reading lists. |

---

## Authentication

### Password requirements

Passwords are validated on both the frontend (Zod schema) and the backend (Pydantic validator) with identical rules:

- Minimum 8 characters, maximum 128 characters
- At least one uppercase letter (A–Z)
- At least one lowercase letter (a–z)
- At least one digit (0–9)
- At least one special character (`!@#$%^&*` etc.)

### Username requirements

- 3 to 30 characters
- Letters, numbers, underscores, and hyphens only
- Cannot start or end with `-` or `_`
- Cannot contain `--` or `__`
- Cannot be a reserved word (admin, root, api, login, settings, etc.)
- Case-insensitive uniqueness — `GeekyBoy` and `geekyboy` are considered the same

### JWT tokens

Access tokens expire after 60 minutes. Refresh tokens expire after 30 days. Both are signed with HS256 using the `SECRET_KEY` environment variable.

The Axios client attaches the access token as `Authorization: Bearer <token>` on every request. When a request returns 401, the Axios response interceptor attempts to exchange the refresh token for a new pair via `POST /auth/refresh`. If the refresh fails (expired or revoked), the user is logged out and redirected to the login page.

### Google Sign-In

The frontend uses Google Identity Services (GIS) in popup mode. When the user clicks the Google button, a popup opens and returns an ID token credential. The frontend sends this credential to `POST /auth/google`. The backend verifies the token with Google's public keys, extracts the `sub` (unique Google user ID), email, and display name, then either creates a new account or signs in the existing one. The response includes `is_new_user: true` when a new account is created, so the frontend can show the appropriate welcome message.

Google Sign-In requires `GOOGLE_CLIENT_ID` to be set in `.env`. New users who register via Google have no password and cannot use the email/password login flow unless they add a password through Settings.

### Rate limiting

The login endpoint enforces a rate limit in memory: 5 failed attempts within a 5-minute window triggers a 15-minute lockout for that identifier (email/username). The counter resets on a successful login. This is a simple in-process implementation; for a production deployment with multiple API workers, move the counter to Redis.

### Cross-tab session sync

The auth store uses Zustand's `persist` middleware backed by `localStorage`. A `window.addEventListener("storage", ...)` handler in `authStore.ts` listens for changes from other browser tabs. When the user uploads a new avatar in one tab, the other tabs update immediately because `setUser()` writes to `localStorage`, triggering the storage event in sibling tabs.

---

## File Upload and Storage

### Upload flow

1. The user selects a PDF and optionally a cover image in the Upload form.
2. The frontend builds a `FormData` object and sends it to `POST /books/` with `Content-Type: multipart/form-data`.
3. The backend reads the file into memory, validates type (`application/pdf`) and size (max 100 MB by default).
4. `storage.upload_pdf()` generates a UUID key (`pdfs/<uuid>.pdf`), calls `boto3.put_object()` on the R2 bucket, and returns the key and public URL.
5. If no cover was provided, `storage.extract_first_page_as_cover()` uses PyMuPDF to render page 1 at 2× resolution as a JPEG and uploads it as the cover. If a cover was provided, it is validated (JPEG/PNG/WebP/GIF, max 5 MB) and uploaded.
6. A `Book` row and an `Edition` row are inserted into PostgreSQL with the R2 URLs and keys.
7. On delete (`DELETE /books/{id}`), R2 objects (cover and all edition PDFs) are deleted first, then the database rows.

### PDF proxy

The browser fetches PDFs from `GET /books/{book_id}/editions/{edition_id}/pdf`. This endpoint streams the file from R2 using `httpx` with `stream=True` and returns a `StreamingResponse` with `Content-Type: application/pdf` and `Cache-Control: public, max-age=3600`. The client-side HTTP cache means that navigating between pages in the viewer after the first load reuses the cached PDF bytes.

---

## PDF Viewer

The reading page uses the browser's native PDF viewer embedded in an `<iframe>` element. The `src` attribute points to the API proxy endpoint.

To navigate to a specific page, the iframe is remounted with a new `src` including the `#page=N` URL fragment. React's `key` prop on the iframe is an integer that increments on every `goToPage()` call, ensuring a new iframe element is created even when navigating to the same page number twice in a row. The browser PDF viewer responds to the fragment on initial load, opening at the correct page immediately.

The `PDFViewerHandle` ref interface exposes a single method: `goToPage(page: number)`. The `ReadingPage` component holds this ref and passes it to `CommentThread` via the `onJumpToPage` callback. Clicking a page badge in any comment calls `goToPage()`.

The reading panel and the discussion panel are separated by a draggable resize handle. During drag, panel widths are applied directly to the DOM via `element.style.width` without updating React state, avoiding the iframe remount that would otherwise occur on every mouse move. React state is updated once on `mouseUp`. A transparent overlay div covers the iframe during drag so mouse events are not captured by the PDF viewer's internal event handlers.

---

## Comment System

### Threading

Comments form a tree structure via the self-referential `parent_id` column on the `comments` table. The top level of a thread (`parent_id = null`) is fetched first. Each comment shows a reply count. Expanding replies fetches `GET /editions/{id}/comments/?parent_id={comment_id}`. The `CommentThread` component is recursive with no depth limit.

### Vote computation

The `_enrich()` function in `comments.py` computes vote information in three batched queries rather than one query per comment. It returns `vote_score` (sum of all votes for each comment), `user_vote` (the authenticated user's own +1/-1 or null), and `reply_count` (number of direct children). This pattern means the comment list endpoint always runs a fixed number of queries regardless of how many comments are returned.

### Soft delete

When a user deletes their own comment, the backend sets `is_deleted = true` and clears `body` to an empty string. The `user_id` is retained so the author row can still be joined (though the author information is not exposed in the response). The frontend renders deleted comments as a tombstone: a greyed-out row with no avatar, the label "Deleted", the timestamp, and the text "[comment deleted]". Replies below the tombstone remain fully visible and interactive.

### Edit

Editing updates `body` and sets `edited_at` to the current timestamp. The response includes `edited_at`, and the frontend displays "(edited)" next to the timestamp for any comment where this field is non-null. The React Query cache is updated optimistically on the client side immediately, before the server response arrives, so the edited text appears instantly.

### @mentions

When a user clicks "Reply" on a comment, the reply text area is pre-filled with `@username `. The `HighlightedBody` component in `CommentThread.tsx` splits the comment body on `@word` patterns and wraps each match in a `<Link>` pointing to the user's profile page.

---

## Reading Progress

Reading progress is stored in the `reading_progress` table with a unique constraint on `(user_id, edition_id)`. When the reading page loads, `GET /editions/{id}/progress` fetches the saved page number and the PDF viewer calls `goToPage()` to open at that page after the iframe loads.

Progress is saved via `POST /editions/{id}/progress` with a debounced call whenever the page number changes. The backend uses PostgreSQL's `INSERT ... ON CONFLICT DO UPDATE` to atomically upsert the progress record.

---

## Bookmarks

Bookmarks are private to the authenticated user. The bookmark panel in the reading page shows all bookmarks for the current edition, sorted by page number. Each bookmark displays the page number, the optional note, and the time it was added. Clicking a bookmark's page badge navigates the PDF viewer to that page.

Bookmarks are fetched from `GET /editions/{id}/bookmarks` and rendered in `BookmarkPanel.tsx`. Creating or deleting a bookmark invalidates the React Query cache so the list updates immediately.

---

## Reading Lists

Reading lists belong to a user and contain books (not editions). Each list has a `name` and an `is_public` flag. Public lists are visible on the user's profile page. Private lists are only visible to the owner.

Books are added and removed from lists via `POST /lists/{list_id}/books/{book_id}` and `DELETE /lists/{list_id}/books/{book_id}`. On the book detail page, the "Add to list" button opens a panel showing the user's lists with checkboxes. Lists that already contain the current book are pre-checked.

The route ordering in `reading_lists.py` places `/mine` and `/by-user/{username}` before `/{list_id}` in the router registration to prevent FastAPI from interpreting `mine` as a list ID.

---

## User Accounts and Settings

The Settings page has two tabs.

**Account tab** contains:
- Avatar upload (JPEG, PNG, WebP, GIF, max 5 MB). Uploads the new image to R2, deletes the old one, and updates the database. The React Query cache for the user's profile page is invalidated after upload so the profile page shows the new avatar without a refresh.
- Username change. Enforces the same validation as registration. Case-insensitive uniqueness check against the existing database records.
- Password change (only shown for email-registered accounts). Requires the current password, a new password, and confirmation. The new password must differ from the current one and satisfy the strong-password rules.
- Account deletion. A two-step confirmation. Deletes the R2 avatar, then the database row (which cascades to all user content). Redirects to the registration page.

**Appearance tab** contains the theme picker (see Theme System below).

---

## Theme System

The theme preference is stored in `themeStore.ts` using Zustand's `persist` middleware, saving only the `theme` field (`"system"`, `"light"`, or `"dark"`) to `localStorage` under the key `bookshelf-theme`.

`initTheme()` is called in `main.tsx` before the React tree renders. It reads the persisted `theme`, computes whether dark mode should be active by calling `getResolved(theme)`, and toggles the `dark` class on `<html>`. A `window.matchMedia` listener watches for OS-level preference changes and reapplies the theme when `theme === "system"`.

Dark mode styling is implemented in `index.css` as `html.dark ...` CSS rules targeting specific class names. Tailwind utility classes that would be overridden in dark mode use inline `style` props with `rgba()` values instead (e.g. the theme card buttons in Settings, the sidebar active state) to avoid specificity conflicts with the global CSS rules.

A toggle switch in the Navbar switches between light and dark. Clicking it always sets an explicit `"light"` or `"dark"` preference, clearing any `"system"` setting. The three-option picker in Settings → Appearance allows restoring the `"system"` preference.

---

## Search

Search is implemented using the `pg_trgm` PostgreSQL extension, which enables trigram similarity matching. The migration `002_phase2_search_tuning.py` creates GIN indexes on `books.title` and `books.author`.

The search endpoint `GET /books/search?q=...` uses `similarity()` scoring for queries of 3 or more characters, returning results ordered by combined title and author similarity. For very short queries (1–2 characters), it falls back to `ILIKE` prefix matching. A similarity threshold is set via `pg_trgm.similarity_threshold` to filter out poor matches.

---

## Email Notifications

Email notifications are sent via the Resend API using a Celery task. The task `send_reply_notification` in `tasks.py` is called from the comment creation endpoint when a new comment has a `parent_id` (i.e. it is a reply). The task emails the parent comment's author to notify them of the reply.

To enable email notifications:
1. Create a Resend account at https://resend.com
2. Verify a sending domain (or use the Resend test address)
3. Create an API key under **API Keys**
4. Set `RESEND_API_KEY` and `FROM_EMAIL` in `.env`

If `RESEND_API_KEY` is not set, the Celery task logs a warning and returns without error. The rest of the application is unaffected.

---

## Design System

### Color scales (defined in `tailwind.config.ts`)

**`ink-*`** — deep navy blue. Used for primary buttons, links, headings, active states, and the landing page hero background (`ink-950`). Scale runs from `ink-50` (very light) to `ink-950` (near-black navy).

**`paper-*`** — warm off-white. Used for page backgrounds (`paper-50`, `paper-100`) and borders (`paper-200`). Gives the application a book-like warmth in light mode.

### Typography

- **`font-sans`** — Inter. All body text, labels, UI controls, and prose.
- **`font-serif`** — Lora. All section headings (`h1`, `h2`, `h3`) and the Bookshelf logo. Gives a literary feel appropriate to a reading platform.
- **`font-mono`** — JetBrains Mono. Page numbers and any inline code.

### Global component classes (`index.css`)

| Class | Description |
|-------|-------------|
| `.btn-primary` | Ink-blue filled button with hover darkening |
| `.btn-secondary` | White button with ink border. In dark mode: dark background with indigo-tinted text. |
| `.input` | Standard text input: white background, gray border, ink focus ring, explicit dark caret color |
| `.label` | Form field label: small, medium weight, ink-700 |
| `.card` | White box with paper-200 border and subtle shadow. In dark mode: dark background. |
| `.page-badge` | Clickable blue pill showing a page number. Appears on comments that have a `page_number` set. |
| `.discussion-panel` | Applied to the right panel in the reading page. All dark-mode rules for the discussion area scope to this class. |
| `.landing-section-alt` | Applied to alternating landing page sections to create a light/dark background rhythm in both themes. |
