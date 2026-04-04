#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/backend
bunx prisma migrate deploy
echo "Migrations complete."

cd /app
echo "Starting Harmony backend..."
exec bun --hot run backend/src/index.ts
