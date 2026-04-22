import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      clinicId: string;
    }
  }
}

const DEFAULT_CLINIC_ID = "default";

/**
 * Routes publiques (pas d'auth requise) — on attache `default` quand même
 * pour que toute query downstream qui filtre par clinicId fonctionne.
 */
const PUBLIC_PREFIXES = ["/health", "/healthz", "/portail", "/ai/openapi.json"];

/**
 * Lit le claim Clerk `public_metadata.clinic_id` et l'attache à req.clinicId.
 * Fallback : `org_slug` (Clerk Organizations natif), puis `"default"` (rétrocompat).
 *
 * Comment configurer le claim côté Clerk :
 *   1. Dashboard Clerk → Sessions → Customize session token
 *   2. Ajouter : { "clinic_id": "{{user.public_metadata.clinic_id}}" }
 *   3. Renseigner public_metadata.clinic_id sur chaque user (manuellement, par API ou
 *      via webhook user.created qui crée la clinique et stocke son id).
 */
export function extractClinic() {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Routes publiques : on attache default sans tenter d'auth
    if (PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) {
      req.clinicId = DEFAULT_CLINIC_ID;
      return next();
    }

    try {
      const auth = getAuth(req);
      const claims = auth?.sessionClaims as
        | { clinic_id?: string; public_metadata?: { clinic_id?: string }; org_slug?: string }
        | undefined;

      const clinicId =
        claims?.clinic_id ??
        claims?.public_metadata?.clinic_id ??
        claims?.org_slug ??
        DEFAULT_CLINIC_ID;

      req.clinicId = clinicId;

      if (clinicId === DEFAULT_CLINIC_ID && auth?.userId) {
        // User authentifié mais sans claim de clinique → log warn (config Clerk à faire)
        logger.debug({ userId: auth.userId, path: req.path }, "Clinic claim missing, using default");
      }
    } catch {
      req.clinicId = DEFAULT_CLINIC_ID;
    }

    next();
  };
}
