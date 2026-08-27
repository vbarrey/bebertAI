#!/bin/sh
set -e

mkdir -p /app/data

echo "Applying Prisma migrations..."
bunx prisma migrate deploy

echo "Starting Bebert AI..."
exec bun start