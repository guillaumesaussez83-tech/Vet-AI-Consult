import { Request, Response, NextFunction } from "express";

/**
 * Phase 0B — Centralized error handler middleware
 *
 * Replaces scattered try/catch → res.status(500).json({ error: e.message })
 * patterns with a single, consistent error response format.
 *
 * Registration (must be LAST middleware in app.ts):
 *   app.use(errorHandler);
 *
 * Usage in route handlers:
 *   router.get("/", async (req, res, next) => {
 *     try {
 *       // ...
 *     } catch (err) {
 *       next(err);   // ← delegates to errorHandler
 *     }
 *   });
 */

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isDev = process.env.NODE_ENV !== "production";

  // Structured log for Railway / observability tools
  console.error({
    level: "error",
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    statusCode,
    message: err.message,
    code: err.code,
    stack: isDev ? err.stack : undefined,
  });

  // Drizzle / PostgreSQL known error codes
  let userMessage = err.message;
  let code = err.code ?? "INTERNAL_ERROR";

  if (err.message?.includes("duplicate key")) {
    code = "DUPLICATE_ENTRY";
    userMessage = "This record already exists.";
  } else if (err.message?.includes("violates foreign key")) {
    code = "FOREIGN_KEY_VIOLATION";
    userMessage = "Referenced record does not exist.";
  } else if (err.message?.includes("null value in column")) {
    code = "MISSING_REQUIRED_FIELD";
    userMessage = "A required field is missing.";
  } else if (statusCode === 500 && !isDev) {
    // Never leak internal details to clients in production
    userMessage = "An unexpected error occurred. Please try again.";
  }

  res.status(statusCode).json({
    error: code,
    message: userMessage,
    ...(isDev && { stack: err.stack }),
  });
}

/**
 * Factory for creating typed application errors.
 *
 * throw createError(404, "Patient not found", "NOT_FOUND");
 */
export function createError(
  statusCode: number,
  message: string,
  code?: string
): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Async route wrapper — catches Promise rejections and forwards to errorHandler.
 * Avoids adding try/catch to every async route.
 *
 * Usage:
 *   router.get("/", asyncHandler(async (req, res) => {
 *     const data = await db.select()...
 *     res.json(data);
 *   }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
