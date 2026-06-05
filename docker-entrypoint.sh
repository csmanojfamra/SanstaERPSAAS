#!/bin/sh
set -e

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
npx wait-on "tcp:${DB_HOST}:${DB_PORT}" -t 120000

echo "Running database migrations..."
npx prisma migrate deploy --schema=backend/prisma/schema.prisma

if [ "$SEED_DATABASE" = "true" ]; then
  echo "Seeding database (SEED_DATABASE=true)..."
  node backend/prisma/seed.js
fi

echo "Starting Sansta ERP..."
exec node backend/server.js
