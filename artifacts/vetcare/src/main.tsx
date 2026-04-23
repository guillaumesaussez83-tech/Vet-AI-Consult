import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

/**
 * F-P2-8 : Sentry init + breadcrumbs réseau + release + tracing.
 * Le DSN reste optionnel pour le dev, mais si présent on configure :
 *  - environment (prod/staging/preview/dev)
 *  - release (injecté par le CI, fallback au commit sha si dispo, sinon "dev")
 *  - tracesSampleRate 10% pour ne pas exploser la facture
 *  - beforeSend pour filtrer les erreurs "Non-Error exception captured"
 *    (bruit React Query fréquent)
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

createRoot(document.getElementById("root")!).render(<App />);
