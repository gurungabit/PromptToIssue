#!/bin/bash

# Start DynamoDB Local and initialize the table
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🐳 Starting DynamoDB Local..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

echo "⏳ Waiting for DynamoDB to be ready..."
until curl -s http://localhost:8000 > /dev/null 2>&1; do
  sleep 1
done

echo "📦 Initializing database table..."
cd "$PROJECT_ROOT"
npx tsx lib/db/init.ts

echo "✅ Setup complete! DynamoDB is running on http://localhost:8000"
