import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // max connections (default: 10)
  idleTimeoutMillis: 30_000,  // close idle connections after 30s
  connectionTimeoutMillis: 10_000, // timeout waiting for connection: 10s
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});
export const db = drizzle(pool, { schema });

export * from "./schema";

// Transient error codes that warrant a retry
const RETRYABLE_CODES = new Set([
  "ECONNRESET",
    "ETIMEDOUT",
      "ECONNREFUSED",
        "57P01", // admin_shutdown
          "57P02", // crash_shutdown
            "57P03", // cannot_connect_now
              "08006", // connection_failure
                "08001", // sqlclient_unable_to_establish_sqlconnection
                  "08004", // sqlserver_rejected_establishment_of_sqlconnection
                    "40001", // serialization_failure (deadlock)
                      "40P01", // deadlock_detected
                      ]);

                      function isRetryable(err: unknown): boolean {
                        if (!err || typeof err !== "object") return false;
                          const e = err as Record<string, unknown>;
                            if (e.code && RETRYABLE_CODES.has(e.code as string)) return true;
                              if (typeof e.message === "string") {
                                  const msg = e.message.toLowerCase();
                                      if (msg.includes("connection terminated") || msg.includes("timeout")) return true;
                                        }
                                          return false;
                                          }

                                          /**
                                           * Execute a database operation with automatic retry on transient errors.
                                            * Uses exponential backoff: 200ms, 400ms, 800ms (3 attempts total).
                                             */
                                             export async function withRetry<T>(
                                               fn: () => Promise<T>,
                                                 attempts = 3,
                                                   delayMs = 200
                                                   ): Promise<T> {
                                                     for (let i = 0; i < attempts; i++) {
                                                         try {
                                                               return await fn();
                                                                   } catch (err) {
                                                                         const last = i === attempts - 1;
                                                                               if (last || !isRetryable(err)) throw err;
                                                                                     await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
                                                                                         }
                                                                                           }
                                                                                             // TypeScript: unreachable but required
                                                                                               throw new Error("withRetry: exhausted all attempts");
                                                                                               }
