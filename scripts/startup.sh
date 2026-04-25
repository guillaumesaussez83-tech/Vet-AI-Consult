#!/bin/sh
set -e
echo "=== Running drizzle-kit push ==="
yes "" | pnpm --filter @workspace/db run push-force || echo "push-force exited (continuing)"
echo "=== Starting server ==="
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
