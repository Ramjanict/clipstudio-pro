#!/bin/bash
# One-Click Frontend Deployment Script for VPS
set -e

echo "🎨 Deploying Frontend Container..."

if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh && rm get-docker.sh
fi

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "📝 Created .env from .env.example. Update VITE_BACKEND_URL in .env before deploying."
    fi
fi

docker compose --env-file .env up --build -d
echo "✅ Frontend container running on port 80!"
docker compose ps
