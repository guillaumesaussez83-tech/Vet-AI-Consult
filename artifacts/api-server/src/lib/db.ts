// @ts-nocheck
// Compatibility shim: re-export @workspace/db for routes using "../../lib/db"
// Some routes use this path instead of importing @workspace/db directly
export { db, pool, withRetry } from "@workspace/db";
export * from "@workspace/db";
