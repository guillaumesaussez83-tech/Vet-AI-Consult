import rateLimit from "express-rate-limit";
import { fail } from "../lib/response";

/** Strip IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 → 1.2.3.4) to silence ERR_ERL_KEY_GEN_IPV6 */
const normalizeIp = (req: any): string =>
  (req.ip ?? "").replace(/^::ffff:/, "") || "unknown";

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: normalizeIp,
  skip: (req) => req.path === "/health",
  message: fail("RATE_LIMIT", "Trop de requêtes, réessayez dans une minute"),
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: normalizeIp,
  message: fail("AI_RATE_LIMIT", "Limite IA atteinte — attendez 1 minute"),
});
