# Bookshelf — Logic

Per-file explanation of what each file does, what decisions were made, and why.

---

## Root

### docker-compose.yml
Defines 7 services. `db` and `redis` have healthchecks so `api`, `worker`, and `beat` wait for them to be ready before starting. The `api` and `worker` services share the same Dockerfile — they differ only in the command (`uvicorn` vs `celery worker`). Volumes mount the source directories so hot reload works without rebuilding.

### .env.example
Template for all environment variables with safe defaults where possible and blank values for secrets. Copy to `.env` before starting. `.env` is gitignored.

### nginx/nginx.conf
Single `server` block listening on port 80. Routes `/api/` to the FastAPI container, everything else to the Vite dev server. `client_max_body_size 120M` allows PDF uploads up to 120MB. WebSocket upgrade headers are passed through for Vite HMR.

### scripts/dev.sh
Starts `db` and `redis` first, waits for PostgreSQL to be ready using `pg_isready`, runs `alembic upgrade head`, then starts all remaining services. Copies `.env.example` to `.env` if it doesn't exist yet.

---

## Backend — app/core/

### config.py
`Settings` extends `pydantic_settings.BaseSettings`. It reads all values from environment variables and the `.env` file. `@lru_cache` on `get_settings()` means the settings object is created once per process. Computed properties (`allowed_origins_list`, `max_pdf_bytes`, `max_cover_bytes`) derive runtime values from the stored config rather than duplicating math at call sites.

### security.py
Wraps `passlib` bcrypt and `python-jose` JWT in four clean functions. `create_access_token` and `create_refresh_token` both embed a `"type"` claim so refresh tokens can't be used as access tokens. `decode_token` raises `JWTError` on any problem — callers handle the exception.

### deps.py
Two FastAPI dependency functions. `get_current_user` extracts the Bearer token from the `Authorization` header, decodes it, and fetches the user from the database. Raises `401` if anything fails. `get_current_user_optional` wraps it and returns `None` instead of raising — used on public routes that optionally personalize responses (e.g. returning the user's vote on each comment).

### celery_app.py
Creates the Celery application pointed at Redis as both broker and result backend. `include=["app.tasks"]` tells Celery where to auto-discover tasks. `worker_prefetch_multiplier=1` prevents workers from grabbing more tasks than they can handle, important for long-running email sends.

---

## Backend — app/db/

### session.py
Creates the async SQLAlchemy engine with `pool_pre_ping=True` (validates connections before use, avoids stale connection errors after PostgreSQL restarts). `AsyncSessionLocal` is a session factory. `get_db` is a FastAPI dependency generator that yields one session per request, rolls back on error, and always closes. `Base` is the declarative base all models inherit from.

---

## Backend — app/models/

### user.py
`users` table. `is_active` flag lets admins disable accounts without deleting them. `updated_at` uses `onupdate=func.now()` so SQLAlchemy updates it automatically on any row change.

### book.py
`books` table. `cover_url` stores the public R2 URL (served directly to browsers). `cover_r2_key` stores the internal R2 object key — needed to delete the file if the book is removed. `uploader_id` is `SET NULL` on delete rather than CASCADE, so books survive account deletion.

### edition.py
`editions` table. Each edition belongs to a book (`book_id`, CASCADE delete — editions are deleted when the book is). `pdf_r2_key` is stored for the same reason as `cover_r2_key`. `file_size_bytes` is `BigInteger` because PDFs can exceed 2GB. `page_count` is nullable because we don't parse the PDF on upload — it could be populated later by a Celery task.

### comment.py
`comments` table. `page_number` is nullable — not all comments reference a page. `parent_id` is a self-referencing foreign key (`comments.id`, CASCADE delete) — setting it makes a comment a threaded reply. Setting it `null` makes a top-level comment. The `replies` relationship and `parent` back-reference allow ORM traversal, though the API fetches replies in separate queries rather than eager-loading to avoid N+1.

### vote.py
`votes` table. `value` is `SmallInteger` and stores only `+1` or `-1`. The `UniqueConstraint("user_id", "comment_id")` enforces one vote per user per comment at the database level — not just in application code.

---

## Backend — app/schemas/

### auth.py
`RegisterRequest` validates username format (3-30 chars, alphanumeric + `_-`) and minimum password length using `field_validator`. Uses `pydantic.EmailStr` for email validation (requires `email-validator` installed). `TokenResponse` is what both register and login return.

### book.py
Three schemas: `EditionResponse` (full edition data), `BookResponse` (book + list of editions, used on detail pages), `BookListItem` (book without editions but with `edition_count`, used on browse/landing). All use `model_config = {"from_attributes": True}` to construct from ORM objects.

### comment.py
`CommentResponse` includes computed fields (`vote_score`, `user_vote`, `reply_count`) that are not columns — they're set by `_enrich()` in the comments endpoint after fetching from the votes table. `VoteRequest` validates `value` in `model_post_init`.

---

## Backend — app/services/

### storage.py
Wraps `boto3` S3 client pointed at the Cloudflare R2 endpoint (`{account_id}.r2.cloudflarestorage.com`). `_get_client()` creates a new client per call — this is intentional; boto3 clients are thread-safe but the session is not, and creating a client is cheap. `_make_key()` generates a UUID-based key to avoid collisions and path traversal issues. `upload_pdf` and `upload_cover` return `(key, public_url)` — the key is stored in the database for future deletion, the URL is returned to clients. `delete_object` swallows `ClientError` — best-effort deletion.

---

## Backend — app/api/v1/endpoints/

### auth.py
Four routes. `register` checks email+username uniqueness in a single query with `OR`, then hashes and creates the user. `login` fetches by email, verifies the password hash with `passlib.verify`. `refresh` decodes the refresh token, checks the `"type"` claim is `"refresh"`, then issues a new token pair. `me` just returns the user object from the `get_current_user` dependency.

### books.py
`create_book_with_edition` handles multipart upload. It validates both files before touching R2. If the cover upload succeeded but something fails later, the cover is orphaned in R2 — acceptable for now, a cleanup Celery task can handle it in Phase 3. Uses `db.flush()` to get `book.id` before creating the edition without committing yet. `list_books` and `search_books` use a single SQL query joining `Book` with `COUNT(Edition.id)` grouped by book so edition counts don't require extra queries. `search_books` currently uses ILIKE — Phase 2 upgrades to `pg_trgm` similarity.

### editions.py
Single `GET /{edition_id}` route. Returns the edition and its parent book in one response object so `ReadingPage` has everything it needs in one request (no waterfall).

### comments.py
`_enrich()` is the key function. It takes a list of comments and makes three batched SQL queries — vote scores, reply counts, and the current user's votes — then attaches the results to each comment. This avoids N+1 queries regardless of comment list size. `list_comments` filters by `parent_id` at the SQL level, so top-level and reply fetches use the same endpoint. The `sort=top` branch joins to a subquery that sums votes, rather than loading all votes into Python. `vote_comment` toggles: same value = delete, opposite = update.

### users.py
Returns a profile object with the user, their uploaded books (most recent 20), and their recent comments (most recent 20). Comment bodies are truncated on the frontend.

---

## Backend — alembic/

### env.py
Alembic's built-in runner is synchronous. This file uses `asyncio.run()` around an `async_engine_from_config` call to make it work with `asyncpg`. The `DATABASE_URL` is rewritten to use `psycopg2` for the sync offline mode and `asyncpg` for the online async mode.

### versions/001_initial.py
Creates all five Phase 1 tables in dependency order (users → books → editions → comments → votes). Also runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` and creates GIN trigram indexes on `books.title` and `books.author` for Phase 2 full-text search. These are safe to create now because the extension has no downside and the indexes don't affect correctness.

---

## Frontend — src/

### main.tsx
Entry point. Wraps the app in `QueryClientProvider` with `staleTime: 60_000` (data is considered fresh for 60 seconds, reducing redundant refetches) and `retry: 1` (one retry on failure before showing an error). `ReactQueryDevtools` is included for development.

### App.tsx
All routes defined here with React Router v6. Pages are lazy-loaded with `React.lazy()` and wrapped in `Suspense` with a spinner fallback. `RequireAuth` reads `isAuthenticated` from the Zustand store and redirects to `/login` if false. The reading page is full-height (`h-screen - navbar`), all others are standard scrolling pages.

### index.css
Three layers. `@layer base` sets `scroll-behavior: smooth` and makes `h1-h3` use the serif font. `@layer components` defines the `.btn-primary`, `.btn-secondary`, `.input`, `.label`, `.card`, and `.page-badge` classes used throughout — centralizing styles so individual components don't need to repeat Tailwind chains.

---

## Frontend — src/api/

### client.ts
Axios instance with `/api/v1` base URL. Two interceptors. The request interceptor reads the access token from the Zustand store on every request. The response interceptor catches 401s — it calls `POST /auth/refresh` once using the raw `axios` (not the intercepted instance) to avoid infinite loops. While the refresh is in flight, other 401s are queued and resolved once the refresh completes. If refresh fails, `logout()` is called and all queued requests reject.

### index.ts
Four API objects (`authApi`, `booksApi`, `commentsApi`, `usersApi`) each with typed methods that return Axios promises. Keeping these separate from the React Query hooks means the same functions can be called imperatively (e.g. in `onSubmit` handlers) as well as from hooks.

---

## Frontend — src/stores/

### authStore.ts
Zustand store with `persist` middleware writing to `localStorage`. Only the four serializable fields are persisted (`partialize`). `setTokens` sets both tokens and flips `isAuthenticated`. `logout` clears all four fields. The store is imported by both the Axios client (to read the token) and by `RequireAuth` and the `Navbar` (to read auth state).

---

## Frontend — src/hooks/

### useBooks.ts
React Query hooks for books and comments. `useBooks`, `useBookSearch`, `useBook` are read hooks with query keys that include all parameters so cache entries are correctly scoped. `useUploadBook`, `useCreateComment`, `useVoteComment` are mutation hooks that each call `invalidateQueries` on success to trigger refetches. `useBookSearch` has `enabled: q.length > 0` so it doesn't fire on an empty query string.

### useDebounce.ts
Generic hook that delays a value update by `delay` ms. `Browse.tsx` uses it to debounce the search input so the API isn't called on every keystroke.

---

## Frontend — src/components/reader/

### PDFViewer.tsx
The main complexity here is managing the render lifecycle. `pdfRef` holds the loaded `PDFDocumentProxy`. `renderTaskRef` holds the current `RenderTask`. Before rendering a new page or changing zoom, the current task is cancelled to avoid two renders writing to the same canvas. `useImperativeHandle` exposes `goToPage(n)` on a forwarded ref so the parent `ReadingPage` can call it from comment clicks and keyboard events without `PDFViewer` knowing anything about comments. The worker is loaded as a URL via `import.meta.url` which Vite handles correctly at build time.

### CommentBox.tsx
Checks `isAuthenticated` first — unauthenticated users see a "Sign in to comment" message. The page number field is an uncontrolled number input that defaults to the viewer's current page but can be overridden. Clearing it submits a comment with `page_number: null`. `autoFocusPage` prop is unused by current callers but provided for future use in the reading flow.

### CommentThread.tsx
Renders a single comment with its vote controls (ChevronUp/ChevronDown from lucide-react). Vote button colors change based on `user_vote`: amber for upvote, red for downvote, grey for none. The page badge only renders if `comment.page_number` is not null; clicking it calls `onJumpToPage` which the parent wired to `viewerRef.current.goToPage`. Reply depth is capped at 2 — the `depth` prop prevents `CommentThread` from rendering a reply toggle below that level.

---

## Frontend — src/pages/

### Landing.tsx
Hero section uses `bg-ink-950` (near black) to make a strong visual statement. Feature grid is three columns of icon + title + description. Recent books section shows the last 6 uploads using `BookCard`. If there are no books yet, this section is hidden entirely.

### Browse.tsx
Debounced search with 300ms delay. When the query is empty, shows `useBooks` results (all books). When the query is non-empty, shows `useBookSearch` results. Loading state is tracked separately for each. The X button clears the query and returns to the full list.

### BookDetail.tsx
`EditionRow` is a local component that renders each edition as a clickable row navigating to `/read/{edition_id}`. The "Read" button uses `opacity-0 group-hover:opacity-100` so it only appears on hover. Editions are sorted by `edition_number DESC` so the latest edition shows first.

### ReadingPage.tsx
The 60/40 split is implemented with two divs: `style={{ width: "60%" }}` and `style={{ width: "40%" }}`. The overall container is `h-[calc(100vh-56px)]` (full viewport minus navbar height) with `overflow-hidden` so scrolling happens inside the panels, not on the page. `PDFViewer` gets the ref. The comment panel has its own `overflow-y-auto` scroll. Keyboard events are caught at the page level with `window.addEventListener` — the `keydown` handler skips events when the target is an input or textarea so typing in the comment box doesn't flip pages.

### Upload.tsx
`FileDrop` is a local component that handles both click-to-select and drag-and-drop. It renders the filename and size of the selected file, with an X to clear it. The form uses `react-hook-form` + `zod` for validation but the file fields are managed with `useState` separately because `react-hook-form` doesn't handle file inputs through `register`. The `year` field uses `.optional().or(z.literal(""))` because empty number inputs submit empty strings, not undefined.

### Login.tsx / Register.tsx
Both use `react-hook-form` with `zodResolver`. On success, they call `authApi`, store tokens, fetch `/auth/me` to populate the user object in the store, and navigate to `/`. Toast errors show the backend's `detail` field if present, otherwise a generic message.

### UserProfile.tsx
Fetches `/users/{username}` and renders two sections. Books use the `BookCard` grid. Comments render as cards linking to the reading page for that edition. The avatar is a coloured circle with the first letter of the username — no image upload for avatars in Phase 1.

---

## Phase 2 additions

### backend/alembic/versions/002_phase2_search_tuning.py
Sets `pg_trgm.similarity_threshold = 0.1` at the database level via `ALTER DATABASE`. The threshold controls how loose the `%%` operator is. 0.1 is permissive enough that 2-3 character queries still hit results; the default 0.3 is too strict for short book titles.

### backend/app/api/v1/endpoints/books.py — `upload_cover`
`POST /books/{book_id}/cover`. Checks the caller is the uploader (`book.uploader_id != current_user.id` → 403). Deletes the existing R2 object if one exists before uploading the new one, so old covers don't accumulate in the bucket. Returns the full `BookResponse` so the frontend can update the cover image immediately.

### backend/app/api/v1/endpoints/books.py — `add_edition`
`POST /books/{book_id}/editions`. Any authenticated user can contribute an edition (same as how anyone can upload a book). Checks the requested `edition_number` isn't already taken for this book and returns 409 if it is. Uses `db.flush()` pattern to avoid a separate existence check query.

### backend/app/api/v1/endpoints/books.py — `search_books` (upgraded)
Replaced ILIKE-only with a two-step query. Step 1: raw SQL using `similarity()` and the `%%` trigram operator to score and rank matching book IDs. The `GREATEST(similarity(title), similarity(author))` picks the best match per row. The `OR ILIKE` fallback ensures prefix queries like "pyt" still hit even when similarity score is below threshold. Step 2: fetches full book rows with edition counts for the ranked IDs, then re-sorts in Python to preserve the similarity order (SQL `IN` doesn't guarantee order).

### frontend/src/components/reader/CommentThread.tsx
Two separate state variables now: `showReplies` (controls whether the fetched reply list is visible) and `showReplyBox` (controls the compose form). Previously one toggle served both, so opening the compose box also meant "show replies" which fired the fetch unnecessarily. `useReplies(editionId, comment.id, showReplies)` is `enabled: showReplies`, so no fetch fires until the user explicitly clicks "N replies". After submitting a reply, `showReplies` is set to true so the new reply appears immediately without an extra click. Replies are rendered as `<CommentThread>` at `depth + 1`, capped at 2 levels to avoid infinite nesting. `editionId` is now a required prop, threaded down from `ReadingPage`.

### frontend/src/pages/BookDetail.tsx
Two new local components. `CoverUploadPanel` is shown only to the book owner (`user?.id === book.uploader_id`). It has a hidden file input and a visible trigger button; picking a file shows the filename + a save button. `AddEditionPanel` is shown to any logged-in user. It starts collapsed (an "Add edition" button); clicking opens an inline form with PDF drop zone, edition number, year, publisher, language fields. Edition number defaults to `max(existing) + 1` as a placeholder. Submitting calls `useAddEdition` which hits `POST /books/{id}/editions` and invalidates the book query so the new edition appears in the list.

### frontend/src/pages/UserProfile.tsx
`UserProfileData` interface replaces the three `any`-typed destructured values. The `usersApi.profile` call is now typed `useQuery<UserProfileData>`. "Member since" uses `format(new Date(user.created_at), "MMMM yyyy")` from date-fns. `comment.page_number != null` guards replaced `comment.page_number &&` to correctly handle page 0 (not a real case for books, but correct in principle).

### frontend/src/hooks/useBooks.ts
Three new hooks. `useReplies(editionId, parentId, enabled)` fetches replies for a comment; `enabled` is the guard so it only fires on demand. `useUploadCover(bookId)` wraps `booksApi.uploadCover` and invalidates `[BOOKS_KEY, bookId]` on success. `useAddEdition(bookId)` wraps `booksApi.addEdition` with the same invalidation.

### frontend/src/api/index.ts
`uploadCover(bookId, formData)` and `addEdition(bookId, formData)` added to `booksApi`. The `commentsApi.list` params fix: previously `parent_id: parentId ?? null` always sent `parent_id=null` in the query string when no parent was requested, which could conflict with the backend's `parent_id: int | None = None` default. Now uses a conditional spread so the parameter is omitted entirely when not needed.

### frontend/src/types/index.ts
`User` interface gains `created_at: string` to match the updated `UserResponse` schema.
