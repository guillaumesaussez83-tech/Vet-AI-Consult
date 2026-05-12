import { logger } from "../lib/logger";
import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { auditLogs } from "../../../../lib/db/src/schema/audit-logs";

/**
 * Phase 0D — Audit Logger middleware
 *
 * Automatically logs all mutating HTTP requests (POST, PUT, PATCH, DELETE)
 * to the audit_logs table.
 *
 * Registration in app.ts (before routes):
 *   app.use(auditLogger);
 *
 * The middleware is non-blocking: audit failures are logged to console
 * but never cause the request to fail.
 */

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "VIEW";

interface AuditEntry {
  clinicId: string;
  userId: string;
  userEmail?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  resourceLabel?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// Derive action from HTTP method
function methodToAction(method: string): AuditAction | null {
  switch (method.toUpperCase()) {
    case "POST":   return "CREATE";
    case "PUT":
    case "PATCH":  return "UPDATE";
    case "DELETE": return "DELETE";
    default:       return null; // GET requests are not audited by default
  }
}

// Derive resource type from URL path
// e.g. /api/patients/42 → "patient"
function pathToResourceType(path: string): string {
  const segments = path.replace(/^\/api\//, "").split("/");
  const resource = segments[0] ?? "unknown";
  // Normalize plurals
  return resource.replace(/s$/, "").replace(/-/g, "_");
}

// Extract resource ID from URL path (last numeric segment)
function pathToResourceId(path: string): string | undefined {
  const match = path.match(/\/(\d+)(\/|$)/);
  return match?.[1];
}

/**
 * Auto-audit middleware: records every mutation automatically.
 */
export function auditLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const action = methodToAction(req.method);

  if (!action) {
    return next(); // Don't audit GET/HEAD/OPTIONS
  }

  // Intercept response to capture status code
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    // Fire-and-forget: don't block response
    writeAuditLog(req, action, body).catch((err) => {
      logger.error({ err: err.message }, "[audit] Failed to write log:");
    });
    return originalJson(body);
  };

  next();
}

async function writeAuditLog(
  req: Request,
  action: AuditAction,
  _responseBody: unknown
): Promise<void> {
  const auth = getAuth(req);
  if (!auth?.userId) return; // Unauthenticated — nothing to log

  const clinicId =
    (auth.sessionClaims?.clinicId as string) ??
    (auth.sessionClaims?.publicMetadata as any)?.clinicId;

  if (!clinicId) return;

  const resourceType = pathToResourceType(req.path);
  const resourceId = pathToResourceId(req.path) ?? req.body?.id?.toString();

  await db.insert(auditLogs).values({
    clinicId,
    userId: auth.userId,
    action,
    resourceType,
    resourceId,
    metadata: {
      method: req.method,
      path: req.path,
      bodyKeys: req.body ? Object.keys(req.body) : [],
    },
    ipAddress:
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ??
      req.socket.remoteAddress,
    userAgent: req.headers["user-agent"],
  });
}

/**
 * Manual audit helper: use for complex operations that need
 * explicit audit entries (e.g., bulk imports, IA validations).
 *
 * await logAuditEvent(req, { action: "UPDATE", resourceType: "consultation",
 *   resourceId: "42", resourceLabel: "Consultation Felix 2024-01-01" });
 */
export async function logAuditEvent(
  req: Request,
  entry: Omit<AuditEntry, "clinicId" | "userId">
): Promise<void> {
  const auth = getAuth(req);
  if (!auth?.userId) return;

  const clinicId =
    (auth.sessionClaims?.clinicId as string) ??
    (auth.sessionClaims?.publicMetadata as any)?.clinicId;

  if (!clinicId) return;

  await db.insert(auditLogs).values({
    clinicId,
    userId: auth.userId,
    ...entry,
    ipAddress:
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ??
      req.socket.remoteAddress,
    userAgent: req.headers["user-agent"],
  });
}
