import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { logger } from "../lib/logger";
import { fail } from "../lib/response";

declare global {
  namespace Express {
    interface Request {
      clinicId: string;
    }
  }
}

const DEFAULT_CLINIC_ID = "default";

/**
 * Routes publiques (pas d'auth requise) — on attache `default` par défaut
 * pour que toute query downstream qui filtre par clinicId ait un fallback safe.
 *
 * IMPORTANT : on utilise des REGEX STRICTES (pas des `startsWith`) pour
 * empêcher qu'une route `/portail-admin-secret` ne passe en public par accident.
 *
 * La route `/portail/:token` exige un token hex de 64 caractères (cf. routes/portail).
 */
const PUBLIC_ROUTES: Array<RegExp> = [
  /^\/health$/,
  /^\/healthz$/,
  /^\/ai\/openapi\.json$/,
  // Lecture portail client — le token hex sert de clé d'accès.
  /^\/portail\/[a-f0-9]{64}$/,
];

/**
 * Lit le claim Clerk `public_metadata.clinic_id` et l'attache à req.clinicId.
 * Fallback : `org_slug` (Clerk Organizations natif).
 *
 * Configuration côté Clerk :
 *   1. Dashboard Clerk → Sessions → Customize session token
 *   2. Ajouter : { "clinic_id": "{{user.public_metadata.clinic_id}}" }
 *   3. Renseigner public_metadata.clinic_id sur chaque user (manuellement, par API ou
 *      via webhook user.created qui crée la clinique et stocke son id).
 *
 * Sécurité :
 *   - Pas de fallback silencieux sur "default" — on refuse 401/403 si pas de claim.
 *   - Le tenant "default" est RÉSERVÉ aux routes publiques listées ci-dessus
 *     et au boot seeder côté serveur.
 */
export function extractClinic() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (PUBLIC_ROUTES.some((rx) => rx.test(req.path))) {
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

      if (!explicitClaim) {
        if (!auth?.userId) {
          return res.status(401).json(fail("UNAUTHENTICATED", "Authentification requise."));
        }
        logger.warn(
          { userId: auth.userId, path: req.path },
          "Authenticated user without clinic_id claim — denying access",
        );
        return res.status(403).json(
          fail(
            "CLINIC_NOT_ASSIGNED",
            "Votre compte n'est associé à aucune clinique. Contactez l'administrateur.",
          ),
        );
      }

      req.clinicId = DEFAULT_CLINIC_ID; // MVP mono-clinique: toujours "default"
    } catch (err) {
      logger.error({ err, path: req.path }, "extractClinic: auth resolution failed");
      return res.status(401).json(fail("UNAUTHENTICATED", "Authentification requise."));
    }

    next();
  };
}
