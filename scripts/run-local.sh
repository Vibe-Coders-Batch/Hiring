#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop, then re-run: pnpm local"
  exit 1
fi

echo "Starting Postgres…"
docker compose up -d postgres

echo "Waiting for Postgres to accept connections…"
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U postgres -d vaivammhire >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Minimal env for Drizzle, seed script, and Next (matches lib/env.ts requirements).
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/vaivammhire}"
export AWS_REGION="${AWS_REGION:-ap-south-1}"
export S3_RESUMES_BUCKET="${S3_RESUMES_BUCKET:-local-dev}"
export S3_OFFERS_BUCKET="${S3_OFFERS_BUCKET:-local-dev}"
export S3_TRAINING_BUCKET="${S3_TRAINING_BUCKET:-local-dev}"
export SES_FROM_ADDRESS="${SES_FROM_ADDRESS:-local@example.com}"
export SES_REPLY_TO="${SES_REPLY_TO:-local@example.com}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
export NEXT_PUBLIC_BRAND_NAME="${NEXT_PUBLIC_BRAND_NAME:-VaivammHire}"
export AUTH_DEV_SECRET="${AUTH_DEV_SECRET:-VaivammAdminDev2026!}"
export ML_API_FEATURE_FLAGS="${ML_API_FEATURE_FLAGS:-m1=off,m2=off,m3=off,m4=off,m5=off}"

cd "${ROOT}/vaivammhire-app"

echo "Running Drizzle migrations…"
pnpm exec drizzle-kit migrate

echo "Seeding dev data…"
pnpm exec tsx scripts/seed-dev.ts

echo "Starting Next.js at http://localhost:3000"
exec pnpm dev
