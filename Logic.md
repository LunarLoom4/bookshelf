# Bookshelf — Logic

Per-file explanation of what each file does, why it exists, and the decisions behind it.

---

## Root

### docker-compose.yml

Defines seven services. `db` and `redis` have healthchecks so `api`, `worker`, and `beat` wait for them before starting. The `api`, `worker`, and `beat` services share the same Dockerfile — they differ only in the startup command (`uvicorn` for the API, `celery worker` and `celery beat` for the background workers). Source directories are mounted as volumes so code changes take effect without rebuilding images.

### .env.example

Template for all environment variables with safe defaults where possible and blank values for secrets. Copy to `.env` before starting. `.env` is listed in `.gitignore` and must never be committed.

### nginx/nginx.conf

Single `server` block listening on port 80. Routes `/api/` to the FastAPI container on port 8000, everything else to the Vite dev server on port 5173. `client_max_body_size 120M` allows PDF uploads up to 120 MB. WebSocket upgrade headers are passed through for Vite's Hot Module Replacement. `Cross-Origin-Opener-Policy: same-origin-allow-popups` is set to allow the Google Sign-In popup to communicate back to the page.

### scripts/dev.sh

Starts `db` and `redis` first, waits for PostgreSQL using `pg_isready`, runs `alembic upgrade head` to apply all pending migrations, then starts the remaining services. This ordering prevents the API from starting before the database is ready.

### scripts/sync.sh

Copies all source files from the Windows host into the running containers using `docker cp`, then restarts both services. Used during development when file watchers do not pick up changes automatically.

### scripts/seed.py

Creates 10 test user accounts, 100 books with 1–3 editions each, approximately 1,500 comments with threaded replies, votes, bookmarks, reading progress entries, and reading lists. The script is idempotent — it checks for existing records before inserting. Run with `docker compose exec api python scripts/seed.py`.

---

## Backend — app/core/

### config.py

`Settings` extends `pydantic_settings.BaseSettings`. All environment variables are declared here with types and defaults. `@lru_cache` on `get_settings()` creates the settings object once per process. Computed properties (`allowed_origins_list`, `max_pdf_bytes`, `max_cover_bytes`) derive values from the stored config so callers do not repeat the conversion math.

### security.py

Wraps `passlib` bcrypt and `python-jose` JWT in four functions. `create_access_token` and `create_refresh_token` embed a `"type"` claim (`"access"` or `"refresh"`) so that a refresh token cannot be used as an access token. `decode_token` raises `JWTError` on any problem — callers handle the exception and return a 401.

### deps.py

Two FastAPI dependency functions. `get_current_user` extracts the Bearer token from the `Authorization` header, decodes it, verifies the type is `"access"`, and loads the user from the database. Raises 401 if anything fails. `get_current_user_optional` wraps it and returns `None` instead of raising — used on public routes that optionally personalize responses, such as returning the authenticated user's vote on each comment.

### celery_app.py

Creates the Celery application pointed at Redis as both broker and result backend. `include=["app.tasks"]` tells Celery where to find task definitions. `worker_prefetch_multiplier=1` prevents workers from holding more tasks than they can process, which matters for tasks that call external APIs like Resend.

---

## Backend — app/db/

### session.py

Creates the async SQLAlchemy engine with `pool_pre_ping=True`, which validates connections before use and avoids stale connection errors after PostgreSQL restarts. `AsyncSessionLocal` is a session factory. `get_db` is a FastAPI dependency generator that yields one session per request, rolls back on error, and always closes the session regardless of outcome. `Base` is the declarative base all models inherit from.

---

## Backend — app/models/

### user.py

`users` table. `is_active` allows disabling accounts without deleting them. `updated_at` uses `onupdate=func.now()` so SQLAlchemy updates it automatically on any row change. `hashed_password` is nullable because Google-registered users have no password. `google_id` is unique and nullable — set when the account is created via Google Sign-In. `avatar_url` and `avatar_r2_key` are nullable; the key is stored alongside the URL so the R2 object can be deleted when the avatar is changed or removed.

### book.py

`books` table. `cover_url` stores the public R2 URL served directly to browsers. `cover_r2_key` stores the R2 object key for deletion. `uploader_id` uses `SET NULL` on delete rather than CASCADE so books survive when a user account is deleted.

### edition.py

`editions` table. Each edition belongs to a book with CASCADE delete, so deleting a book deletes all its editions. `pdf_r2_key` is stored for the same reason as `cover_r2_key`. `file_size_bytes` is `BigInteger` because PDFs can theoretically exceed 2 GB. `page_count` is nullable — it is populated by PyMuPDF during the upload process when auto-generating a cover, otherwise left null.

### comment.py

`comments` table. `page_number` is nullable — not all comments reference a page. `parent_id` is a self-referencing foreign key pointing to `comments.id` — setting it makes a comment a threaded reply; leaving it null makes it a top-level comment. `is_deleted` is set to `True` for soft-deleted comments; the `body` is cleared to an empty string. `edited_at` is set to the current timestamp when a comment's body is updated. The `replies` relationship uses `passive_deletes=True` so SQLAlchemy does not issue a SELECT before the database cascade handles child deletion.

### vote.py

`votes` table. `value` is `SmallInteger` and stores only `+1` or `−1`. A `UniqueConstraint("user_id", "comment_id")` enforces one vote per user per comment at the database level. Submitting the same value as an existing vote deletes the vote (toggle). Submitting the opposite value updates it.

### reading_progress.py

`reading_progress` table. A unique constraint on `(user_id, edition_id)` ensures one progress record per user per edition. The API uses `INSERT ... ON CONFLICT DO UPDATE` for atomic upsert — no separate existence check required.

### bookmark.py

`bookmarks` table. Private to the authenticated user — no other user can read another user's bookmarks through the API. Each bookmark has an optional `note` field (up to 500 characters).

### reading_list.py

Two tables. `reading_lists` has `is_public` to control visibility. `reading_list_items` has a unique constraint on `(list_id, book_id)` to prevent duplicates. Items link to books (not editions), since a reading list represents interest in a work rather than a specific PDF.

---

## Backend — app/schemas/

### auth.py

Contains `RegisterRequest`, `LoginRequest`, `TokenResponse`, `UserResponse`, `CommentAuthor`, `validate_username()`, `validate_password()`, and the `RESERVED_USERNAMES` set. `validate_username` and `validate_password` are module-level functions (not just Pydantic validators) so they can be imported and reused in `account.py` without duplication. `RESERVED_USERNAMES` blocks names like `admin`, `login`, `settings`, and `api` at both registration and username change. `UserResponse.from_user()` computes `has_password` from whether `hashed_password` is null — this tells the frontend whether to show the password section in Settings.

### comment.py

`CommentResponse` includes `vote_score`, `user_vote`, `reply_count`, `is_deleted`, and `edited_at` — none of which are direct columns. They are set by `_enrich()` in the comments endpoint after fetching from the votes table. `CommentAuthor` includes `avatar_url` so comment avatars display correctly without a separate profile fetch. `CommentUpdate` is the schema for the edit endpoint — it accepts only `body` and applies the same length and non-empty validation as `CommentCreate`.

### phase3.py

Schemas for reading progress, bookmarks, and reading lists. `ReadingListWithItems` embeds a list of `BookListItem` so the reading list detail endpoint returns all books in one response without a second request.

---

## Backend — app/services/

### storage.py

Wraps the `boto3` S3 client pointed at the Cloudflare R2 endpoint (`{account_id}.r2.cloudflarestorage.com`). `_get_client()` creates a new client per call — boto3 clients are thread-safe but creating one is cheap and avoids sharing state across async boundaries. `_make_key()` generates a UUID-based key to prevent collisions and path-traversal issues. `upload_pdf` and `upload_cover` both set `CacheControl: public, max-age=31536000, immutable` so R2's CDN caches uploaded files aggressively. `delete_object` swallows `ClientError` — deletion is best-effort. `extract_first_page_as_cover` uses PyMuPDF to render the first PDF page at 2× device-pixel resolution as a JPEG, giving a crisp cover image without the user needing to upload one manually.

---

## Backend — app/api/v1/endpoints/

### auth.py

Five routes. `register` checks email and username separately so the error message is specific — "this email is already registered" vs "this username is already taken". `login` accepts either an email address or a username in the `email` field, using a SQL `OR` condition. `refresh` decodes the token and verifies the type claim is `"refresh"` before issuing a new pair. `google` verifies the credential with Google's public keys using `google-auth`, creates or finds the account, and returns `is_new_user: True` only when a new row is inserted (not when an existing user signs in again). Login rate limiting tracks failed attempts per identifier in an in-process dict — five failures within five minutes trigger a fifteen-minute lockout.

### books.py

`create_book_with_edition` validates files before touching R2. If no cover is provided, `extract_first_page_as_cover` is called to generate one automatically. `list_books` and `search_books` use a subquery joining `Book` with `COUNT(Edition.id)` grouped by book so edition counts do not require extra queries. `search_books` uses `pg_trgm` similarity scoring for queries of three or more characters, falling back to `ILIKE` for shorter queries. The `proxy_pdf` endpoint streams the PDF from R2 to the browser using `httpx` with `aiter_bytes(chunk_size=65536)`, setting `Cache-Control: public, max-age=3600` so the browser caches it after the first load. `delete_book` deletes R2 objects first (cover and all edition PDFs) before removing the database rows, so storage is never orphaned.

### editions.py

Single `GET /{edition_id}` route that returns the edition and its parent book in one response. The reading page uses this to avoid a waterfall of two requests.

### comments.py

`_enrich()` makes three batched SQL queries — vote scores, reply counts, and the authenticated user's votes — and attaches the results to the comment list. This avoids N+1 queries regardless of list size. `list_comments` filters by `parent_id` at the SQL level so top-level and reply fetches use the same endpoint. Soft-deleted comments are included in the results (not filtered out) so reply threads remain visible with a tombstone in the correct position. `edit_comment` uses `datetime.now(timezone.utc)` for `edited_at` — not `func.now()`, which is a SQL expression object that cannot be serialized by Pydantic. `delete_comment` sets `is_deleted = True` and clears `body` but leaves the row intact.

### users.py

Returns a profile with the user, their uploaded books (most recent 20), recent comments (most recent 20), and their public reading lists. Public reading lists are included so other users can browse what someone is reading.

### progress.py

`GET` returns the last saved page or 404 if none exists. `POST` uses `INSERT ... ON CONFLICT (user_id, edition_id) DO UPDATE SET last_page = ...` for an atomic upsert — no race condition between check and insert.

### bookmarks.py

Bookmarks are scoped by `user_id` in every query — the API never returns another user's bookmarks. Delete verifies ownership before removing the row.

### reading_lists.py

Route ordering matters here: `/mine` and `/by-user/{username}` are registered before `/{list_id}` in the router. FastAPI matches routes in order, so without this ordering, `mine` would be interpreted as a list ID and return 404.

### account.py

Uses `validate_username` and `validate_password` from `auth.py` to apply identical validation rules at both registration and settings change — no duplication. Username uniqueness is checked with `LOWER(username) = LOWER(?)` to enforce case-insensitive uniqueness. Avatar upload deletes the previous R2 object before uploading the new one. Account deletion deletes the R2 avatar first, then the database row (which cascades to all user content).

---

## Backend — alembic/

### env.py

Alembic's built-in runner is synchronous. This file wraps the migration run in `asyncio.run()` using `async_engine_from_config` and `asyncpg`. The database URL is rewritten from `postgresql+asyncpg` to plain `postgresql` for the sync offline mode.

### versions/001_initial.py

Creates the core tables in dependency order: users → books → editions → comments → votes. Also creates the `pg_trgm` extension and GIN trigram indexes on `books.title` and `books.author`.

### versions/002_phase2_search_tuning.py

Sets `pg_trgm.similarity_threshold = 0.1` at the database level. The default threshold of 0.3 is too strict for short book titles; 0.1 returns more permissive results appropriate for a search-as-you-type experience.

### versions/003_phase3_tables.py

Creates `reading_progress`, `bookmarks`, `reading_lists`, and `reading_list_items` tables.

### versions/004_google_oauth.py

Adds the `google_id` column to `users` with a unique constraint. Also makes `hashed_password` nullable to support Google-only accounts.

### versions/005_user_settings.py

Adds `avatar_url` and `avatar_r2_key` columns to `users`.

### versions/006_comment_edit_delete.py

Adds `is_deleted` (boolean, default false) and `edited_at` (timestamptz, nullable) to `comments`.

---

## Frontend — src/

### main.tsx

Entry point. Wraps the app in `QueryClientProvider` with `staleTime: 60_000` and `retry: 1`. Calls `initTheme()` from `themeStore.ts` before the React tree renders so the correct theme class is applied to `<html>` with no flash.

### App.tsx

All routes defined here with React Router v6. Pages are lazy-loaded with `React.lazy()` wrapped in `Suspense`. `RequireAuth` reads `isAuthenticated` from the Zustand store and redirects to `/login` if false. The reading page is full-viewport-height; all other pages scroll normally.

### index.css

Three `@layer` blocks. `@layer base` sets scroll behaviour, serif fonts on headings, and dark mode overrides scoped to `html.dark` selectors. `@layer components` defines `.btn-primary`, `.btn-secondary`, `.input`, `.label`, `.card`, `.page-badge`, `.discussion-panel`, and `.landing-section-alt` classes used throughout. Dark mode rules use `html.dark .classname` CSS selectors rather than Tailwind's `dark:` prefix because the theme is applied via a class on `<html>` rather than a media query. Elements whose colour must remain stable across themes (icon containers, badge elements, interactive buttons) use inline `style` props with `rgba()` values to avoid specificity conflicts with the global dark mode rules.

---

## Frontend — src/api/

### client.ts

Axios instance with `/api/v1` base URL. The request interceptor reads the access token from the Zustand store on every request. The response interceptor catches 401 responses, attempts a token refresh via `POST /auth/refresh` using the raw `axios` instance (not the intercepted one, to avoid loops), queues concurrent 401s during the refresh, and resolves them all once the new token is available. If the refresh fails, `logout()` is called and all queued requests reject.

### index.ts

All API functions grouped into typed objects: `authApi`, `booksApi`, `commentsApi`, `usersApi`, `progressApi`, `bookmarksApi`, `readingListsApi`, `accountApi`. These are plain functions that return Axios promises, separate from React Query hooks, so they can be called imperatively in form submit handlers as well as from hooks.

---

## Frontend — src/stores/

### authStore.ts

Zustand store with `persist` middleware writing to `localStorage` under the key `bookshelf-auth`. Only the four serializable fields are persisted (`partialize`). A `window.addEventListener("storage", ...)` handler at module level syncs the store across browser tabs — when the user uploads a new avatar in one tab, the Navbar in other tabs updates immediately because `setUser()` writes to localStorage and the storage event fires in all other tabs.

### themeStore.ts

Zustand store persisting only `theme` (`"system"`, `"light"`, or `"dark"`) to localStorage under `bookshelf-theme`. `resolved` is never stored — it is computed fresh on each render from `theme` and `window.matchMedia` to avoid stale persisted values. `applyTheme()` toggles the `dark` class on `<html>`. `initTheme()` is called in `main.tsx` before React renders. A `matchMedia` change listener updates the theme when the OS preference changes and `theme === "system"`.

---

## Frontend — src/hooks/

### useBooks.ts

React Query hooks for all data fetching. `COMMENTS_KEY` is exported so `ReadingPage` can call `queryClient.invalidateQueries` with the correct prefix to invalidate both top-level comment lists and nested reply lists in one call. `useComments` and `useReplies` both set `staleTime: 0` so avatars and vote counts are always fresh. `useDeleteBook` invalidates the books list on success. Comment edit and delete in `CommentThread` update the query cache directly with `setQueriesData` for instant UI feedback rather than waiting for a refetch.

### usePostLoginToast.ts

Stores a toast message in `sessionStorage` before a `window.location.href` redirect. After the new page mounts, `usePostLoginToast` reads the stored message, removes it from `sessionStorage`, and calls `toast.success()` after a 200ms delay. This is necessary because `window.location.href` causes a full page reload that destroys the React tree (including any pending toast) before it can render.

---

## Frontend — src/components/reader/

### PDFViewer.tsx

Uses an `<iframe>` element pointing to the API proxy URL (`/api/v1/books/{id}/editions/{id}/pdf`). This gives the browser's native PDF viewer — Chrome quality, text selection, built-in bookmarks panel, search, and zoom — without any JavaScript rendering overhead. `goToPage(n)` updates the iframe `src` to include `#page=N` and increments the React `key` prop to force a remount. The incrementing key ensures that clicking the same page badge twice in a row still triggers a reload. The loading spinner hides when `onLoad` fires; it does not show again on page navigation (only on the initial load) because `onLoad` does not fire for fragment-only src changes.

### CommentBox.tsx

Shows a sign-in prompt for unauthenticated users. The page number field defaults to 1 and can be edited to reference any page. Submitting with no page number sends `page_number: null`. The `placeholder` prop allows the reply box to pre-fill with `@username`.

### CommentThread.tsx

Renders a single comment with all its interactions. Key decisions:

- Tombstone rendering: `is_deleted` comments render a grey placeholder row with no author, no vote controls, and the text "[comment deleted]". Their replies still show below via the normal reply toggle.
- Edit mode: clicking Edit replaces the body with a textarea pre-filled with the current text. Save calls `commentsApi.edit`, updates the React Query cache directly with `setQueriesData`, fires the success toast, then calls `onCommentEdited` to trigger a background invalidation.
- Delete confirmation: clicking Delete shows an inline "Delete this comment? Yes / No" without a modal. Confirming calls `commentsApi.delete`, updates the cache to mark the comment as deleted, fires the success toast, then calls `onCommentDeleted`.
- `@mention` rendering: `HighlightedBody` splits the body on `@word` patterns and wraps each match in a `<Link>` to the user's profile.
- Quote preview: expanding the reply box shows a snippet of the parent comment body and author name above the text area.
- The `queryClient.setQueriesData` call in both edit and delete uses `{ queryKey: [COMMENTS_KEY, editionId], exact: false }` to update all matching cache entries simultaneously — both the top-level comment list and any open reply panels.

### BookmarkPanel.tsx

Lists bookmarks for the current edition sorted by page number. Clicking a page badge calls `onJumpToPage`. Bookmarks are deleted individually with a confirmation step. The panel is empty-state-aware — shows a prompt when no bookmarks exist yet.

---

## Frontend — src/pages/

### Landing.tsx

Hero section uses `bg-ink-950` (near black) for a strong visual statement. Feature grid is three columns of icon + title + description. The "How it works" steps section and the "Recently added" books section are marked with `landing-section-alt` and `landing-section-main` classes so they get distinct dark-mode backgrounds, mirroring the alternating light/dark pattern of the light mode.

### Browse.tsx

Debounced search with 300ms delay using `useDebounce`. When the query is empty, `useBooks` shows all books. When non-empty, `useBookSearch` shows trigram-matched results. The X button clears the query.

### BookDetail.tsx

`EditionRow` renders each edition with a "Read" button (always visible) and a "Delete" button for the book owner. The delete button shows an inline confirmation ("Delete book? Yes / No") and calls `useDeleteBook`, which deletes the book via `DELETE /books/{id}` and redirects to Browse on success. Cover upload is available to the book owner via an "Upload cover" button. "Add edition" is available to any authenticated user. Editions are sorted by `edition_number DESC` so the latest appears first.

### ReadingPage.tsx

The split layout uses two `div` elements with percentage widths and a `div` drag handle between them. During drag, `pdfPanelRef.current.style.width` and `rightPanelRef.current.style.width` are set directly via the DOM — not via React state — to avoid remounting the `<iframe>` on every mouse move. A transparent `position: fixed` overlay div is placed over the entire page during drag so mouse events are not captured by the PDF viewer. React state is updated once on `mouseUp` to commit the final width. The right panel has the `discussion-panel` class applied so dark mode CSS rules scope cleanly to it.

### Upload.tsx

File fields are managed with `useState` separately from `react-hook-form` because `react-hook-form`'s `register` does not handle `File` inputs. The `year` field uses `.optional().or(z.literal(""))` because empty number inputs submit empty strings. The Publisher field has its own row above the Edition/Year/Language row. `autoComplete="off"` is set on all metadata inputs to prevent browser autofill from injecting book-unrelated history.

### Login.tsx / Register.tsx

Both pages redirect to `/` with `window.location.href` (not `navigate()`) after successful authentication. `window.location.href` causes a full page reload, ensuring Zustand's localStorage write completes and is read back by the new page before React renders — this prevents the white-screen flash that occurs when `navigate()` renders the next page before the store has hydrated. The post-login toast is stored in `sessionStorage` via `setPostLoginToast` before the redirect and shown by the destination page's `usePostLoginToast` call.

### Settings.tsx

Two-tab layout with a sidebar. **Account tab** contains avatar upload (with R2 cleanup of the old avatar), username change (same validation as registration), password change (current + new + confirm, only shown for email-registered accounts), and account deletion (two-step confirmation). **Appearance tab** contains a three-card theme picker (System / Light / Dark). Tab active states and theme card active states use inline `style` props with `rgba()` values to avoid the Tailwind class name overrides that caused them to appear white in dark mode.

### UserProfile.tsx

`staleTime: 0` on the profile query ensures the avatar is always current when the page mounts. The reading lists section shows public lists belonging to the profile user. Comment cards link to the reading page for the specific edition.
