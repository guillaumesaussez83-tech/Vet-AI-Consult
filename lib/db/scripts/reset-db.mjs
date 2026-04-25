// reset-db.mjs — resets the public schema so drizzle-kit push runs on a clean DB
// Called by startup.sh via: pnpm --filter @workspace/db run db:reset
import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.log('[startup] No DATABASE_URL — skipping DB reset');
    process.exit(0);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
      await pool.query('DROP SCHEMA public CASCADE');
        await pool.query('CREATE SCHEMA public');
          await pool.query('GRANT ALL ON SCHEMA public TO PUBLIC');
            await pool.query('GRANT ALL ON SCHEMA public TO postgres');
              console.log('[startup] DB schema reset OK');
              } catch (e) {
                console.error('[startup] DB reset error:', e.message);
                  process.exit(1);
                  } finally {
                    await pool.end();
                    }
