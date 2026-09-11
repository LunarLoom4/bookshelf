#!/bin/bash
# sync.sh -- copies all source files into running containers and restarts.
# Run after placing any updated files on Windows disk.
# Usage: bash scripts/sync.sh

set -e

echo "Syncing backend..."
docker cp backend/app/schemas/auth.py bookshelf-api-1:/app/app/schemas/auth.py
docker cp backend/app/schemas/comment.py bookshelf-api-1:/app/app/schemas/comment.py
docker cp backend/app/api/v1/endpoints/auth.py bookshelf-api-1:/app/app/api/v1/endpoints/auth.py
docker cp backend/app/api/v1/endpoints/account.py bookshelf-api-1:/app/app/api/v1/endpoints/account.py
docker cp backend/app/api/v1/endpoints/books.py bookshelf-api-1:/app/app/api/v1/endpoints/books.py
docker cp backend/app/api/v1/endpoints/comments.py bookshelf-api-1:/app/app/api/v1/endpoints/comments.py
docker cp backend/app/api/v1/router.py bookshelf-api-1:/app/app/api/v1/router.py
docker cp backend/app/services/storage.py bookshelf-api-1:/app/app/services/storage.py
docker cp backend/app/models/user.py bookshelf-api-1:/app/app/models/user.py
docker cp backend/app/core/config.py bookshelf-api-1:/app/app/core/config.py
docker cp backend/app/tasks.py bookshelf-api-1:/app/app/tasks.py

echo "Syncing frontend..."
docker cp frontend/index.html bookshelf-frontend-1:/app/index.html
docker cp frontend/src/index.css bookshelf-frontend-1:/app/src/index.css
docker cp frontend/src/main.tsx bookshelf-frontend-1:/app/src/main.tsx
docker cp frontend/src/App.tsx bookshelf-frontend-1:/app/src/App.tsx
docker cp frontend/src/types/index.ts bookshelf-frontend-1:/app/src/types/index.ts
docker cp frontend/src/api/index.ts bookshelf-frontend-1:/app/src/api/index.ts
docker cp frontend/src/stores/authStore.ts bookshelf-frontend-1:/app/src/stores/authStore.ts
docker cp frontend/src/hooks/useBooks.ts bookshelf-frontend-1:/app/src/hooks/useBooks.ts
docker cp frontend/src/hooks/usePostLoginToast.ts bookshelf-frontend-1:/app/src/hooks/usePostLoginToast.ts 2>/dev/null || true
docker cp frontend/src/components/layout/Navbar.tsx bookshelf-frontend-1:/app/src/components/layout/Navbar.tsx
docker cp frontend/src/components/ui/Avatar.tsx bookshelf-frontend-1:/app/src/components/ui/Avatar.tsx
docker cp frontend/src/components/ui/GoogleSignInButton.tsx bookshelf-frontend-1:/app/src/components/ui/GoogleSignInButton.tsx
docker cp frontend/src/components/ui/PasswordStrength.tsx bookshelf-frontend-1:/app/src/components/ui/PasswordStrength.tsx 2>/dev/null || true
docker cp frontend/src/components/ui/AddToListPanel.tsx bookshelf-frontend-1:/app/src/components/ui/AddToListPanel.tsx
docker cp frontend/src/components/reader/PDFViewer.tsx bookshelf-frontend-1:/app/src/components/reader/PDFViewer.tsx
docker cp frontend/src/components/reader/CommentBox.tsx bookshelf-frontend-1:/app/src/components/reader/CommentBox.tsx
docker cp frontend/src/components/reader/CommentThread.tsx bookshelf-frontend-1:/app/src/components/reader/CommentThread.tsx
docker cp frontend/src/components/reader/BookmarkPanel.tsx bookshelf-frontend-1:/app/src/components/reader/BookmarkPanel.tsx
docker cp frontend/src/pages/Landing.tsx bookshelf-frontend-1:/app/src/pages/Landing.tsx
docker cp frontend/src/pages/Browse.tsx bookshelf-frontend-1:/app/src/pages/Browse.tsx
docker cp frontend/src/pages/Upload.tsx bookshelf-frontend-1:/app/src/pages/Upload.tsx
docker cp frontend/src/pages/BookDetail.tsx bookshelf-frontend-1:/app/src/pages/BookDetail.tsx
docker cp frontend/src/pages/ReadingPage.tsx bookshelf-frontend-1:/app/src/pages/ReadingPage.tsx
docker cp frontend/src/pages/Login.tsx bookshelf-frontend-1:/app/src/pages/Login.tsx
docker cp frontend/src/pages/Register.tsx bookshelf-frontend-1:/app/src/pages/Register.tsx
docker cp frontend/src/pages/Settings.tsx bookshelf-frontend-1:/app/src/pages/Settings.tsx
docker cp frontend/src/pages/UserProfile.tsx bookshelf-frontend-1:/app/src/pages/UserProfile.tsx

echo "Restarting services..."
docker compose restart api frontend

echo ""
echo "Done. Wait 15 seconds then press Ctrl+Shift+R in browser."
