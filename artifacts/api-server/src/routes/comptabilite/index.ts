import { Router, Request, Response } from "express";
import requireClinicId from "../../middleware/requireClinicId";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "../../../db";
import { sql } from "drizzle-orm";

const router = Router();

// ── Enforce clinic isolation on all comptabilite routes
router.use(requireClinicId);

// âââ GET /api/comptabilite/dashboard ââââââââââââââââââââââââââââââââââââââââ
// KPIs financiers : CA HT, TVA collectÃ©e, impayÃ©s, nb factures + courbe mensuelle
router.get("/dashboard", requireAuth(), async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const { from, to } = req.query;

    const clinicId = (req as any).clinicId;
  if (!clinicId) return res.status(403).json({ error: "Clinic ID requis" });
  const dateFrom = from ? String(from) : new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const dateTo = to ? String(to) : new Date().toISOString().slice(0, 10);

    // KPIs globaux sur la pÃ©riode
    const kpis = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN document_type = 'FACTURE' AND status NOT IN ('ANNULE','BROUILLON') THEN total_ht ELSE 0 END), 0)::numeric AS ca_ht,
        COALESCE(SUM(CASE WHEN document_type = 'FACTURE' AND status NOT IN ('ANNULE','BROUILLON') THEN total_tva ELSE 0 END), 0)::numeric AS tva_collectee,
        COALESCE(SUM(CASE WHEN document_type = 'FACTURE' AND status NOT IN ('ANNULE','BROUILLON') THEN total_ttc ELSE 0 END), 0)::numeric AS ca_ttc,
        COUNT(CASE WHEN document_type = 'FACTURE' AND status NOT IN ('ANNULE','BROUILLON') THEN 1 END)::int AS nb_factures,
        COALESCE(SUM(CASE WHEN document_type = 'FACTURE' AND status IN ('FACTURE','EN_ATTENTE') THEN (total_ttc - COALESCE(total_paid,0)) ELSE 0 END), 0)::numeric AS impayes_ttc,
        COUNT(CASE WHEN document_type = 'FACTURE' AND status IN ('FACTURE','EN_ATTENTE') AND (total_ttc - COALESCE(total_paid,0)) > 0 THEN 1 END)::int AS nb_impayes
      FROM invoices
      WHERE clinic_id = ${clinicId}
        AND invoice_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
    `);

    // Courbe mensuelle CA HT sur 12 derniers mois
    const monthly = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', invoice_date), 'YYYY-MM') AS mois,
        COALESCE(SUM(total_ht), 0)::numeric AS ca_ht,
        COALESCE(SUM(total_ttc), 0)::numeric AS ca_ttc,
        COUNT(*)::int AS nb_factures
      FROM invoices
      WHERE clinic_id = ${clinicId}
        AND document_type = 'FACTURE'
        AND status NOT IN ('ANNULE','BROUILLON')
        AND invoice_date >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY DATE_TRUNC('month', invoice_date)
      ORDER BY DATE_TRUNC('month', invoice_date)
    `);

    // RÃ©partition par mode de rÃ¨glement
    const byPaymentMethod = await db.execute(sql`
      SELECT
        COALESCE(payment_method, 'NON_DEFINI') AS methode,
        COUNT(*)::int AS nb,
        COALESCE(SUM(amount), 0)::numeric AS total
      FROM encaissements
      WHERE clinic_id = ${clinicId}
        AND payment_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
      GROUP BY payment_method
      ORDER BY total DESC
    `);

    res.json({
      data: {
        kpis: kpis.rows[0],
        monthly: monthly.rows,
        byPaymentMethod: byPaymentMethod.rows,
        periode: { from: dateFrom, to: dateTo },
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// âââ GET /api/comptabilite/export-fec ââââââââââââââââââââââââââââââââââââââââ
// Export Fichier des Ãcritures Comptables (format DGFiP â TVA sur encaissements)
router.get("/export-fec", requireAuth(), async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const clinicId = (req as any).clinicId;
  if (!clinicId) return res.status(403).json({ error: "Clinic ID requis" });
  const dateFrom = from ? String(from) : new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const dateTo = to ? String(to) : new Date().toISOString().slice(0, 10);

    // Factures sur la pÃ©riode (journal VTE)
    const factures = await db.execute(sql`
      SELECT
        i.invoice_number,
        i.invoice_date,
        i.total_ht,
        i.total_tva,
        i.total_ttc,
        COALESCE(o.last_name || ' ' || o.first_name, 'CLIENT') AS owner_name
      FROM invoices i
      LEFT JOIN owners o ON o.id::text = i.owner_id::text
      WHERE i.clinic_id = ${clinicId}
        AND i.document_type = 'FACTURE'
        AND i.status NOT IN ('ANNULE','BROUILLON')
        AND i.invoice_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
      ORDER BY i.invoice_date, i.invoice_number
    `);

    // Encaissements sur la pÃ©riode (journal BQ)
    const encaissements = await db.execute(sql`
      SELECT
        e.id,
        e.payment_date,
        e.amount,
        e.payment_method,
        e.reference,
        i.invoice_number
      FROM encaissements e
      LEFT JOIN invoices i ON i.id = e.invoice_id
      WHERE e.clinic_id = ${clinicId}
        AND e.payment_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
      ORDER BY e.payment_date
    `);

    // GÃ©nÃ©ration FEC (format DGFiP â sÃ©parateur TAB, encodage UTF-8)
    const fmtDate = (d: string | Date) => String(d).slice(0, 10).replace(/-/g, "");
    const fmtAmt = (n: number | string) => Number(n).toFixed(2).replace(".", ",");

    const header = [
      "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
      "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
      "PieceRef", "PieceDate", "EcritureLib",
      "Debit", "Credit", "EcritureLet", "DateLet", "ValidDate",
      "Montantdevise", "Idevise"
    ].join("\t");

    const lines: string[] = [header];
    let ecritureCounter = 1;

    // Journal VTE â une facture = 3 lignes (client debit / prestation credit / TVA credit)
    for (const f of factures.rows as any[]) {
      const num = String(ecritureCounter++).padStart(6, "0");
      const d = fmtDate(f.invoice_date);
      const lib = `Fact ${f.invoice_number}`;
      const ht = Number(f.total_ht);
      const tva = Number(f.total_tva);
      const ttc = Number(f.total_ttc);

      // Ligne 1 â DÃ©bit Client 411000
      lines.push(["VTE","Ventes","VTE" + num, d, "411000","Clients",
        f.invoice_number, f.owner_name, f.invoice_number, d, lib,
        fmtAmt(ttc), "0,00", "", "", d, "", ""].join("\t"));

      // Ligne 2 â CrÃ©dit Prestations 706000
      lines.push(["VTE","Ventes","VTE" + num, d, "706000","Prestations de services",
        "", "", f.invoice_number, d, lib,
        "0,00", fmtAmt(ht), "", "", d, "", ""].join("\t"));

      // Ligne 3 â CrÃ©dit TVA collectÃ©e 445710 (si TVA > 0)
      if (tva > 0) {
        lines.push(["VTE","Ventes","VTE" + num, d, "445710","TVA collectÃ©e",
          "", "", f.invoice_number, d, lib,
          "0,00", fmtAmt(tva), "", "", d, "", ""].join("\t"));
      }
    }

    // Journal BQ â un encaissement = 2 lignes (banque debit / client credit)
    for (const e of encaissements.rows as any[]) {
      const num = String(ecritureCounter++).padStart(6, "0");
      const d = fmtDate(e.payment_date);
      const lib = `RÃ¨gl ${e.invoice_number || e.reference || ""}`;
      const amt = Number(e.amount);
      const refPiece = e.invoice_number || `ENC-${e.id}`;

      lines.push(["BQ","Banque","BQ" + num, d, "512000","Banque",
        "", "", refPiece, d, lib,
        fmtAmt(amt), "0,00", "", "", d, "", ""].join("\t"));

      lines.push(["BQ","Banque","BQ" + num, d, "411000","Clients",
        refPiece, "", refPiece, d, lib,
        "0,00", fmtAmt(amt), "", "", d, "", ""].join("\t"));
    }

    const filename = `FEC_VetoAI_${dateFrom}_${dateTo}.txt`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(lines.join("\r\n"));

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// âââ GET /api/comptabilite/journal-caisse âââââââââââââââââââââââââââââââââââââ
// Journal de caisse journalier
router.get("/journal-caisse", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
  if (!clinicId) return res.status(403).json({ error: "Clinic ID requis" });
  const date = req.query.date ? String(req.query.date) : new Date().toISOString().slice(0, 10);

    const journal = await db.execute(sql`
      SELECT
        e.id,
        e.payment_date,
        e.amount,
        e.payment_method,
        e.reference,
        i.invoice_number,
        i.total_ttc AS invoice_total,
        COALESCE(o.last_name || ' ' || o.first_name, 'Inconnu') AS owner_name
      FROM encaissements e
      LEFT JOIN invoices i ON i.id = e.invoice_id
      LEFT JOIN owners o ON o.id::text = i.owner_id::text
      WHERE e.clinic_id = ${clinicId}
        AND e.payment_date::date = ${date}::date
      ORDER BY e.payment_date
    `);

    const totaux = await db.execute(sql`
      SELECT
        payment_method,
        COUNT(*)::int AS nb,
        SUM(amount)::numeric AS total
      FROM encaissements
      WHERE clinic_id = ${clinicId}
        AND payment_date::date = ${date}::date
      GROUP BY payment_method
    `);

    const grandTotal = (totaux.rows as any[]).reduce((acc, r) => acc + Number(r.total), 0);

    res.json({
      data: {
        date,
        encaissements: journal.rows,
        totaux: totaux.rows,
        grand_total: grandTotal,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// âââ GET /api/comptabilite/impayes ââââââââââââââââââââââââââââââââââââââââââââ
// Liste des factures impayÃ©es avec aging buckets
router.get("/impayes", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
  if (!clinicId) return res.status(403).json({ error: "Clinic ID requis" });
  const impayes = await db.execute(sql`
      SELECT
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.total_ttc,
        COALESCE(i.total_paid, 0) AS total_paid,
        (i.total_ttc - COALESCE(i.total_paid, 0)) AS reste_a_payer,
        (CURRENT_DATE - COALESCE(i.due_date, i.invoice_date)::date)::int AS jours_retard,
        CASE
          WHEN (CURRENT_DATE - COALESCE(i.due_date, i.invoice_date)::date) <= 30 THEN '0-30'
          WHEN (CURRENT_DATE - COALESCE(i.due_date, i.invoice_date)::date) <= 60 THEN '31-60'
          WHEN (CURRENT_DATE - COALESCE(i.due_date, i.invoice_date)::date) <= 90 THEN '61-90'
          ELSE '90+'
        END AS aging_bucket,
        COALESCE(o.last_name || ' ' || o.first_name, 'Inconnu') AS owner_name,
        o.email AS owner_email,
        o.phone_mobile AS owner_phone,
        -- DerniÃ¨re relance
        (SELECT MAX(r.sent_at) FROM relances r WHERE r.invoice_id = i.id) AS derniere_relance,
        (SELECT COUNT(*)::int FROM relances r WHERE r.invoice_id = i.id) AS nb_relances
      FROM invoices i
      LEFT JOIN owners o ON o.id::text = i.owner_id::text
      WHERE i.clinic_id = ${clinicId}
        AND i.document_type = 'FACTURE'
        AND i.status IN ('FACTURE','EN_ATTENTE','CONTROLE')
        AND (i.total_ttc - COALESCE(i.total_paid, 0)) > 0
      ORDER BY jours_retard DESC, i.invoice_date
    `);

    // RÃ©sumÃ© par bucket
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    let totalImpayes = 0;
    for (const row of impayes.rows as any[]) {
      buckets[row.aging_bucket as keyof typeof buckets] += Number(row.reste_a_payer);
      totalImpayes += Number(row.reste_a_payer);
    }

    res.json({
      data: {
        impayes: impayes.rows,
        buckets,
        total_impayes: totalImpayes,
        nb_impayes: impayes.rows.length,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// âââ POST /api/comptabilite/relances âââââââââââââââââââââââââââââââââââââââââ
// Enregistrer une relance manuelle (email envoyÃ© cÃ´tÃ© client)
router.post("/relances", requireAuth(), async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const clinicId = (req as any).clinicId;
  if (!clinicId) return res.status(403).json({ error: "Clinic ID requis" });
  const { invoiceId, channel, recipientEmail, recipientName, message } = req.body;

    if (!invoiceId) return res.status(400).json({ error: "invoiceId requis" });

    // VÃ©rifier que la facture appartient Ã  la clinique
    const check = await db.execute(sql`
      SELECT id FROM invoices
      WHERE id = ${invoiceId} AND clinic_id = ${clinicId}
      LIMIT 1
    `);
    if (!check.rows.length) return res.status(404).json({ error: "Facture non trouvÃ©e" });

    const [row] = await db.execute(sql`
      INSERT INTO relances (clinic_id, invoice_id, sent_by, channel, recipient_email, recipient_name, message, status)
      VALUES (${clinicId}, ${invoiceId}, ${userId}, ${channel || 'email'}, ${recipientEmail || null}, ${recipientName || null}, ${message || null}, 'sent')
      RETURNING *
    `);

    res.status(201).json({ data: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
