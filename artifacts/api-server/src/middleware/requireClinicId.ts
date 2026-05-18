import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

/**
 * Phase 0A — Multi-tenant enforcement middleware
 *
 * Extracts clinicId from Clerk session claims and attaches it to req.
 * Returns 401 if unauthenticated, 403 if no clinicId found.
 *
 * Clerk JWT claim lookup order:
 *  1. sessionClaims.clinicId            — custom JWT template (top-level claim)
 *  2. sessionClaims.public_metadata.clinicId  — Clerk standard (snake_case)
 *  3. sessionClaims.publicMetadata.clinicId   — legacy camelCase (Replit proxy)
 *  4. sessionClaims.public_metadata.clinic_id — snake_case variant
 *
 * To set clinicId for a user:
 *   Clerk Dashboard → Users → select user → Public metadata → { "clinicId": "default" }
 */
export function requireClinicId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const auth = getAuth(req);

  if (!auth?.userId) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  // Support multiple Clerk JWT claim shapes (camelCase + snake_case)
  const claims = auth.sessionClaims as Record<string, any> | null | undefined;
  const clinicId: string | undefined =
    (claims?.clinicId as string | undefined) ||
    (claims?.["public_metadata"]?.clinicId as string | undefined) ||
    (claims?.publicMetadata?.clinicId as string | undefined) ||
    (claims?.["public_metadata"]?.clinic_id as string | undefined) ||
    undefined;

  if (typeof clinicId !== "string" || clinicId.trim() === "") {
    return res.status(403).json({
      error: "FORBIDDEN",
      message:
        "No clinic associated with this account. Contact your administrator.",
    });
  }

  // Attach to request for use in route handlers
  (req as any).clinicId = clinicId;
  next();
}

/**
 * Helper to extract clinicId with type safety in route handlers.
 * Use only after requireClinicId middleware has run.
 */
export function getClinicId(req: Request): string {
  const clinicId = (req as any).clinicId;
  if (typeof clinicId !== "string" || clinicId.trim() === "") {
    throw new Error(
      "getClinicId called before requireClinicId middleware. " +
        "Ensure requireClinicId is applied to this route."
    );
  }
  return clinicId;
}


export default requireClinicId;
