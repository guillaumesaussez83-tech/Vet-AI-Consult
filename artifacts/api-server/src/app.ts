import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middlewares/errorHandler";
import { apiLimiter } from "./middlewares/rateLimiter";
import { responseWrapper } from "./middlewares/responseWrapper";
import { fail } from "./lib/response";

const app: Express = express();

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
        ],
        connectSrc: [
          "'self'",
          "https://api.clerk.com",
          "https://*.clerk.accounts.dev",
          "https://api.anthropic.com",
        ],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        frameSrc: ["'self'", "https://clerk.com", "https://*.clerk.accounts.dev"],
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
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", apiLimiter);
app.use("/api", responseWrapper);
app.use("/api", router);

// Handler 404 pour toute route inconnue (doit retourner JSON, pas du HTML)
app.use((req, res) => {
  res.status(404).json(fail("NOT_FOUND", `Route ${req.method} ${req.path} introuvable`));
});

app.use(errorHandler);

export default app;
