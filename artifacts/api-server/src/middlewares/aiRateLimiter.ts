import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

/**
 * Rate-limit spécifique aux endpoints IA (P2-7).
 *
 * Objectif : protéger le budget Anthropic. Une clinique qui boucle sur
 * l'endpoint `/api/ai/diagnostic` sans limite peut cramer plusieurs centaines
 * de dollars en quelques minutes.
 *
 * Clé : `clinicId` (si présent, sinon IP). Les appels sont comptés par
 * clinique pour que plusieurs utilisateurs d'une même clinique partagent le
 * quota.
 *
 * Configurable via env :
 *   AI_RATE_LIMIT_PER_MIN (défaut 30)
 */
const PER_MIN = Number(process.env["AI_RATE_LIMIT_PER_MIN"] ?? "30");

export const aiLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  limit: Number.isFinite(PER_MIN) && PER_MIN > 0 ? PER_MIN : 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Après `extractClinic`, req.clinicId est garanti si la route est auth.
    // Fallback IP pour safety.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clinicId = (req as any).clinicId as string | undefined;
    return clinicId ? `clinic:${clinicId}` : `ip:${req.ip ?? "unknown"}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: "AI_RATE_LIMIT",
        message:
          "Trop d'appels IA en peu de temps. Réessaie dans une minute. " +
          "Si c'est un besoin légitime, augmente AI_RATE_LIMIT_PER_MIN.",
      },
    });
  },
});
