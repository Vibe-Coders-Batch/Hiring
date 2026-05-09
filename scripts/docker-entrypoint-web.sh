#!/bin/sh
set -e
cd /repo/vaivammhire-app
pnpm exec drizzle-kit migrate
pnpm exec tsx scripts/seed-dev.ts || true
exec pnpm exec next start -H 0.0.0.0 -p 3000
