#!/bin/sh
set -e

mkdir -p /app/data

echo "Applying Prisma migrations..."
npx prisma migrate deploy

echo "Starting Bebert AI..."
exec npm start