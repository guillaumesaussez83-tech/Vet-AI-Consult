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

// TTL de 90 jours par défaut — configurable via env.
const PORTAIL_TOKEN_TTL_DAYS = Number(process.env["PORTAIL_TOKEN_TTL_DAYS"] ?? 90);

// Rate limit dédié anti-énumération sur la génération de tokens.
// Clé = userId Clerk (donc par compte connecté de la clinique).
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const auth = getAuth(req as Request);
    return auth?.userId ?? req.ip ?? "anon";
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
//  GET /:token — ROUTE PUBLIQUE (lecture portail client par le propriétaire)
//  La regex en PUBLIC_ROUTES (extractClinic) garantit que seuls des tokens
//  hex de 64 caractères arrivent jusqu'ici. On vérifie TTL + clinicId partout.
// ============================================================================

router.get("/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json(fail("INVALID_TOKEN_FORMAT", "Token invalide."));
    }

    const [tokenRecord] = await db
      .select()
      .from(portailTokensTable)
      .where(
        and(
          eq(portailTokensTable.token, token),
          // si la colonne expires_at n'existe pas encore (migration pas passée),
          // commenter la ligne suivante et appliquer d'abord la migration.
          gt(portailTokensTable.expiresAt, new Date()),
        ),
      );
    if (!tokenRecord) {
      return res.status(404).json(fail("TOKEN_NOT_FOUND", "Lien invalide ou expiré."));
    }

    const tenantClinicId = tokenRecord.clinicId;

    // Owner strictement dans la clinique du token.
    const [owner] = await db
      .select()
      .from(ownersTable)
      .where(
        and(eq(ownersTable.clinicId, tenantClinicId), eq(ownersTable.id, tokenRecord.ownerId)),
      );
    if (!owner) {
      return res.status(404).json(fail("OWNER_NOT_FOUND", "Propriétaire introuvable."));
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
          .orderBy(desc(vaccinationsTable.dateInjection));

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

// ============================================================================
//  POST /generate/:ownerId — ROUTE AUTHENTIFIÉE (appelée par la clinique)
//  extractClinic() passe → req.clinicId est renseigné.
//  Le router principal doit monter cette route APRÈS extractClinic pour qu'elle
//  ne matche pas la regex publique.
// ============================================================================

router.post(
  "/generate/:ownerId",
  generateLimiter,
  async (req: Request, res: Response) => {
    try {
      const ownerId = Number.parseInt(req.params.ownerId ?? "", 10);
      if (!Number.isInteger(ownerId) || ownerId <= 0) {
        return res.status(400).json(fail("INVALID_ID", "ID propriétaire invalide."));
      }

      // Vérifier que l'owner appartient bien à la clinique du caller.
      const [owner] = await db
        .select({ id: ownersTable.id })
        .from(ownersTable)
        .where(and(eq(ownersTable.clinicId, req.clinicId), eq(ownersTable.id, ownerId)));
      if (!owner) {
        return res.status(404).json(fail("OWNER_NOT_FOUND", "Propriétaire introuvable."));
      }

      // Réutilisation : si un token actif existe déjà, on le renvoie.
      const now = new Date();
      const [existing] = await db
        .select()
        .from(portailTokensTable)
        .where(
          and(
            eq(portailTokensTable.clinicId, req.clinicId),
            eq(portailTokensTable.ownerId, ownerId),
            gt(portailTokensTable.expiresAt, now),
          ),
        )
        .limit(1);
      if (existing) {
        return res.json(ok({ token: existing.token, expiresAt: existing.expiresAt }));
      }

      const token = crypto.randomBytes(32).toString("hex"); // 64 chars hex
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
