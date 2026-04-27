#!/bin/sh
echo "[startup] === DB Setup START ==="

cd /app

# Apply schema migrations (safe — never drops data)
echo "[startup] Running drizzle push..."
pnpm --filter @workspace/db run push-force || { echo "[startup] push-force FAILED"; exit 1; }

echo "[startup] === Starting server ==="
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
