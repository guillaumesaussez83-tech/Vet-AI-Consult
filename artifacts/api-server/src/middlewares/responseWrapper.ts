import type { Request, Response, NextFunction } from "express";
import { isApiEnvelope } from "../lib/response";

/**
 * Encapsule automatiquement chaque appel `res.json(...)` dans le format unifié :
 *   - Succès (status < 400)        → { success: true, data, ...meta }
 *     - listes : ajoute total/page/pages
 *   - Erreur (status >= 400)       → { success: false, error: { code, message, details? } }
 *
 * Si le corps est déjà au format enveloppe (success: bool), il est laissé tel quel.
 * Permet aux routes existantes de continuer à appeler `res.json(data)` sans modification.
 */
export function responseWrapper(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = function wrappedJson(body: unknown): Response {
    // Déjà au format enveloppe : ne pas re-wrapper.
    if (isApiEnvelope(body)) {
      return originalJson(body);
    }

    const status = res.statusCode || 200;

    if (status >= 400) {
      let code = "ERROR";
      let message = "Une erreur est survenue";
      let details: unknown;

      if (typeof body === "string") {
        message = body;
      } else if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        if (typeof b["error"] === "string") message = b["error"];
        else if (typeof b["message"] === "string") message = b["message"];
        if (typeof b["code"] === "string") code = b["code"];
        if (b["details"] !== undefined) details = b["details"];
      }

      // Codes par défaut basés sur le statut HTTP
      if (code === "ERROR") {
        if (status === 400) code = "VALIDATION_ERROR";
        else if (status === 401) code = "UNAUTHORIZED";
        else if (status === 403) code = "FORBIDDEN";
        else if (status === 404) code = "NOT_FOUND";
        else if (status === 409) code = "CONFLICT";
        else if (status === 422) code = "VALIDATION_ERROR";
        else if (status === 429) code = "RATE_LIMIT";
        else if (status >= 500) code = "INTERNAL_ERROR";
      }

      return originalJson({
        success: false,
        error: details !== undefined ? { code, message, details } : { code, message },
      });
    }

    // Succès
    if (Array.isArray(body)) {
      return originalJson({
        success: true,
        data: body,
        total: body.length,
        page: 1,
        pages: 1,
      });
    }

    return originalJson({ success: true, data: body });
  } as Response["json"];

  next();
}
