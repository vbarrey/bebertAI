#!/bin/sh
set -e

mkdir -p /app/data/database

echo "Applying Prisma migrations..."
npx prisma migrate deploy

echo "Starting Bebert AI..."
exec npm start
