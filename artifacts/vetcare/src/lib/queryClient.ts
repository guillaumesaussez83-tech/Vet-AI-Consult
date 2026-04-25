import { QueryClient } from "@tanstack/react-query";

/**
 * QueryClient global.
 *
 * Politique de retry :
 *  - queries : 2 retries avec backoff exponentiel (1s, 2s, 4s max).
 *             Pas de retry sur les erreurs 4xx sauf 408/429 (timeout / rate limit).
 *  - mutations : 0 retry.
 *             Une mutation (POST/PATCH/DEhLETE) qui a "peut-être" touché le serveur
 *             ne doit JAMAIS être rejouée automatiquement — risque de double
 *             paiement, double facture, double ordonnance.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        const msg = (error as Error)?.message ?? "";
        // Pas de retry sur 4xx (erreur client), sauf 408 et 429.
        const match = msg.match(/^Erreur (\d{3})/);
        if (match) {
          const status = Number(match[1]);
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            return false;
          }
        }
        return true;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Callback 401 — branché côté App.tsx / main.tsx via React Query listener.
 * Exposé ici pour que le reste du code puisse le surcharger.
 *
 * Usage :
 *   queryClient.getQueryCache().subscribe(onCacheEvent);
 *   et côté composant racine, appeler setOn401(() => signOut() || navigate("/login"));
 */
let on401Handler: (() => void) | null = null;
export function setOn401(handler: () => void): void {
  on401Handler = handler;
}

/**
 * Extrait le message d'erreur d'une réponse backend (enveloppe `{success, error}`).
 * Tolérant si la réponse n'a pas l'enveloppe ou n'est pas du JSON.
 */
function extractBackendMessage(body: unknown, fallbackStatus: number): string {
  if (body && typeof body === "object") {
    const err = (body as { error?: unknown }).error;
    if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    if (typeof err === "string") return err;
  }
  return `Erreur ${fallbackStatus}`;
}

/**
 * Parse la réponse JSON et déballe l'enveloppe `{success, data}`.
 * Sur 401, déclenche le handler global (redirect login) avant de throw.
 */
async function readJsonOrNull(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return response.json().catch(() => null);
}

async function handleResponse<T>(response: Response): Promise<T> {
  const body = await readJsonOrNull(response);

  if (response.status === 401 && on401Handler) {
    // On notifie le handler, mais on throw quand même pour que React Query
    // passe en erreur proprement.
    try {
      on401Handler();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("on401Handler failed", err);
    }
  }

  if (!response.ok) {
    throw new Error(extractBackendMessage(body, response.status));
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
 *   - déclenche le handler 401 global en cas d'unauthenticated
 */
export async function apiJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  // Inject Clerk Bearer token on every request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let token: string | null = null;
    try {
          token = await (window as any).Clerk?.session?.getToken?.() ?? null;
    } catch {
          // Clerk unavailable — proceed without auth header
    }
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(input, { ...init, headers });
    return handleResponse<T>(response);
}

/**
 * Variante pour les sites qui ont déjà un objet `Response` en main.
 */
export async function unwrapResponse<T = unknown>(response: Response): Promise<T> {
  return handleResponse<T>(response);
}
