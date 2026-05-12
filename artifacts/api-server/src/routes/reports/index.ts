// artifacts/api-server/src/routes/reports/index.ts
// Phase 4 — Rapports mensuels PDF : génération + téléchargement

import { Router, Request, Response } from "express";
import {
  db,
  groupReportsTable,
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
  gte,
  lte,
  ne,
} from "drizzle-orm";
import { asyncHandler } from "../../middleware/errorHandler";
import { requireClinicId } from "../../middleware/requireClinicId";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { logger } from "../../lib/logger";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function frDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

async function collectMonthKpis(
  clinicId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const [[caRow], [consultRow], [newPatientsRow], [totalPatientsRow], [impayeesRow], encs] =
    await Promise.all([
      db
        .select({ v: sql<string>`COALESCE(SUM(montant_ttc::numeric),0)` })
        .from(facturesTable)
        .where(
          and(
            eq(facturesTable.clinicId, clinicId),
            gte(facturesTable.createdAt, periodStart),
            lte(facturesTable.createdAt, periodEnd)
          )
        ),
      db
        .select({ nb: count() })
        .from(consultationsTable)
        .where(
          and(
            eq(consultationsTable.clinicId, clinicId),
            gte(consultationsTable.createdAt, periodStart),
            lte(consultationsTable.createdAt, periodEnd)
          )
        ),
      db
        .select({ nb: count() })
        .from(patientsTable)
        .where(
          and(
            eq(patientsTable.clinicId, clinicId),
            gte(patientsTable.createdAt, periodStart),
            lte(patientsTable.createdAt, periodEnd)
          )
        ),
      db
        .select({ nb: count() })
        .from(patientsTable)
        .where(
          and(
            eq(patientsTable.clinicId, clinicId)
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
            eq(facturesTable.clinicId, clinicId),
            ne(facturesTable.statut, "payee")
          )
        ),
        db
        .execute(sql`SELECT COALESCE(SUM(montant_paye::numeric), 0)::text AS v FROM encaissements WHERE clinic_id = ${clinicId} AND created_at >= ${periodStart} AND created_at <= ${periodEnd}`)
        .then((r) => [{ v: String((r.rows[0] as any)?.v ?? "0") }])
        .catch(() => [{ v: "0" }]),
    ]);

  // Top actes du mois
  const topActes = await db
    .execute(sql`
      SELECT
        acte_libelle,
        COUNT(*) AS nb,
        COALESCE(SUM(montant_ttc::numeric), 0)::float AS ca
      FROM facture_lignes fl
      JOIN factures f ON f.id = fl.facture_id
      WHERE f.clinic_id = ${clinicId}
        AND f.deleted_at IS NULL
        AND f.created_at BETWEEN ${periodStart} AND ${periodEnd}
      GROUP BY acte_libelle
      ORDER BY ca DESC
      LIMIT 5
    `)
    .catch(() => ({ rows: [] }));

  return {
    caTtcTotal: parseFloat(caRow.v || "0"),
    caHtTotal: parseFloat(caRow.v || "0") / 1.2,
    encaissements: parseFloat(encs[0]?.v || "0"),
    nbConsultations: consultRow.nb,
    nbNouveauxPatients: newPatientsRow.nb,
    nbPatientsTotal: totalPatientsRow.nb,
    facturesImpayeesNb: impayeesRow.nb,
    facturesImpayeesMontant: parseFloat(impayeesRow.mt || "0"),
    topActes: topActes.rows,
  };
}

// ─── Génération PDF ──────────────────────────────────────────────────────────

async function generateMonthlyPDF(
  clinicId: string,
  periodLabel: string,
  periodStart: Date,
  periodEnd: Date,
  kpis: ReturnType<typeof collectMonthKpis> extends Promise<infer T> ? T : never
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const primary = "#1E4D8C";
    const lightGray = "#F5F5F5";
    const darkText = "#1A1A1A";
    const mutedText = "#666666";

    // ── En-tête ──────────────────────────────────────────────────────────────
    doc
      .rect(0, 0, 595, 80)
      .fill(primary)
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("VétoAI", 50, 25)
      .fontSize(11)
      .font("Helvetica")
      .text("Rapport mensuel d'activité", 50, 52)
      .text(`${periodLabel} · Clinique ${clinicId}`, 50, 66);

    doc
      .fillColor(mutedText)
      .fontSize(9)
      .text(`Généré le ${frDate(new Date())}`, 400, 60, { align: "right" });

    doc.moveDown(3);

    // ── KPIs principaux ───────────────────────────────────────────────────────
    doc
      .fillColor(primary)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Chiffre d'affaires", 50, 110);

    const kpiY = 135;
    const kpiCards = [
      {
        label: "CA TTC",
        value: formatEur(kpis.caTtcTotal),
        x: 50,
        color: "#2ECC71",
      },
      {
        label: "CA HT",
        value: formatEur(kpis.caHtTotal),
        x: 185,
        color: "#3498DB",
      },
      {
        label: "Encaissé",
        value: formatEur(kpis.encaissements),
        x: 320,
        color: "#9B59B6",
      },
      {
        label: "Impayés",
        value: formatEur(kpis.facturesImpayeesMontant),
        x: 455,
        color: "#E74C3C",
      },
    ];

    kpiCards.forEach((k) => {
      doc
        .rect(k.x, kpiY, 120, 55)
        .fillAndStroke(lightGray, "#E0E0E0")
        .fillColor(k.color)
        .font("Helvetica-Bold")
        .fontSize(15)
        .text(k.value, k.x + 5, kpiY + 8, { width: 110, align: "center" })
        .fillColor(mutedText)
        .font("Helvetica")
        .fontSize(8)
        .text(k.label, k.x + 5, kpiY + 38, { width: 110, align: "center" });
    });

    doc.moveDown(5);

    // ── Activité ──────────────────────────────────────────────────────────────
    doc
      .fillColor(primary)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Activité clinique", 50, 215);

    const actY = 238;
    const actCards = [
      { label: "Consultations", value: String(kpis.nbConsultations), x: 50 },
      {
        label: "Nouveaux patients",
        value: String(kpis.nbNouveauxPatients),
        x: 200,
      },
      { label: "Total patients", value: String(kpis.nbPatientsTotal), x: 350 },
      {
        label: "Factures impayées",
        value: String(kpis.facturesImpayeesNb),
        x: 455,
      },
    ];

    actCards.forEach((k) => {
      doc
        .rect(k.x, actY, 130, 50)
        .fillAndStroke(lightGray, "#E0E0E0")
        .fillColor(darkText)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text(k.value, k.x + 5, actY + 6, { width: 120, align: "center" })
        .fillColor(mutedText)
        .font("Helvetica")
        .fontSize(8)
        .text(k.label, k.x + 5, actY + 34, { width: 120, align: "center" });
    });

    doc.moveDown(5);

    // ── Top actes ─────────────────────────────────────────────────────────────
    if (kpis.topActes && kpis.topActes.length > 0) {
      doc
        .fillColor(primary)
        .font("Helvetica-Bold")
        .fontSize(14)
        .text("Top actes du mois", 50, 315);

      let y = 340;
      doc
        .fillColor(primary)
        .rect(50, y, 495, 20)
        .fill()
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Acte", 55, y + 6)
        .text("Nb", 360, y + 6)
        .text("CA TTC", 430, y + 6);

      y += 20;
      (kpis.topActes as { acte_libelle: string; nb: number; ca: number }[]).forEach((acte, i) => {
        const rowColor = i % 2 === 0 ? "#FFFFFF" : lightGray;
        doc
          .rect(50, y, 495, 18)
          .fill(rowColor)
          .fillColor(darkText)
          .font("Helvetica")
          .fontSize(9)
          .text(String(acte.acte_libelle || "—").slice(0, 50), 55, y + 5)
          .text(String(acte.nb), 360, y + 5)
          .text(formatEur(Number(acte.ca)), 410, y + 5);
        y += 18;
      });
    }

    // ── Pied de page ──────────────────────────────────────────────────────────
    doc
      .rect(0, 792, 595, 50)
      .fill(primary)
      .fillColor("#FFFFFF")
      .fontSize(8)
      .font("Helvetica")
      .text(
        `VétoAI · Rapport ${periodLabel} · Confidentiel — usage interne uniquement`,
        50,
        800,
        { align: "center", width: 495 }
      );

    doc.end();
  });
}

// ─── POST /api/reports/generate ──────────────────────────────────────────────
const generateSchema = z.object({
  reportType: z.enum(["monthly", "quarterly"]).default("monthly"),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodLabel: z.string().min(2).max(50),
});

router.post(
  "/generate",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;
    const userId = req.auth?.userId || "auto";

    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides", details: parsed.error.issues }); return;
    }

    const { periodStart, periodEnd, periodLabel, reportType } = parsed.data;
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd + "T23:59:59");

    // Créer l'entrée rapport en "pending"
    const [report] = await db
      .insert(groupReportsTable)
      .values({
        clinicId,
        reportType,
        periodLabel,
        periodStart,
        periodEnd,
        status: "generating",
        generatedBy: userId,
      })
      .returning();

    // Génération asynchrone (pas de timeout HTTP grâce à la réponse 202)
    res.status(202).json({ reportId: report.id, status: "generating" });

    // Génération en background
    (async () => {
      try {
        const kpis = await collectMonthKpis(clinicId, startDate, endDate);
        const pdfBuffer = await generateMonthlyPDF(
          clinicId,
          periodLabel,
          startDate,
          endDate,
          kpis
        );

        const pdfBase64 = pdfBuffer.toString("base64");

        await db
          .update(groupReportsTable)
          .set({
            status: "ready",
            kpiSummary: JSON.stringify(kpis),
            pdfData: pdfBase64,
            pdfSizeBytes: pdfBuffer.length,
            generatedAt: new Date(),
          })
          .where(eq(groupReportsTable.id, report.id));

        logger.info({ reportId: report.id, clinicId }, "Report generated");
      } catch (err) {
        logger.error({ err, reportId: report.id }, "Report generation failed");
        await db
          .update(groupReportsTable)
          .set({
            status: "error",
            errorMessage: (err as Error).message,
          })
          .where(eq(groupReportsTable.id, report.id));
      }
    })();
  })
);

// ─── GET /api/reports ─────────────────────────────────────────────────────────
router.get(
  "/",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(20, parseInt(req.query.pageSize as string) || 10);
    const offset = (page - 1) * pageSize;

    const reports = await db
      .select({
        id: groupReportsTable.id,
        reportType: groupReportsTable.reportType,
        periodLabel: groupReportsTable.periodLabel,
        periodStart: groupReportsTable.periodStart,
        periodEnd: groupReportsTable.periodEnd,
        status: groupReportsTable.status,
        pdfSizeBytes: groupReportsTable.pdfSizeBytes,
        generatedAt: groupReportsTable.generatedAt,
        kpiSummary: groupReportsTable.kpiSummary,
        generatedBy: groupReportsTable.generatedBy,
      })
      .from(groupReportsTable)
      .where(eq(groupReportsTable.clinicId, clinicId))
      .orderBy(desc(groupReportsTable.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(groupReportsTable)
      .where(eq(groupReportsTable.clinicId, clinicId));

    return res.json({
      reports: reports.map((r) => ({
        ...r,
        kpiSummary: r.kpiSummary ? JSON.parse(r.kpiSummary) : null,
        pdfSizeKb: r.pdfSizeBytes ? Math.round(r.pdfSizeBytes / 1024) : null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  })
);

// ─── GET /api/reports/:id ─────────────────────────────────────────────────────
router.get(
  "/:id",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const [report] = await db
      .select()
      .from(groupReportsTable)
      .where(
        and(
          eq(groupReportsTable.id, id),
          eq(groupReportsTable.clinicId, clinicId)
        )
      )
      .limit(1);

    if (!report) return res.status(404).json({ error: "Rapport introuvable" });

    return res.json({
      ...report,
      kpiSummary: report.kpiSummary ? JSON.parse(report.kpiSummary) : null,
      // Ne renvoie pas pdfData dans le listing (trop lourd)
      hasPdf: !!report.pdfData,
    });
  })
);

// ─── GET /api/reports/:id/download ───────────────────────────────────────────
router.get(
  "/:id/download",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const [report] = await db
      .select({
        id: groupReportsTable.id,
        status: groupReportsTable.status,
        pdfData: groupReportsTable.pdfData,
        periodLabel: groupReportsTable.periodLabel,
        clinicId: groupReportsTable.clinicId,
      })
      .from(groupReportsTable)
      .where(
        and(
          eq(groupReportsTable.id, id),
          eq(groupReportsTable.clinicId, clinicId)
        )
      )
      .limit(1);

    if (!report) return res.status(404).json({ error: "Rapport introuvable" });
    if (report.status !== "ready" || !report.pdfData) {
      return res.status(409).json({ error: "PDF non disponible", status: report.status });
    }

    const pdfBuffer = Buffer.from(report.pdfData, "base64");
    const filename = `VetoAI_Rapport_${report.periodLabel.replace(/\s/g, "_")}_${clinicId}.pdf`;

    return res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      })
      .send(pdfBuffer);
  })
);

// ─── GET /api/reports/:id/status ─────────────────────────────────────────────
// Polling du statut de génération
router.get(
  "/:id/status",
  requireClinicId,
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const [report] = await db
      .select({
        id: groupReportsTable.id,
        status: groupReportsTable.status,
        generatedAt: groupReportsTable.generatedAt,
        errorMessage: groupReportsTable.errorMessage,
      })
      .from(groupReportsTable)
      .where(
        and(
          eq(groupReportsTable.id, id),
          eq(groupReportsTable.clinicId, clinicId)
        )
      )
      .limit(1);

    if (!report) return res.status(404).json({ error: "Rapport introuvable" });
    return res.json(report);
  })
);

export default router;
