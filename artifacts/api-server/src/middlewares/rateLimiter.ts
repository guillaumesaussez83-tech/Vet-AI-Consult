import rateLimit from "express-rate-limit";
import { fail } from "../lib/response";

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
  message: fail("RATE_LIMIT", "Trop de requêtes, réessayez dans une minute"),
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: fail("AI_RATE_LIMIT", "Limite IA atteinte — attendez 1 minute"),
});
