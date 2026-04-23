import pino, { type LoggerOptions } from "pino";

/**
 * Logger principal — Pino.
 *
 * Conventions :
 *   - Niveau par env : LOG_LEVEL (défaut = info en prod, debug en dev).
 *   - En dev : pino-pretty via script npm `dev:pretty` (pas via logger
 *     directement, pour éviter la dépendance pino-pretty en prod).
 *   - Redact : toute clé sensible est supprimée avant sérialisation, même
 *     si un handler passe par mégarde un header ou un token dans le
 *     contexte du log (P2-4).
 */
const isDev = process.env["NODE_ENV"] === "development";

const redactPaths = [
  // Headers HTTP sensibles (ceux passés via pinoHttp.serializers ou en
  // ajout manuel dans les logs).
  'authorization',
  'cookie',
  'set-cookie',
  '"set-cookie"',
  'x-api-key',
  '"x-api-key"',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  // Tokens métier qu'on pourrait logger par erreur.
  'token',
  'portailToken',
  'apiKey',
  'secret',
  // Anthropic body logs (ne JAMAIS logger le prompt complet).
  'prompt',
  'messages',
  // PII propriétaire (prudence).
  'email',
  'telephone',
  'iban',
];

const options: LoggerOptions = {
  level: process.env["LOG_LEVEL"] ?? (isDev ? "debug" : "info"),
  base: {
    service: "vetoai-api",
    env: process.env["NODE_ENV"] ?? "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  serializers: {
    err: pino.stdSerializers.err,
    // On n'active pas req/res ici — ils sont sérialisés par pino-http dans
    // app.ts, avec leur propre `redact` complet.
  },
};

export const logger = pino(options);
