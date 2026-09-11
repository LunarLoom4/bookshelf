# Bookshelf

A full-stack web application for sharing PDF books, reading them in the browser, and discussing them page by page. Users upload PDFs, read them natively in Chrome/Edge/Firefox, leave comments pinned to specific pages, bookmark pages with private notes, track reading progress across sessions, and organise books into public or private reading lists.

---

## What it does

- Upload PDF books with metadata (title, author, publisher, year, language, edition number)
- Automatic cover image generated from page 1 of the PDF — or upload your own
- Read PDFs in the browser using the native browser PDF viewer (Chrome quality)
- Leave comments tied to specific page numbers; click a page badge to jump to that page
- Threaded replies to any depth, with upvoting/downvoting
- Edit and delete your own comments (deleted comments show a Reddit-style tombstone so replies remain readable)
- Private bookmarks with optional notes, per edition
- Reading progress saved automatically across sessions
- Public and private reading lists
- User profiles with uploaded books and recent comments
- Google Sign-In or email/password registration
- System / Light / Dark theme toggle

---

## Prerequisites

You need these installed before anything else. You do **not** need Python, Node.js, or PostgreSQL installed locally — Docker runs everything.

| Tool | How to check | Install |
|------|-------------|---------|
| Docker Desktop (latest) | `docker --version` | https://www.docker.com/products/docker-desktop |
| Docker Compose v2+ | `docker compose version` | Included with Docker Desktop |
| Git | `git --version` | https://git-scm.com |

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/LunarLoom4/bookshelf.git
cd bookshelf
```

---

## Step 2 — Get your credentials

The application needs three external services. Follow the steps below to obtain credentials for each.

### Cloudflare R2 (file storage)

Cloudflare R2 stores all uploaded PDFs and cover images. The free tier gives 10 GB of storage and 10 million read operations per month — enough to run this application indefinitely at moderate scale.

1. Go to https://dash.cloudflare.com and create a free account.
2. In the left sidebar, click **R2 Object Storage** → **Create bucket**.
3. Name your bucket (e.g. `bookshelf-files`). Leave all other settings at their defaults and click **Create bucket**.
4. Enable public access so uploaded files can be served directly: open your bucket → **Settings** tab → **Public access** → **Allow Access**. After enabling, a **Public bucket URL** appears — it looks like `https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev`. Copy it.
5. Go back to the main R2 page → **Manage R2 API Tokens** → **Create API Token**.
   - Set **Permissions** to **Object Read & Write**
   - Set **Specify bucket(s)** to your bucket only
   - Click **Create API Token**
   - Copy the **Access Key ID** and **Secret Access Key** immediately — they are shown only once.
6. Your **Account ID** is visible in the URL bar of the Cloudflare dashboard: `dash.cloudflare.com/<ACCOUNT_ID>/...`

You now have: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

### Google OAuth (optional — for Google Sign-In)

If you want users to sign in with their Google account, create an OAuth client. If you skip this, email/password registration still works fully — just leave `GOOGLE_CLIENT_ID` blank in `.env`.

1. Go to https://console.cloud.google.com and create a new project (or use an existing one).
2. In the left menu go to **APIs & Services** → **OAuth consent screen**.
   - Choose **External** and click **Create**
   - Fill in the app name (e.g. "Bookshelf") and your email for the support and developer fields
   - Click **Save and Continue** through the rest (scopes and test users can be left empty for now)
3. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Under **Authorized JavaScript origins**, add: `http://localhost:5173` and `http://localhost:80`
   - Click **Create**
   - Copy the **Client ID** (it looks like `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`)

You now have: `GOOGLE_CLIENT_ID`.

### Resend (optional — for email notifications)

Email notifications are sent when someone replies to your comment. This is entirely optional — the app works fully without it.

1. Go to https://resend.com and create a free account (3,000 emails/month free).
2. Go to **API Keys** → **Create API Key**. Copy the key.
3. Verify a sending domain under **Domains**, or use the default Resend test address.

You now have: `RESEND_API_KEY` and `FROM_EMAIL`.

---

## Step 3 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` in a text editor and fill in the values:

```env
# Database
POSTGRES_USER=bookshelf
POSTGRES_PASSWORD=choose_a_strong_password
POSTGRES_DB=bookshelf

# Auth — generate a secret key by running:
# python3 -c "import secrets; print(secrets.token_hex(32))"
# Or use any random 64-character string from https://randomkeygen.com
SECRET_KEY=paste_your_64_character_random_string_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# Cloudflare R2 — from Step 2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=bookshelf-files
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev

# Redis (leave as-is for local Docker setup)
REDIS_URL=redis://redis:6379/0

# Email notifications (optional — leave blank to disable)
# RESEND_API_KEY=re_xxxx
# FROM_EMAIL=noreply@yourdomain.com

# App
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:80
MAX_PDF_SIZE_MB=100
MAX_COVER_SIZE_MB=5

# Google Sign-In (optional — leave blank to disable)
GOOGLE_CLIENT_ID=
```

---

## Step 4 — Start Docker Desktop

Open Docker Desktop and wait until the icon in your system tray stops animating. The Docker engine must be running before proceeding.

---

## Step 5 — Start the application

```bash
bash scripts/dev.sh
```

This script starts all services in the correct order: database → cache → API → workers → frontend → proxy. On the first run, Docker downloads the base images and installs Node.js dependencies inside the container. This takes 3–5 minutes. Subsequent starts take about 15 seconds.

---

## Step 6 — Open the application

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Main application (React frontend) |
| http://localhost:80 | Same frontend through Nginx |
| http://localhost:8000/docs | Interactive API documentation (Swagger UI) |
| http://localhost:8000/health | API health check |

Go to http://localhost:5173 and click **Register** to create an account.

---

## Step 7 — Load sample data (optional)

A seed script creates 10 test user accounts, 100 books with multiple editions, 1,500+ comments with threaded replies, votes, bookmarks, and reading lists. This is useful for exploring the application without uploading your own content first.

```bash
docker compose exec api python scripts/seed.py
```

The seed script is idempotent — running it twice does not create duplicates.

Test account credentials follow the pattern below. All passwords satisfy the strong-password requirements.

| Username | Password |
|----------|----------|
| alice | Alice@1234! |
| bob_reads | Bobby@5678! |
| carol_lit | Carol@9012! |
| dan_pages | Danny@3456! |
| eve_reads | Evelyn@789! |
| frankly | Frank@1357! |
| grace_notes | Grace@2468! |
| henry_b | Henry@1122! |
| iris_ink | Iris@3344!! |
| jack_shelf | Jack@5566!! |

To remove only the seed data while keeping your own account:

```bash
docker compose exec api python3 -c "
import asyncio
async def delete():
    import asyncpg
    from app.core.config import settings
    url = settings.DATABASE_URL.replace('postgresql+asyncpg', 'postgresql')
    conn = await asyncpg.connect(url)
    seed_emails = ['alice@bookshelf.dev','bob@bookshelf.dev','carol@bookshelf.dev',
                   'dan@bookshelf.dev','eve@bookshelf.dev','frank@bookshelf.dev',
                   'grace@bookshelf.dev','henry@bookshelf.dev','iris@bookshelf.dev',
                   'jack@bookshelf.dev']
    await conn.execute('DELETE FROM users WHERE email = ANY(\$1)', seed_emails)
    print('Seed data removed')
    await conn.close()
asyncio.run(delete())
"
```

---

## Stopping and restarting

```bash
# Stop all containers (data is preserved)
docker compose down

# Stop and delete all data (full reset)
docker compose down -v

# Restart after stopping
docker compose up -d
```

You only need to run `bash scripts/dev.sh` once for the initial setup. After that, `docker compose up -d` is sufficient to start the application.

---

## Troubleshooting

**Port already in use**
If port 5432 (PostgreSQL) or 5173 (frontend) conflicts with another service on your machine, edit `docker-compose.yml` and change the left side of the port mapping. For example, `5433:5432` exposes PostgreSQL on port 5433 instead.

**PDFs or images not loading**
Verify `R2_PUBLIC_URL` in your `.env` has no trailing slash and exactly matches the public URL shown in your Cloudflare R2 bucket settings.

**Email notifications not arriving**
Confirm `RESEND_API_KEY` is set correctly and the sending domain is verified in your Resend account. Email notifications are silently skipped if the key is missing — the application continues to function normally.

**Blank page or JavaScript errors after `docker compose up`**
The Node.js dependency installation inside the container sometimes fails on slow connections. Run `docker compose restart frontend` and refresh the browser.

**Migrations fail**
Run `docker compose exec api alembic upgrade head` manually. If it reports the database is already at the latest version, no action is needed.

---

## Project structure

```
bookshelf/
├── .env.example                  Environment variable template
├── .gitignore
├── docker-compose.yml            7-service orchestration
├── README.md                     Setup guide (this file)
├── DOCUMENTATION.md              Full technical reference
├── scripts/
│   ├── dev.sh                    First-time startup script
│   ├── sync.sh                   Copy source files into running containers
│   └── seed.py                   Load 100 books and 10 test accounts
├── nginx/
│   └── nginx.conf                Reverse proxy configuration
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/versions/         Database migration files
│   └── app/
│       ├── main.py               FastAPI entry point
│       ├── models/               SQLAlchemy ORM models
│       ├── schemas/              Pydantic request/response types
│       ├── api/v1/endpoints/     Route handlers
│       ├── core/                 Config, security, dependencies, Celery
│       ├── db/                   Async database session
│       ├── services/             Cloudflare R2 helpers
│       └── tasks.py              Celery email task
└── frontend/
    └── src/
        ├── pages/                Application pages
        ├── components/           Reusable UI components
        ├── hooks/                React Query data hooks
        ├── api/                  Axios client and typed API functions
        ├── stores/               Zustand state stores
        └── types/                TypeScript interfaces
```

---

## Running database migrations

```bash
# Apply all pending migrations
docker compose exec api alembic upgrade head

# Check the current migration state
docker compose exec api alembic current

# Generate a new migration after changing a model
docker compose exec api alembic revision --autogenerate -m "describe change"
```

---

## Environment variable reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes | — | Database password |
| `SECRET_KEY` | Yes | — | JWT signing key, minimum 32 characters |
| `R2_ACCOUNT_ID` | Yes | — | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | — | R2 API token key ID |
| `R2_SECRET_ACCESS_KEY` | Yes | — | R2 API token secret |
| `R2_BUCKET_NAME` | Yes | `bookshelf-files` | R2 bucket name |
| `R2_PUBLIC_URL` | Yes | — | Public bucket URL, no trailing slash |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID. Leave blank to disable Google Sign-In. |
| `RESEND_API_KEY` | No | — | Resend email API key. Leave blank to disable email notifications. |
| `FROM_EMAIL` | No | `noreply@example.com` | Sender address for notification emails |
| `MAX_PDF_SIZE_MB` | No | `100` | Maximum PDF upload size |
| `MAX_COVER_SIZE_MB` | No | `5` | Maximum cover image size |
| `ENVIRONMENT` | No | `development` | Set to `production` to disable SQL query logging |
