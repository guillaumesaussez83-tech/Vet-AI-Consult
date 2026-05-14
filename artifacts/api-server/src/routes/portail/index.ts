import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  portailTokensTable,
  ownersTable,
  patientsTable,
  consultationsTable,
  vaccinationsTable,
} from "@workspace/db";
import { and, eq, desc, gt } from "drizzle-orm";
import crypto from "crypto";
import { fail, ok } from "../../lib/response";

const router: IRouter = Router();

// TTL de 90 jours par defaut — configurable via env.
const PORTAIL_TOKEN_TTL_DAYS = Number(process.env["PORTAIL_TOKEN_TTL_DAYS"] ?? 90);

// Rate limit dedie anti-enumeration sur la generation de tokens.
// Cle = userId Clerk (donc par compte connecte de la clinique).
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  validate: false,
  keyGenerator: (req) => {
    const auth = getAuth(req as Request);
    return auth?.userId ?? req.ip ?? "anon";
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /:token — ROUTE PUBLIQUE (lecture portail client par le proprietaire)
router.get("/:token", async (req: Request, res: Response) => {
  try {
    const token = req.params["token"] as string;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json(fail("INVALID_TOKEN_FORMAT", "Token invalide."));
    }
    const [tokenRecord] = await db
      .select()
      .from(portailTokensTable)
      .where(
        and(
          eq(portailTokensTable.token, token),
          gt(portailTokensTable.expiresAt, new Date()),
        ),
      );
    if (!tokenRecord) {
      return res.status(404).json(fail("TOKEN_NOT_FOUND", "Lien invalide ou expire."));
    }
    const tenantClinicId = tokenRecord.clinicId;
    const [owner] = await db
      .select()
      .from(ownersTable)
      .where(
        and(eq(ownersTable.clinicId, tenantClinicId), eq(ownersTable.id, tokenRecord.ownerId)),
      );
    if (!owner) {
      return res.status(404).json(fail("OWNER_NOT_FOUND", "Proprietaire introuvable."));
    }
    const patients = await db
      .select()
      .from(patientsTable)
      .where(
        and(eq(patientsTable.clinicId, tenantClinicId), eq(patientsTable.ownerId, owner.id)),
      );
    const patientsWithData = await Promise.all(
      patients.map(async (patient) => {
        const [lastConsultation] = await db
          .select()
          .from(consultationsTable)
          .where(
            and(
              eq(consultationsTable.clinicId, tenantClinicId),
              eq(consultationsTable.patientId, patient.id),
            ),
          )
          .orderBy(desc(consultationsTable.date))
          .limit(1);
        const vaccinations = await db
          .select()
          .from(vaccinationsTable)
          .where(
            and(
              eq(vaccinationsTable.clinicId, tenantClinicId),
              eq(vaccinationsTable.patientId, patient.id),
            ),
          )
          .orderBy(desc(vaccinationsTable.vaccineDate));
        return { ...patient, lastConsultation: lastConsultation ?? null, vaccinations };
      }),
    );
    return res.json(
      ok({
        owner: {
          nom: owner.nom,
          prenom: owner.prenom,
          email: owner.email,
          telephone: owner.telephone,
        },
        patients: patientsWithData,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "portail GET /:token failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne."));
  }
});

// POST /generate/:ownerId — ROUTE AUTHENTIFIEE (appelee par la clinique)
router.post(
  "/generate/:ownerId",
  generateLimiter,
  async (req: Request, res: Response) => {
    try {
      const ownerId = Number.parseInt((req.params.ownerId as string) ?? "", 10);
      if (!Number.isInteger(ownerId) || ownerId <= 0) {
        return res.status(400).json(fail("INVALID_ID", "ID proprietaire invalide."));
      }
      const [owner] = await db
        .select({ id: ownersTable.id })
        .from(ownersTable)
        .where(and(eq(ownersTable.clinicId, req.clinicId!), eq(ownersTable.id, ownerId)));
      if (!owner) {
        return res.status(404).json(fail("OWNER_NOT_FOUND", "Proprietaire introuvable."));
      }
      const now = new Date();
      const [existing] = await db
        .select()
        .from(portailTokensTable)
        .where(
          and(
            eq(portailTokensTable.clinicId, req.clinicId!),
            eq(portailTokensTable.ownerId, ownerId),
            gt(portailTokensTable.expiresAt, now),
          ),
        )
        .limit(1);
      if (existing) {
        return res.json(ok({ token: existing.token, expiresAt: existing.expiresAt }));
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(now.getTime() + PORTAIL_TOKEN_TTL_DAYS * 24 * 3600 * 1000);
      await db.insert(portailTokensTable).values({
        clinicId: req.clinicId,
        ownerId,
        token,
        expiresAt,
      });
      return res.status(201).json(ok({ token, expiresAt }));
    } catch (err) {
      req.log.error({ err }, "portail POST /generate/:ownerId failed");
      return res.status(500).json(fail("INTERNAL", "Erreur interne."));
    }
  },
);

export default router;
