import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

/**
 * Phase 0A — Multi-tenant enforcement middleware
 *
 * Extracts clinicId from Clerk session claims and attaches it to req.
 * Returns 401 if unauthenticated, 403 if no clinicId found.
 *
 * Usage:
 *   router.get("/", requireAuth(), requireClinicId, async (req, res) => {
 *     const { clinicId } = req;  // guaranteed non-null here
 *   });
 *
 * OR apply globally in app.ts:
 *   app.use("/api", requireAuth(), requireClinicId, router);
 */
export function requireClinicId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const auth = getAuth(req);

  if (!auth?.userId) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Authentication required",
    });
    return;
  }

  const clinicId =
    (auth.sessionClaims?.clinicId as string) ??
    (auth.sessionClaims?.publicMetadata as any)?.clinicId;

  if (typeof clinicId !== "string" || clinicId.trim() === "") {
    res.status(403).json({
      error: "FORBIDDEN",
      message:
        "No clinic associated with this account. Contact your administrator.",
    });
    return;
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
