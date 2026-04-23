import * as Sentry from "@sentry/node";
import { logger } from "./logger";

/**
 * Initialise Sentry côté serveur.
 *
 * À appeler TOUT au début de `index.ts`, AVANT l'import de `app.ts` et
 * avant tout autre code qui pourrait throw.
 *
 * Variables d'env :
 *   SENTRY_DSN        — obligatoire en prod, laisse vide en dev.
 *   SENTRY_RELEASE    — commit SHA en CI, sinon "dev".
 *   NODE_ENV          — used as environment tag.
 */
export function initSentryServer(): void {
  const dsn = process.env["SENTRY_DSN"];
  const env = process.env["NODE_ENV"] ?? "development";

  if (!dsn) {
    if (env !== "development" && env !== "test") {
      logger.warn("SENTRY_DSN non défini — aucune télémétrie d'erreurs.");
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: env,
    release: process.env["SENTRY_RELEASE"] ?? "dev",
    // 10% des transactions tracées — ajuster selon volume.
    tracesSampleRate: env === "production" ? 0.1 : 0,
    // PII : Sentry capture les headers request par défaut. On garde car
    // Pino redact les cookie/auth, mais on force l'anonymisation user.
    sendDefaultPii: false,
    beforeSend(event) {
      // Filtre des erreurs non exploitables (ex: ECONNRESET client qui ferme
      // une réponse SSE en cours — bruit). À ajuster si faux-positifs.
      const msg = event.exception?.values?.[0]?.value ?? "";
      if (/ECONNRESET|EPIPE|aborted/i.test(msg)) return null;
      return event;
    },
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });

  logger.info({ release: process.env["SENTRY_RELEASE"] ?? "dev", env }, "Sentry server initialisé");
}
