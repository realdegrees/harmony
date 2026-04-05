#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/backend
DATABASE_URL="${DATABASE_URL:-file:/data/harmony.db}" bun x prisma migrate deploy
echo "Migrations complete."

cd /app
echo "Starting Harmony..."
exec bun run backend/src/index.ts
