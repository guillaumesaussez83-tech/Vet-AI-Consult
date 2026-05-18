// @ts-nocheck
import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

/**
 * extractClinic — factory middleware that extracts clinicId from Clerk session
 * and attaches it to req.clinicId.
 *
 * Usage: router.get("/", extractClinic(), handler)
 *
 * Mirrors requireClinicId but exposed as a factory for router-level use.
 * Supports all Clerk JWT claim shapes (camelCase + snake_case).
 */
export function extractClinic() {
  return function (req: Request, res: Response, next: NextFunction): void {
    const auth = getAuth(req);

    if (!auth?.userId) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Authentication required",
      });
      return;
    }

    const claims = auth.sessionClaims as Record<string, any> | null | undefined;
    const clinicId: string | undefined =
      (claims?.clinicId as string | undefined) ||
      (claims?.["public_metadata"]?.clinicId as string | undefined) ||
      (claims?.publicMetadata?.clinicId as string | undefined) ||
      (claims?.["public_metadata"]?.clinic_id as string | undefined);

    if (typeof clinicId !== "string" || clinicId.trim() === "") {
      res.status(403).json({
        error: "FORBIDDEN",
        message: "No clinic associated with this account. Contact your administrator.",
      });
      return;
    }

    (req as any).clinicId = clinicId;
    next();
  };
}
