import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { fail } from "../lib/response";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public override readonly message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} introuvable`, "NOT_FOUND");
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Non autorisé") {
    super(401, message, "UNAUTHORIZED");
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Accès interdit") {
    super(403, message, "FORBIDDEN");
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, "VALIDATION_ERROR", details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, "CONFLICT");
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

interface PostgresError extends Error {
  code: string;
  constraint?: string;
}

function isPostgresError(err: unknown): err is PostgresError {
  return err instanceof Error && "code" in err;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json(fail(err.code ?? "ERROR", err.message, err.details));
    return;
  }

  if (isPostgresError(err) && err.code === "23505") {
    res
      .status(409)
      .json(fail("DUPLICATE_ERROR", "Cette ressource existe déjà"));
    return;
  }

  if (isPostgresError(err) && err.code === "23503") {
    res
      .status(400)
      .json(fail("FOREIGN_KEY_ERROR", "Référence invalide — ressource liée introuvable"));
    return;
  }

  logger.error({ err }, "Erreur serveur non gérée");

  const isDev = process.env["NODE_ENV"] !== "production";
  res
    .status(500)
    .json(
      fail(
        "INTERNAL_ERROR",
        isDev ? err.message : "Erreur serveur interne",
        isDev ? { stack: err.stack } : undefined,
      ),
    );
}
