import express, { type Express } from "express";
import * as Sentry from "@sentry/node";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import { extractClinic } from "./middlewares/extractClinic";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middlewares/errorHandler";
import { apiLimiter } from "./middlewares/rateLimiter";
import { responseWrapper } from "./middlewares/responseWrapper";
import { fail } from "./lib/response";

const app: Express = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://clerk.com",
          "https://*.clerk.accounts.dev",
          "https://clerk.vetoai.fr",
          "https://*.vetoai.fr",
        ],
        connectSrc: [
          "'self'",
          "https://api.clerk.com",
          "https://*.clerk.accounts.dev",
          "https://clerk.vetoai.fr",
          "https://*.vetoai.fr",
          "https://api.anthropic.com",
        ],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        frameSrc: ["'self'", "https://clerk.com", "https://*.clerk.accounts.dev", "https://clerk.vetoai.fr", "https://*.vetoai.fr"],
        fontSrc: ["'self'", "https:", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    // Empêcher la fuite de headers sensibles dans les logs.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'req.headers["x-api-key"]',
      ],
      remove: true,
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// =============== CORS strict — whitelist pilotée par env ===============
// En prod, CORS_ALLOWED_ORIGINS="https://app.vetoai.fr".
// Plusieurs origines séparées par virgule, ex: "https://app.vetoai.fr,https://staging.vetoai.fr".
const ALLOWED_ORIGINS = (process.env["CORS_ALLOWED_ORIGINS"] ?? "https://app.vetoai.fr")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use("/api",
  cors({
    credentials: true,
    origin: (origin, cb) => {
      // Pas d'Origin → appel same-origin (navigation directe, Postman, curl). OK.
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      logger.warn({ origin }, "CORS blocked");
      return cb(new Error(`CORS blocked: ${origin}`));
    },
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(clerkMiddleware());

app.use("/api", apiLimiter);
app.use("/api", responseWrapper);
app.use("/api", extractClinic());
app.use("/api", router);

// === Servir le frontend en production (déploiement monolithique) ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.resolve(__dirname, "../../vetcare/dist/public");

if (existsSync(frontendDist)) {
  logger.info({ frontendDist }, "Serving frontend static files");
  app.use(express.static(frontendDist));

  // SPA fallback : toute route non-API renvoie index.html (compatible Express 5)
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/") || req.path.startsWith(CLERK_PROXY_PATH)) {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// Handler 404 pour toute route inconnue (doit retourner JSON, pas du HTML)
app.use((req, res) => {
  res.status(404).json(fail("NOT_FOUND", `Route ${req.method} ${req.path} introuvable`));
});

// Sentry error handler — doit être enregistré avant tout autre error middleware
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

export default app;
