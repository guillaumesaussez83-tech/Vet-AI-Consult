import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const meta = auth.sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
  const role = (meta?.role ?? auth.sessionClaims?.role) as string | undefined;
  if (role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "Admin role required" });
    return;
  }
  next();
}
