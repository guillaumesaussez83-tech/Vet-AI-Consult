// artifacts/api-server/src/routes/analytics/index.ts
// Phase 4 — Dashboard Analytics IA : KPIs temps réel, insights, prévision CA, clientèle

import { Router, Request, Response } from "express";
import { db } from "../../lib/db";
import {
  consultationsTable,
  patientsTable,
  facturesTable,
  encaissementsTable,
  rendezVousTable,
  analyticsSnapshotsTable,
  analyticsForecastsTable,
} from "@workspace/db";
import {
  eq,
  and,
  gte,
  lte,
  sql,
  desc,
  count,
  sum,
  isNull,
  lt,
  ne,
} from "drizzle-orm";
import { asyncHandler } from "../../middleware/errorHandler";
import { requireClinicId } from "../../middleware/requireClinicId";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import logger from "../../lib/logger";

const router = Router();
const anthropic = new Anthropic();

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

// ─── GET /api/analytics/kpis ─────────────────────────────────────────────────
// KPIs temps réel : CA du jour/mois/an, consultations, patients, factures
router.get(
  "/kpis",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = startOfMonth(now);
    const yearStart = startOfYear(now);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // CA aujourd'hui
    const [caJour] = await db
      .select({ total: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` })
      .from(facturesTable)
      .where(
        and(
          eq(facturesTable.clinicId, clinicId),
          gte(facturesTable.createdAt, todayStart),
          
        )
      );

    // CA mois courant
    const [caMois] = await db
      .select({ total: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` })
      .from(facturesTable)
      .where(
        and(
          eq(facturesTable.clinicId, clinicId),
          gte(facturesTable.createdAt, monthStart),
          
        )
      );

    // CA mois précédent (pour variation %)
    const [caMoisPrev] = await db
      .select({ total: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` })
      .from(facturesTable)
      .where(
        and(
          eq(facturesTable.clinicId, clinicId),
          gte(facturesTable.createdAt, prevMonthStart),
          lte(facturesTable.createdAt, prevMonthEnd),
          
        )
      );

    // CA année
    const [caAn] = await db
      .select({ total: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` })
      .from(facturesTable)
      .where(
        and(
          eq(facturesTable.clinicId, clinicId),
          gte(facturesTable.createdAt, yearStart),
          
        )
      );

    // Consultations du jour
    const [consultJour] = await db
      .select({ nb: count() })
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.clinicId, clinicId),
          gte(consultationsTable.createdAt, todayStart),
          
        )
      );

    // Consultations du mois
    const [consultMois] = await db
      .select({ nb: count() })
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.clinicId, clinicId),
          gte(consultationsTable.createdAt, monthStart),
          
        )
      );

    // Nouveaux patients ce mois
    const [newPatients] = await db
      .select({ nb: count() })
      .from(patientsTable)
      .where(
        and(
          eq(patientsTable.clinicId, clinicId),
          gte(patientsTable.createdAt, monthStart),
          
        )
      );

    // Total patients actifs (clinique)
    const [totalPatients] = await db
      .select({ nb: count() })
      .from(patientsTable)
      .where(
        and(
          eq(patientsTable.clinicId, clinicId),
          
        )
      );

    // Factures impayées
    const [impayees] = await db
      .select({
        nb: count(),
        montant: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)`,
      })
      .from(facturesTable)
      .where(
        and(
          eq(facturesTable.clinicId, clinicId),
          ne(facturesTable.statut, "payee"),
          
        )
      );

    // Taux d'utilisation IA (% consultations avec IA ce mois)
    const [consultIA] = await db
      .select({ nb: count() })
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.clinicId, clinicId),
          gte(consultationsTable.createdAt, monthStart),
          sql`synthese_ia IS NOT NULL AND synthese_ia != ''`,
          
        )
      );

    const caMoisNum = parseFloat(caMois.total || "0");
    const caMoisPrevNum = parseFloat(caMoisPrev.total || "0");
    const variationCA =
      caMoisPrevNum > 0
        ? (((caMoisNum - caMoisPrevNum) / caMoisPrevNum) * 100).toFixed(1)
        : null;

    const tauxIA =
      consultMois.nb > 0
        ? ((consultIA.nb / consultMois.nb) * 100).toFixed(1)
        : "0";

    res.json({
      caJour: parseFloat(caJour.total || "0"),
      caMois: caMoisNum,
      caAn: parseFloat(caAn.total || "0"),
      variationCAvsMoisPrecedent: variationCA,
      consultationsJour: consultJour.nb,
      consultationsMois: consultMois.nb,
      nouveauxPatientsMois: newPatients.nb,
      totalPatientsActifs: totalPatients.nb,
      facturesImpayeesNb: impayees.nb,
      facturesImpayeesMontant: parseFloat(impayees.montant || "0"),
      tauxUtilisationIA: parseFloat(tauxIA),
      generatedAt: now.toISOString(),
    });
  })
);

// ─── GET /api/analytics/evolution ────────────────────────────────────────────
// CA mensuel sur les 13 derniers mois (pour graphique tendance)
router.get(
  "/evolution",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;
    const months = parseInt(req.query.months as string) || 13;

    const rows = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(montant_ttc::numeric), 0)::float AS ca_ttc,
        COUNT(*) AS nb_factures
      FROM factures
      WHERE clinic_id = ${clinicId}
        AND deleted_at IS NULL
        AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '${sql.raw(String(months - 1))} months')
      GROUP BY 1
      ORDER BY 1
    `);

    res.json({ data: rows.rows, months });
  })
);

// ─── GET /api/analytics/forecast ─────────────────────────────────────────────
// Prévision CA sur les 3 prochains mois (régression linéaire sur 12 mois)
router.get(
  "/forecast",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;

    // Données des 12 derniers mois
    const rows = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(montant_ttc::numeric), 0)::float AS ca_ttc
      FROM factures
      WHERE clinic_id = ${clinicId}
        AND deleted_at IS NULL
        AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '12 months')
        AND created_at < DATE_TRUNC('month', NOW())
      GROUP BY 1
      ORDER BY 1
    `);

    const data = rows.rows as { month: string; ca_ttc: number }[];

    if (data.length < 3) {
      return res.json({ forecasts: [], message: "Données insuffisantes (< 3 mois)" });
    }

    // Régression linéaire simple (y = a*x + b)
    const n = data.length;
    const xs = data.map((_, i) => i);
    const ys = data.map((r) => r.ca_ttc);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
    const a = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - a * sumX) / n;

    // Écart-type résiduel pour intervalle de confiance
    const residuals = ys.map((y, i) => Math.pow(y - (a * i + b), 2));
    const rmse = Math.sqrt(residuals.reduce((s, r) => s + r, 0) / n);

    // 3 mois suivants
    const lastMonthDate = new Date(data[data.length - 1].month + "-01");
    const forecasts = Array.from({ length: 3 }, (_, k) => {
      const forecastDate = new Date(lastMonthDate);
      forecastDate.setMonth(forecastDate.getMonth() + k + 1);
      const month = forecastDate.toISOString().slice(0, 7);
      const x = n + k;
      const predicted = Math.max(0, a * x + b);
      return {
        month,
        caForecast: Math.round(predicted * 100) / 100,
        confidenceMin: Math.max(0, Math.round((predicted - 1.96 * rmse) * 100) / 100),
        confidenceMax: Math.round((predicted + 1.96 * rmse) * 100) / 100,
      };
    });

    // Sauvegarde en DB (async, non-bloquant)
    forecasts.forEach((f) => {
      db.insert(analyticsForecastsTable)
        .values({
          clinicId,
          forecastMonth: f.month,
          caForecastTtc: String(f.caForecast),
          confidenceInterval: String(Math.round(1.96 * rmse * 100) / 100),
          methodology: "linear_regression",
          dataPointsUsed: n,
        })
        .onConflictDoUpdate({
          target: [analyticsForecastsTable.clinicId, analyticsForecastsTable.forecastMonth],
          set: {
            caForecastTtc: String(f.caForecast),
            generatedAt: new Date(),
          },
        })
        .catch((err: Error) => logger.warn({ err }, "forecast upsert failed"));
    });

    res.json({
      historique: data,
      forecasts,
      regression: { slope: a, intercept: b, rmse: Math.round(rmse * 100) / 100 },
    });
  })
);

// ─── GET /api/analytics/insights ─────────────────────────────────────────────
// Insights automatiques IA sur les données du mois
router.get(
  "/insights",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Collecte données clés
    const [[caMois], [caPrev], [consultMois], [consultPrev], [newPat], [impayees], [tauxIA]] =
      await Promise.all([
        db.select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` }).from(facturesTable)
          .where(and(eq(facturesTable.clinicId, clinicId), gte(facturesTable.createdAt, monthStart))),
        db.select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` }).from(facturesTable)
          .where(and(eq(facturesTable.clinicId, clinicId), gte(facturesTable.createdAt, prevMonthStart), lte(facturesTable.createdAt, prevMonthEnd))),
        db.select({ nb: count() }).from(consultationsTable)
          .where(and(eq(consultationsTable.clinicId, clinicId), gte(consultationsTable.createdAt, monthStart))),
        db.select({ nb: count() }).from(consultationsTable)
          .where(and(eq(consultationsTable.clinicId, clinicId), gte(consultationsTable.createdAt, prevMonthStart), lte(consultationsTable.createdAt, prevMonthEnd))),
        db.select({ nb: count() }).from(patientsTable)
          .where(and(eq(patientsTable.clinicId, clinicId), gte(patientsTable.createdAt, monthStart), isNull(patientsTable.deletedAt))),
        db.select({ nb: count(), mt: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` }).from(facturesTable)
          .where(and(eq(facturesTable.clinicId, clinicId), ne(facturesTable.statut, "payee"))),
        db.select({ nb: count() }).from(consultationsTable)
          .where(and(eq(consultationsTable.clinicId, clinicId), gte(consultationsTable.createdAt, monthStart), sql`synthese_ia IS NOT NULL`)),
      ]);

    const caMoisV = parseFloat(caMois.v || "0");
    const caPrevV = parseFloat(caPrev.v || "0");
    const varCA = caPrevV > 0 ? (((caMoisV - caPrevV) / caPrevV) * 100).toFixed(1) : "N/A";
    const varConsult =
      consultPrev.nb > 0
        ? (((consultMois.nb - consultPrev.nb) / consultPrev.nb) * 100).toFixed(1)
        : "N/A";
    const tauxIAVal =
      consultMois.nb > 0 ? ((tauxIA.nb / consultMois.nb) * 100).toFixed(0) : "0";

    const prompt = `Tu es l'assistant analytics de VétoAI, logiciel de gestion vétérinaire.
Génère 3 à 5 insights business concis et actionnables basés sur ces KPIs du mois en cours :

- CA mois courant : ${caMoisV.toFixed(2)} € (vs ${caPrevV.toFixed(2)} € mois précédent, variation : ${varCA}%)
- Consultations mois : ${consultMois.nb} (vs ${consultPrev.nb}, variation : ${varConsult}%)
- Nouveaux patients : ${newPat.nb}
- Factures impayées : ${impayees.nb} (${parseFloat(impayees.mt || "0").toFixed(2)} €)
- Taux utilisation IA : ${tauxIAVal}%

Format : JSON array de { title: string, message: string, priority: "high"|"medium"|"low", type: "positive"|"warning"|"info" }
Langue : français. Max 120 caractères par message. Sois direct et chiffré.`.slice(0, 2000);

    let insights: unknown[] = [];
    try {
      const response = await Promise.race([
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("IA timeout")), 15000)
        ),
      ]);
      const text = (response as Anthropic.Message).content[0];
      if (text.type === "text") {
        const match = text.text.match(/\[[\s\S]*\]/);
        if (match) insights = JSON.parse(match[0]);
      }
    } catch (err) {
      logger.warn({ err }, "insights IA generation failed");
      insights = [
        {
          title: "IA temporairement indisponible",
          message: "Les insights automatiques seront disponibles dans quelques instants.",
          priority: "low",
          type: "info",
        },
      ];
    }

    res.json({ insights, generatedAt: now.toISOString() });
  })
);

// ─── GET /api/analytics/clientele ────────────────────────────────────────────
// Analyse clientèle : top propriétaires, attrition, patients inactifs
router.get(
  "/clientele",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;
    const now = new Date();
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    // Top propriétaires par CA total
    const topClients = await db.execute(sql`
      SELECT
        p.owner_name,
        p.owner_phone,
        p.owner_email,
        COUNT(DISTINCT p.id) AS nb_animaux,
        COUNT(DISTINCT c.id) AS nb_consultations,
        COALESCE(SUM(f.montant_ttc::numeric), 0)::float AS ca_total,
        MAX(c.created_at) AS derniere_visite
      FROM patients p
      LEFT JOIN consultations c ON c.patient_id = p.id AND c.deleted_at IS NULL
      LEFT JOIN factures f ON f.consultation_id = c.id AND f.deleted_at IS NULL
      WHERE p.clinic_id = ${clinicId}
        AND p.deleted_at IS NULL
      GROUP BY p.owner_name, p.owner_phone, p.owner_email
      ORDER BY ca_total DESC
      LIMIT ${limit}
    `);

    // Patients inactifs (aucune consultation depuis > 6 mois)
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const inactifs = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.espece,
        p.race,
        p.owner_name,
        p.owner_phone,
        MAX(c.created_at) AS derniere_consultation
      FROM patients p
      LEFT JOIN consultations c ON c.patient_id = p.id AND c.deleted_at IS NULL
      WHERE p.clinic_id = ${clinicId}
        AND p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.espece, p.race, p.owner_name, p.owner_phone
      HAVING MAX(c.created_at) < ${sixMonthsAgo} OR MAX(c.created_at) IS NULL
      ORDER BY derniere_consultation ASC NULLS FIRST
      LIMIT ${limit}
    `);

    // Répartition par espèce
    const repartitionEspece = await db.execute(sql`
      SELECT
        COALESCE(espece, 'Non renseigné') AS espece,
        COUNT(*) AS nb,
        ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
      FROM patients
      WHERE clinic_id = ${clinicId} AND deleted_at IS NULL
      GROUP BY espece
      ORDER BY nb DESC
    `);

    // Analyse attrition : propriétaires avec baisse de fréquence
    const attritionRisk = await db.execute(sql`
      WITH visits AS (
        SELECT
          p.owner_name,
          p.owner_phone,
          DATE_TRUNC('month', c.created_at) AS mois,
          COUNT(*) AS nb_visites
        FROM patients p
        JOIN consultations c ON c.patient_id = p.id AND c.deleted_at IS NULL
        WHERE p.clinic_id = ${clinicId}
          AND p.deleted_at IS NULL
          AND c.created_at >= NOW() - INTERVAL '12 months'
        GROUP BY 1, 2, 3
      ),
      owner_stats AS (
        SELECT
          owner_name,
          owner_phone,
          COUNT(DISTINCT mois) AS mois_actifs,
          SUM(nb_visites) AS total_visites,
          MAX(mois) AS dernier_mois
        FROM visits
        GROUP BY 1, 2
      )
      SELECT *
      FROM owner_stats
      WHERE mois_actifs >= 2
        AND dernier_mois < DATE_TRUNC('month', NOW() - INTERVAL '2 months')
      ORDER BY total_visites DESC
      LIMIT ${limit}
    `);

    // Total patients inactifs et actifs
    const [[totInactifs], [totActifs]] = await Promise.all([
      db.select({ nb: count() }).from(patientsTable).where(
        and(eq(patientsTable.clinicId, clinicId))
      ),
      db.execute(sql`
        SELECT COUNT(DISTINCT p.id) AS nb
        FROM patients p
        JOIN consultations c ON c.patient_id = p.id AND c.deleted_at IS NULL
        WHERE p.clinic_id = ${clinicId}
          AND p.deleted_at IS NULL
          AND c.created_at >= ${sixMonthsAgo}
      `),
    ]);

    res.json({
      topClients: topClients.rows,
      patientsInactifs: inactifs.rows,
      repartitionEspece: repartitionEspece.rows,
      attritionRisk: attritionRisk.rows,
      stats: {
        totalPatients: totInactifs.nb,
        patientsActifsSixMois: Number(totActifs.rows[0]?.nb || 0),
        patientsInactifsNb: inactifs.rows.length,
        tauxRetentionPct:
          totInactifs.nb > 0
            ? (
                (Number(totActifs.rows[0]?.nb || 0) / totInactifs.nb) *
                100
              ).toFixed(1)
            : "0",
      },
    });
  })
);

// ─── GET /api/analytics/snapshot ─────────────────────────────────────────────
// Génère/récupère le snapshot du jour courant
router.post(
  "/snapshot/generate",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const monthStart = startOfMonth(now);
    const yearStart = startOfYear(now);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Collecte parallèle de toutes les métriques
    const [
      [caJourRow],
      [caMoisRow],
      [caAnRow],
      [consultJourRow],
      [consultTermineesRow],
      [consultIARow],
      [newPatientsRow],
      [patientsActifsRow],
      [facturesRow],
      [impayeesRow],
      [alertesRow],
    ] = await Promise.all([
      db.select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` }).from(facturesTable)
        .where(and(eq(facturesTable.clinicId, clinicId), gte(facturesTable.createdAt, startOfDay(now)))),
      db.select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` }).from(facturesTable)
        .where(and(eq(facturesTable.clinicId, clinicId), gte(facturesTable.createdAt, monthStart))),
      db.select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` }).from(facturesTable)
        .where(and(eq(facturesTable.clinicId, clinicId), gte(facturesTable.createdAt, yearStart))),
      db.select({ nb: count() }).from(consultationsTable)
        .where(and(eq(consultationsTable.clinicId, clinicId), gte(consultationsTable.createdAt, startOfDay(now)))),
      db.select({ nb: count() }).from(consultationsTable)
        .where(and(eq(consultationsTable.clinicId, clinicId), eq(consultationsTable.statut, "TERMINEE"), gte(consultationsTable.createdAt, startOfDay(now)))),
      db.select({ nb: count() }).from(consultationsTable)
        .where(and(eq(consultationsTable.clinicId, clinicId), sql`synthese_ia IS NOT NULL`, gte(consultationsTable.createdAt, startOfDay(now)))),
      db.select({ nb: count() }).from(patientsTable)
        .where(and(eq(patientsTable.clinicId, clinicId), gte(patientsTable.createdAt, monthStart))),
      db.execute(sql`
        SELECT COUNT(DISTINCT p.id) AS nb FROM patients p
        JOIN consultations c ON c.patient_id = p.id AND c.deleted_at IS NULL
        WHERE p.clinic_id = ${clinicId} AND p.deleted_at IS NULL AND c.created_at >= ${sixMonthsAgo}
      `),
      db.select({ nb: count(), pays: sql<string>`COALESCE(SUM(CASE WHEN statut='payee' THEN 1 ELSE 0 END),0)` }).from(facturesTable)
        .where(and(eq(facturesTable.clinicId, clinicId))),
      db.select({ nb: count(), mt: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` }).from(facturesTable)
        .where(and(eq(facturesTable.clinicId, clinicId), ne(facturesTable.statut, "payee"))),
      db.execute(sql`SELECT COUNT(*) AS nb FROM stock_alertes WHERE clinic_id = ${clinicId}`).catch(() => [{ rows: [{ nb: 0 }] }]),
    ]);

    const snapshot = {
      clinicId,
      snapshotDate: today,
      caTtcJour: caJourRow.v,
      caTtcMois: caMoisRow.v,
      caTtcAn: caAnRow.v,
      caHtJour: String(parseFloat(caJourRow.v || "0") / 1.2),
      nbConsultations: consultJourRow.nb,
      nbConsultationsTerminees: consultTermineesRow.nb,
      nbConsultationsIA: consultIARow.nb,
      nbNouveauxPatients: newPatientsRow.nb,
      nbPatientsActifs: Number(patientsActifsRow.rows[0]?.nb || 0),
      nbFactures: facturesRow.nb,
      nbFacturesPayees: Number(facturesRow.pays || 0),
      nbFacturesImpayees: impayeesRow.nb,
      montantImpoayeTtc: impayeesRow.mt,
      nbAlerteStock: Number((alertesRow as { rows: { nb: number }[] }[])[0]?.rows[0]?.nb || 0),
    };

    await db
      .insert(analyticsSnapshotsTable)
      .values(snapshot)
      .onConflictDoUpdate({
        target: [analyticsSnapshotsTable.clinicId, analyticsSnapshotsTable.snapshotDate],
        set: { ...snapshot, createdAt: new Date() },
      });

    res.json({ success: true, snapshot });
  })
);

export default router;
