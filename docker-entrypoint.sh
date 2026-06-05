#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy --schema=backend/prisma/schema.prisma

echo "Starting Sansta ERP..."
exec node backend/server.js
