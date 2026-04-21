/**
 * Helpers de format de réponse API unifié.
 *
 * Format succès : { success: true, data, ...meta }
 * Format erreur : { success: false, error: { code, message, details? } }
 *
 * Note: la plupart des routes n'appellent PAS ces helpers directement.
 * Le middleware `responseWrapper` (cf. middlewares/responseWrapper.ts)
 * encapsule automatiquement toute réponse `res.json(...)` non encore wrappée.
 */

export type ApiSuccess<T = unknown> = {
  success: true;
  data: T;
  total?: number;
  page?: number;
  pages?: number;
  [key: string]: unknown;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiSuccess<T> {
  return { success: true, data, ...(meta ?? {}) };
}

export function fail(code: string, message: string, details?: unknown): ApiError {
  return {
    success: false,
    error: details !== undefined ? { code, message, details } : { code, message },
  };
}

export function isApiEnvelope(value: unknown): value is ApiSuccess | ApiError {
  return (
    !!value &&
    typeof value === "object" &&
    "success" in value &&
    typeof (value as { success: unknown }).success === "boolean"
  );
}
