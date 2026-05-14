import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { userPermissions } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

export type PermAction = "read" | "write" | "delete";
export type PermModule = "agenda" | "ordonnances" | "finances" | "patients" | "inventaire";

// Default role permissions (when no row in user_permissions)
const ROLE_DEFAULTS: Record<string, Record<PermAction, boolean>> = {
  ADMIN: { read: true, write: true, delete: true },
  VETERINAIRE: { read: true, write: true, delete: false },
  ASSISTANT: { read: true, write: false, delete: false },
};

// Modules restricted by default for ASSISTANT
const ASSISTANT_BLOCKED: PermModule[] = ["finances"];

export async function getUserPermission(
  userId: string,
  role: string,
  module: PermModule,
  action: PermAction
): Promise<boolean> {
  // Check DB row first
  const rows = await db
    .select()
    .from(userPermissions)
    .where(and(eq(userPermissions.userId, userId), eq(userPermissions.module, module)))
    .limit(1);

  if (rows.length > 0) {
    const row = rows[0];
    if (action === "read") return row.canRead;
    if (action === "write") return row.canWrite;
    if (action === "delete") return row.canDelete;
  }

  // Fallback to role defaults
  const roleKey = (role || "ASSISTANT").toUpperCase();
  const defaults = ROLE_DEFAULTS[roleKey] ?? ROLE_DEFAULTS.ASSISTANT;

  // Block ASSISTANT from finance by default
  if (roleKey === "ASSISTANT" && ASSISTANT_BLOCKED.includes(module)) return false;

  return defaults[action] ?? false;
}

export function checkPermission(module: PermModule, action: PermAction) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).auth?.userId;
      const role = (req as any).auth?.sessionClaims?.metadata?.role || "ASSISTANT";
      if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

      const allowed = await getUserPermission(userId, role, module, action);
      if (!allowed) { res.status(403).json({ error: "Permission denied" }); return; }

      next();
    } catch (err) {
      next(err);
    }
  };
}
