import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

/**
 * F-P2-8 : Sentry init + breadcrumbs réseau + release + tracing.
 * Le DSN reste optionnel pour le dev, mais si présent on configure :
 * - environment (prod/staging/preview/dev)
 * - release (injecté par le CI, fallback au commit sha si dispo, sinon "dev")
 * - tracesSampleRate 10% pour ne pas exploser la facture
 * - beforeSend pour filtrer les erreurs "Non-Error exception captured"
 *   (bruit React Query fréquent)
 *
 * Les appels setUser({id, email}) sont faits depuis App.tsx une fois Clerk loadé.
 */
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE ?? "dev",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0, // pas de replay par défaut (coûteux)
    replaysOnErrorSampleRate: 0.1,
    // Évite d'envoyer des erreurs non-Error (React Query wrap souvent ses
    // rejections dans des objets non-standard) — on les attrape uniquement
    // si leur toString contient quelque chose d'utile.
    beforeSend(event, hint) {
      const err = hint?.originalException;
      if (err && typeof err === "object" && !(err instanceof Error) && !("message" in err)) {
        return null;
      }
      return event;
    },
  });
}

/**
 * Intercepteur fetch global — injecte automatiquement le Bearer token Clerk
 * sur tous les appels /api/* (sauf /__clerk/ qui est le proxy Clerk lui-même).
 *
 * Couvre automatiquement les 16+ fichiers du codebase qui utilisent fetch()
 * directement, sans avoir à modifier chaque composant individuellement.
 * Compatible avec customFetch (Orval) et apiJson (queryClient) qui injectent
 * déjà leur propre token : la vérification headers.has("authorization") évite
 * toute double-injection.
 */
const _nativeFetch = window.fetch.bind(window);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).fetch = async function clerkFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  const isApiCall =
    (url.startsWith("/api/") || /https?:\/\/[^/]+\/api\//.test(url)) &&
    !url.includes("/api/__clerk/");

  if (isApiCall) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const token: string | null = await (window as any).Clerk?.session?.getToken?.() ?? null;
      if (token) {
        const headers = new Headers(init?.headers);
        if (!headers.has("authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        return _nativeFetch(input, { ...init, headers });
      }
    } catch {
      // Clerk non disponible — continuer sans token
    }
  }

  return _nativeFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
