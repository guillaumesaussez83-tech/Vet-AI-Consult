// Métriques business légères — logs JSON structurés consommables par Railway + outils externes
// À placer sous `artifacts/api-server/src/middlewares/metricsMiddleware.ts`
// Usage dans `app.ts` (après le responseWrapper) :
//   app.use("/api", metricsMiddleware);

import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * Liste des endpoints business à tracer.
 * La clé est le pattern (regex string), la valeur est le counter symbolique.
 */
const TRACKED: Array<{ pattern: RegExp; method: string; metric: string }> = [
  { pattern: /^\/api\/consultations$/, method: "POST", metric: "req_consultation_created_total" },
  { pattern: /^\/api\/factures$/, method: "POST", metric: "req_facture_created_total" },
  { pattern: /^\/api\/storage\/uploads\/request-url$/, method: "POST", metric: "req_upload_total" },
  { pattern: /^\/api\/ai\/ordonnance/, method: "POST", metric: "req_ai_ordonnance_total" },
  { pattern: /^\/api\/ai\/dictee-ordonnance/, method: "POST", metric: "req_ai_dictee_total" },
  { pattern: /^\/api\/ai\/diagnostic/, method: "POST", metric: "req_ai_diagnostic_total" },
  { pattern: /^\/api\/portail\/generate/, method: "POST", metric: "req_portail_token_generated_total" },
  { pattern: /^\/api\/portail\/[^/]+$/, method: "GET", metric: "req_portail_view_total" },
];

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    try {
      const match = TRACKED.find(
        (t) => t.method === req.method && t.pattern.test(req.path)
      );
      if (!match) return;

      const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
      logger.info(
        {
          metric: match.metric,
          status: res.statusCode,
          duration_ms: durationMs,
          clinic_id: (req as Request & { clinicId?: string }).clinicId ?? null,
          // event_type permet de filtrer facilement dans Railway search
          event_type: "business_metric",
        },
        `metric ${match.metric} status=${res.statusCode}`
      );
    } catch (err) {
      logger.warn({ err }, "metricsMiddleware failed silently");
    }
  });

  next();
}
