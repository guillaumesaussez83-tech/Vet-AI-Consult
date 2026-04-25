#!/bin/sh
echo "[startup] === DB Setup START ==="

# Step 1: Reset public schema via dedicated .mjs script (proper pnpm module resolution)
# The node heredoc approach failed because pg couldn't be resolved without pnpm context
cd /app
echo "[startup] Resetting DB schema..."
pnpm --filter @workspace/db run db:reset || echo "[startup] db:reset failed or skipped"

# Step 2: Push schema on clean DB (no rename prompts on empty DB)
echo "[startup] Running drizzle push..."
pnpm --filter @workspace/db run push-force || { echo "[startup] push-force FAILED"; exit 1; }

echo "[startup] === Starting server ==="
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
