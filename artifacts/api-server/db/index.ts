// @ts-nocheck
// Compatibility shim: re-export @workspace/db for routes using "../../../db"
// Some routes (communications, comptabilite, fournisseurs) use this path
export { db, pool, withRetry } from "@workspace/db";
export * from "@workspace/db";
