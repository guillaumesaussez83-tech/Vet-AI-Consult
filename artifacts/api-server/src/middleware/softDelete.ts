import { Request, Response, NextFunction } from "express";
import { SQL, sql, isNull, lt } from "drizzle-orm";

/**
 * Phase 0C — Soft Delete helpers
 *
 * Usage in route handlers:
 *
 *   // List (exclude deleted)
 *   import { notDeleted } from "../middleware/softDelete";
 *   const patients = await db.select().from(patientsTable)
 *     .where(and(cidEq, notDeleted(patientsTable)));
 *
 *   // Soft-delete a record
 *   import { softDeleteById } from "../middleware/softDelete";
 *   await softDeleteById(db, patientsTable, id);
 *
 *   // Hard delete is forbidden on these tables — use softDelete only
 */

import { PgTable } from "drizzle-orm/pg-core";

// Returns Drizzle SQL condition: deleted_at IS NULL
export function notDeleted(table: any): SQL {
  return isNull(table.deletedAt);
}

// Performs soft delete: UPDATE SET deleted_at = NOW() WHERE id = ?
export async function softDeleteById(
  db: any,
  table: any,
  id: number | string
): Promise<void> {
  await db
    .update(table)
    .set({ deletedAt: new Date() })
    .where(sql`${table.id} = ${id}`);
}

/**
 * Express middleware: adds softDelete helper to res.locals
 * so route handlers can use it without importing.
 */
export function softDeleteMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  res.locals.notDeleted = notDeleted;
  res.locals.softDeleteById = softDeleteById;
  next();
}
