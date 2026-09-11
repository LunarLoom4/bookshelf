#!/bin/bash
set -e

echo "── Bookshelf dev startup ──"

# Copy env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example -- fill in your R2 credentials before uploading files"
fi

# Start database and Redis
docker compose up -d db redis
echo "Waiting for PostgreSQL..."

# Wait using Python (available in the api container) instead of pg_isready
# which requires the postgresql-client package not present in python:3.11-slim
docker compose run --rm api sh -c "
  until python3 -c \"
import socket, sys, time
for i in range(60):
    try:
        s = socket.create_connection(('db', 5432), timeout=1)
        s.close()
        sys.exit(0)
    except OSError:
        time.sleep(1)
sys.exit(1)
\" ; do sleep 1; done
echo 'PostgreSQL is up'
"

# Run migrations
echo "Running migrations..."
docker compose run --rm api alembic upgrade head

# Start everything
docker compose up -d
echo ""
echo "Services running:"
echo "  Frontend: http://localhost:5173"
echo "  API:      http://localhost:8000"
echo "  Docs:     http://localhost:8000/docs"
echo "  Nginx:    http://localhost:80"
