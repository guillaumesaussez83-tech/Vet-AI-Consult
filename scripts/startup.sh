#!/bin/sh
echo "[startup] === DB Setup START ==="

# Step 1: Reset public schema to avoid stale tables/column conflicts
cd /app/lib/db
node --input-type=module <<'RESET_EOF'
import pg from 'pg';
const { Pool } = pg;
if (!process.env.DATABASE_URL) { console.log('[startup] No DATABASE_URL, skipping reset'); process.exit(0); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query('DROP SCHEMA public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await pool.query('GRANT ALL ON SCHEMA public TO PUBLIC');
  console.log('[startup] DB schema reset OK');
} catch(e) {
  console.error('[startup] DB reset error:', e.message);
} finally { await pool.end(); }
RESET_EOF

# Step 2: Push schema on clean DB (no rename prompts on empty DB)
cd /app
pnpm --filter @workspace/db run push-force || echo "[startup] push-force failed"

echo "[startup] === Starting server ==="
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
