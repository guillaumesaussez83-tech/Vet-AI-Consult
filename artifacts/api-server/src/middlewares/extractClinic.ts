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

      const explicitClaim =
        claims?.clinic_id ??
        claims?.public_metadata?.clinic_id ??
        claims?.org_slug ??
        null;

      // Durcissement strict : sur toute route privée on EXIGE un claim clinique.
      //  - non authentifié  → 401 (pas de fallback "default" silencieux)
      //  - authentifié sans claim → 403 clinic_not_assigned
      // Le tenant "default" est réservé aux PUBLIC_PREFIXES traités plus haut
      // et au boot seeder côté serveur.
      if (!explicitClaim) {
        if (!auth?.userId) {
          return _res.status(401).json({
            error: "unauthenticated",
            message: "Authentification requise.",
          });
        }
        logger.warn(
          { userId: auth.userId, path: req.path },
          "Authenticated user without clinic_id claim — denying access",
        );
        return _res.status(403).json({
          error: "clinic_not_assigned",
          message:
            "Votre compte n'est associé à aucune clinique. Contactez l'administrateur.",
        });
      }

      req.clinicId = explicitClaim;
    } catch (err) {
      logger.warn({ err, path: req.path }, "extractClinic: auth resolution failed");
      return _res.status(401).json({ error: "unauthenticated", message: "Authentification requise." });
    }

    next();
  };
}
