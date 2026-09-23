#!/bin/sh
# Pull the latest code and run backend + web. Needs Java 21, Node 22+, pnpm 9, Docker.
set -e
cd "$(dirname "$0")"
git pull --ff-only
pnpm install --frozen-lockfile
docker compose -f infra/docker-compose.yml up -d
trap 'kill 0' EXIT   # Ctrl+C stops the backend too
pnpm dev:backend &
pnpm dev:web
