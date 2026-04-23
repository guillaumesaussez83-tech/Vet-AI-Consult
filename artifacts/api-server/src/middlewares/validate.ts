import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { fail } from "../lib/response";

/**
 * Valide req.body contre un schéma Zod.
 * Émet une réponse 400 au format enveloppe standard : fail("VALIDATION_ERROR", ...).
 */
export function validate<T>(schema: z.ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json(
        fail("VALIDATION_ERROR", "Données invalides", result.error.flatten().fieldErrors),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Valide req.query contre un schéma Zod.
 */
export function validateQuery<T>(schema: z.ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json(
        fail(
          "VALIDATION_ERROR",
          "Paramètres de requête invalides",
          result.error.flatten().fieldErrors,
        ),
      );
      return;
    }
    req.query = result.data as Record<string, string>;
    next();
  };
}
