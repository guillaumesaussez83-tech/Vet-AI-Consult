import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

/**
 * Helper de fetch + parsing JSON unifié.
 *
 * Le backend renvoie toutes ses réponses sous la forme :
 *   succès : { success: true, data, ...meta }
 *   erreur : { success: false, error: { code, message, details? } }
 *
 * Cette fonction :
 *   - lance une erreur en cas de status >= 400 (avec le message backend)
 *   - déballe automatiquement l'enveloppe pour retourner directement `data`
 *   - reste tolérante : si la réponse n'a pas l'enveloppe, elle est renvoyée telle quelle
 */
export async function apiJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body: unknown = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "error" in body
        ? typeof (body as { error: unknown }).error === "object" &&
          (body as { error: { message?: string } }).error?.message
          ? (body as { error: { message: string } }).error.message
          : typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : null
        : null) ?? `Erreur ${response.status}`;
    throw new Error(message);
  }

  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).success === true &&
    "data" in (body as Record<string, unknown>)
  ) {
    return (body as { data: T }).data;
  }

  return body as T;
}

/**
 * Variante pour les sites qui ont déjà un objet `Response` en main
 * (ex : pattern `const r = await fetch(...); const data = await r.json();`).
 * Lève en cas d'erreur HTTP, déballe l'enveloppe `{success, data}` sinon.
 */
export async function unwrapResponse<T = unknown>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body: unknown = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "error" in body
        ? typeof (body as { error: unknown }).error === "object" &&
          (body as { error: { message?: string } }).error?.message
          ? (body as { error: { message: string } }).error.message
          : typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : null
        : null) ?? `Erreur ${response.status}`;
    throw new Error(message);
  }

  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).success === true &&
    "data" in (body as Record<string, unknown>)
  ) {
    return (body as { data: T }).data;
  }

  return body as T;
}
