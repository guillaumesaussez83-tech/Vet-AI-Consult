// artifacts/api-server/src/routes/groupe/index.ts
// Phase 4 — Architecture multi-cliniques : DIRECTION_GROUPE

import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  clinicsTable,
  clinicGroupsTable,
  clinicUsersTable,
  analyticsSnapshotsTable,
  facturesTable,
  consultationsTable,
  patientsTable,
} from "@workspace/db";
import {
  eq,
  and,
  sql,
  desc,
  count,
  sum,
  isNull,
  inArray,
  gte,
  ne,
} from "drizzle-orm";
import { asyncHandler } from "../../middleware/errorHandler";
import { requireClinicId } from "../../middleware/requireClinicId";
import { z } from "zod";
import logger from "../../lib/logger";

const router = Router();

// ─── Middleware vérification role DIRECTION_GROUPE ──────────────────────────
async function requireGroupRole(req: Request, res: Response, next: Function) {
  // Vérifie que l'utilisateur a DIRECTION_GROUPE ou ADMIN sur au moins une clinique
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: "Non authentifié" });

  const [userRole] = await db
    .select()
    .from(clinicUsersTable)
    .where(
      and(
        eq(clinicUsersTable.userId, userId),
        eq(clinicUsersTable.isActive, true),
        sql`role IN ('DIRECTION_GROUPE', 'ADMIN')`
      )
    )
    .limit(1);

  if (!userRole) {
    return res
      .status(403)
      .json({ error: "Accès réservé à la Direction Groupe" });
  }

  (req as Request & { groupAccess: typeof userRole }).groupAccess = userRole;
  next();
}

// ─── GET /api/groupe/cliniques ────────────────────────────────────────────────
// Liste toutes les cliniques du groupe avec métriques clés
router.get(
  "/cliniques",
  requireGroupRole,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth?.userId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, parseInt(req.query.pageSize as string) || 20);
    const offset = (page - 1) * pageSize;

    // Cliniques accessibles à cet utilisateur
    const accessibleClinics = await db
      .select({ clinicId: clinicUsersTable.clinicId })
      .from(clinicUsersTable)
      .where(
        and(
          eq(clinicUsersTable.userId, userId),
          eq(clinicUsersTable.isActive, true)
        )
      );

    if (accessibleClinics.length === 0) {
      return res.json({
        cliniques: [],
        total: 0,
        page,
        pageSize,
      });
    }

    const clinicIds = accessibleClinics.map((r: { clinicId: string }) => r.clinicId);

    // Infos cliniques + KPIs agrégés du mois courant
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const cliniques = await db
      .select({
        id: clinicsTable.id,
        name: clinicsTable.name,
        city: clinicsTable.city,
        plan: clinicsTable.plan,
        isActive: clinicsTable.isActive,
      })
      .from(clinicsTable)
      .where(
        and(
          inArray(clinicsTable.id, clinicIds),
          isNull(clinicsTable.deletedAt),
          eq(clinicsTable.isActive, true)
        )
      )
      .limit(pageSize)
      .offset(offset);

    // Pour chaque clinique, on recupère les KPIs du mois en cours
    const kpisPromises = cliniques.map(async (c) => {
      const [[ca], [consults], [patients]] = await Promise.all([
        db
          .select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` })
          .from(facturesTable)
          .where(
            and(
              eq(facturesTable.clinicId, c.id),
              gte(facturesTable.createdAt, monthStart),
            )
          ),
        db
          .select({ nb: count() })
          .from(consultationsTable)
          .where(
            and(
              eq(consultationsTable.clinicId, c.id),
              gte(consultationsTable.createdAt, monthStart),
            )
          ),
        db
          .select({ nb: count() })
          .from(patientsTable)
          .where(
            and(
              eq(patientsTable.clinicId, c.id),
            )
          ),
      ]);

      return {
        ...c,
        kpisMois: { 
          caTtcMois: parseFloat(ca.v || "0"),
          nbConsultations: consults.nb,
          nbPatientsTotal: patients.nb,
        },
      };
    });

    const cliniquesWithKpis = await Promise.all(kpisPromises);

    // Comptage total
    const [{ total }] = await db
      .select({ total: count() })
      .from(clinicsTable)
      .where(
        and(
          inArray(clinicsTable.id, clinicIds),
          isNull(clinicsTable.deletedAt),
          eq(clinicsTable.isActive, true)
        )
      );

    res.json({
      cliniques: cliniquesWithKpis,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  })
);

// ─── GET /api/groupe/dashboard ─────────────────────────────────────────────────
// KPIs consolidés multi-cliniques
router.get(
  "/dashboard",
  requireGroupRole,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth?.userId!;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Cliniques accessibles
    const accessibleClinics = await db
      .select({ clinicId: clinicUsersTable.clinicId })
      .from(clinicUsersTable)
      .where(
        and(
          eq(clinicUsersTable.userId, userId),
          eq(clinicUsersTable.isActive, true)
        )
      );

    const clinicIds = accessibleClinics.map((r: { clinicId: string }) => r.clinicId);

    if (clinicIds.length === 0) {
      return res.json({ message: "Aucune clinique accessible", kpis: null });
    }

    // Agrégation multi-cliniques en parallèle
    const [
      [caMoisRow],
      [caPrevRow],
      [caAnRow],
      [consultsMoisRow],
      [patientsTotalRow],
      [impayeesRow],
    ] = await Promise.all([
      db
        .select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` })
        .from(facturesTable)
        .where(
          and(
            inArray(facturesTable.clinicId, clinicIds),
            gte(facturesTable.createdAt, monthStart),
          )
        ),
      db
        .select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` })
        .from(facturesTable)
        .where(
          and(
            inArray(facturesTable.clinicId, clinicIds),
            gte(facturesTable.createdAt, prevMonthStart),
            sql`created_at <= ${prevMonthEnd}`,
          )
        ),
      db
        .select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` })
        .from(facturesTable)
        .where(
          and(
            inArray(facturesTable.clinicId, clinicIds),
            gte(facturesTable.createdAt, yearStart),
          )
        ),
      db
        .select({ nb: count() })
        .from(consultationsTable)
        .where(
          and(
            inArray(consultationsTable.clinicId, clinicIds),
            gte(consultationsTable.createdAt, monthStart),
          )
        ),
      db
        .select({ nb: count() })
        .from(patientsTable)
        .where(
          and(
            inArray(patientsTable.clinicId, clinicIds),
          )
        ),
      db
        .select({
          nb: count(),
          mt: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)`,
        })
        .from(facturesTable)
        .where(
          and(
            inArray(facturesTable.clinicId, clinicIds),
            ne(facturesTable.statut, "payee"),
          )
        ),
    ]);

    const caMoisV = parseFloat(caMoisRow.v || "0");
    const caPrevV = parseFloat(caPrevRow.v || "0");
    const variationCA =
      caPrevV > 0
        ? (((caMoisV - caPrevV) / caPrevV) * 100).toFixed(1)
        : null;

    // Évolution CA sur 12 mois (all clinics)
    const evolution = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        clinic_id,
        COALESCE(SUM(montant_ttc::numeric), 0)::float AS ca_ttc
      FROM factures
      WHERE clinic_id = ANY(${sql.raw("ARRAY['" + clinicIds.join("','") + "']")}::text[])
        AND deleted_at IS NULL
        AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '12 months')
      GROUP BY 1, 2
      ORDER BY 1, 2
    `).catch(() => ({ rows: [] }));

    return res.json({
      nbCliniques: clinicIds.length,
      kpis: {
        caTtcMois: caMoisV,
        caTtcAn: parseFloat(caAnRow.v || "0"),
        variationCAvsMoisPrecedent: variationCA,
        nbConsultationsMois: consultsMoisRow.nb,
        nbPatientsTotal: patientsTotalRow.nb,
        facturesImpayeesNb: impayeesRow.nb,
        facturesImpayeesMontant: parseFloat(impayeesRow.mt || "0"),
      },
      evolutionCA: evolution.rows,
      generatedAt: now.toISOString(),
    });
  })
);

// ─── GET /api/groupe/comparatif ───────────────────────────────────────────────
// Comparatif de performance entre cliniques (mois courant)
router.get(
  "/comparatif",
  requireGroupRole,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth?.userId!;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const accessibleClinics = await db
      .select({ clinicId: clinicUsersTable.clinicId })
      .from(clinicUsersTable)
      .where(
        and(
          eq(clinicUsersTable.userId, userId),
          eq(clinicUsersTable.isActive, true)
        )
      );

    const clinicIds = accessibleClinics.map((r: { clinicId: string }) => r.clinicId);
    if (clinicIds.length === 0) return res.json({ comparatif: [] });

    const cliniquesInfo = await db
      .select({ id: clinicsTable.id, name: clinicsTable.name })
      .from(clinicsTable)
      .where(
        and(inArray(clinicsTable.id, clinicIds), isNull(clinicsTable.deletedAt))
      );

    const comparatif = await Promise.all(
      cliniquesInfo.map(async (c) => {
        const [[ca], [consults], [patients], [impayees], [iaUsage]] =
          await Promise.all([
            db
              .select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` })
              .from(facturesTable)
              .where(
                and(
                  eq(facturesTable.clinicId, c.id),
                  gte(facturesTable.createdAt, monthStart),
                )
              ),
            db
              .select({ nb: count() })
              .from(consultationsTable)
              .where(
                and(
                  eq(consultationsTable.clinicId, c.id),
                  gte(consultationsTable.createdAt, monthStart),
                )
              ),
            db
              .select({ nb: count() })
              .from(patientsTable)
              .where(
                and(
                  eq(patientsTable.clinicId, c.id),
                )
              ),
            db
              .select({ nb: count() })
              .from(facturesTable)
              .where(
                and(
                  eq(facturesTable.clinicId, c.id),
                  ne(facturesTable.statut, "payee"),
                )
              ),
            db
              .select({ nb: count() })
              .from(consultationsTable)
              .where(
                and(
                  eq(consultationsTable.clinicId, c.id),
                  gte(consultationsTable.createdAt, monthStart),
                  sql`synthese_ia IS NOT NULL`,
                )
              ),
          ]);

        const caMois = parseFloat(ca.v || "0");
        const caParConsult =
          consults.nb > 0
            ? Math.round(caMois / consults.nb * 100) / 100
            : 0;
        const tauxIA =
          consults.nb > 0
            ? Math.round((iaUsage.nb / consults.nb) * 100 * 10) / 10
            : 0;

        return {
          clinicId: c.id,
          clinicName: c.name,
          caTtcMois: caMois,
          nbConsultations: consults.nb,
          caParConsultation: caParConsult,
          nbPatientsTotal: patients.nb,
          facturesImpayeesNb: impayees.nb,
          tauxUtilisationIA: tauxIA,
        };
      })
    );

    // Tri par CA décroissant
    comparatif.sort((a, b) => b.caTtcMois - a.caTtcMois);

    // Calcul du rang et des moyennes
    const avgCA =
      comparatif.reduce((s, c) => s + c.caTtcMois, 0) / comparatif.length;
    const avgConsults =
      comparatif.reduce((s, c) => s + c.nbConsultations, 0) /
      comparatif.length;

    res.json({
      comparatif: comparatif.map((c: any, i: number) => ({
        ...c,
        rang: i + 1,
        vsMoyenneCAPct:
          avgCA > 0
            ? (((c.caTtcMois - avgCA) / avgCA) * 100).toFixed(1)
            : null,
      })),
      moyennes: {
        caMiddleground: Math.round(avgCA * 100) / 100,
        nbConsultationsMoyenne: Math.round(avgConsults * 10) / 10,
      },
      generatedAt: now.toISOString(),
    });
  })
);

// ─── POST /api/groupe/cliniques ───────────────────────────────────────────────
// Créer une nouvelle clinique dans le groupe
const createClinicSchema = z.object({
  id: z.string().min(3),
  name: z.string().min(2).max(200),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  siret: z.string().optional(),
  plan: z.enum(["starter", "pro", "enterprise"]).default("starter"),
  maxUsers: z.number().int().min(1).max(100).default(5),
});

router.post(
  "/cliniques",
  requireGroupRole,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createClinicSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Données invalides", details: parsed.error.issues });
    }

    const existing = await db
      .select()
      .from(clinicsTable)
      .where(eq(clinicsTable.id, parsed.data.id))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: "ID clinique déjà utilisé" });
    }

    const [clinic] = await db
      .insert(clinicsTable)
      .values({ ...parsed.data })
      .returning();

    logger.info({ clinicId: clinic.id }, "New clinic created");
    return res.status(201).json(clinic);
  })
);

export default router;
