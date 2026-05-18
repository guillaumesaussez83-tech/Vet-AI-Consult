// Re-export database client and schema from @workspace/db
// All api-server routes reference this as "../db" or "../../db"
export { db, pool, withRetry } from "@workspace/db";
export * from "@workspace/db";
