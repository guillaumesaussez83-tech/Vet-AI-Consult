import rateLimit from "express-rate-limit";

/**
 * Rate limiter pour les routes IA (OpenAI calls coûteux).
 * Limite par clinic_id (via req.clinicId injecté par requireClinicId).
 * - 20 requêtes / 60 secondes par clinique
 * - Headers standard RateLimit-*
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // Clé par clinique pour isolation multi-tenant
    return req.clinicId ?? req.ip ?? "unknown";
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: "Trop de requêtes IA. Limite: 20 par minute par clinique.",
      retryAfter: 60,
    });
  },
  skip: (req: any) => {
    // Pas de limite en dev local
    return process.env.NODE_ENV === "development" && !req.headers["x-enforce-rate-limit"];
  },
});

/**
 * Rate limiter plus strict pour la génération de PDF (ressource intensive).
 * 10 requêtes / 60 secondes par clinique
 */
export const pdfRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.clinicId ?? req.ip ?? "unknown",
  handler: (_req, res) => {
    res.status(429).json({
      error: "Trop de requêtes PDF. Limite: 10 par minute par clinique.",
      retryAfter: 60,
    });
  },
});
