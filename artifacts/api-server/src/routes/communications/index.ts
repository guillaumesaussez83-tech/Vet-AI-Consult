import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── GET /api/communications ─── Journal des communications
router.get("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { type, status, limit = 50 } = req.query;

    let whereExtra = "";
    if (type) whereExtra += ` AND type = '${String(type)}'`;
    if (status) whereExtra += ` AND status = '${String(status)}'`;

    const rows = await db.execute(sql.raw(`
      SELECT * FROM communications
      WHERE clinic_id = '${clinicId}' ${whereExtra}
      ORDER BY created_at DESC
      LIMIT ${Number(limit)}
    `));

    const stats = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status = 'SENT' THEN 1 END)::int AS sent,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int AS pending,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int AS failed
      FROM communications WHERE clinic_id = ${clinicId}
    `);

    return res.json({ data: { communications: rows.rows, stats: stats.rows[0] } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/communications/post-consultation ─── Résumé auto post-consultation
router.post("/post-consultation", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { userId } = (req as any).auth || {};
    const { consultationId } = req.body;
    if (!consultationId) return res.status(400).json({ error: "consultationId requis" });

    // Récupérer les données de la consultation
    const consult = await db.execute(sql`
      SELECT
        c.id, c.motif, c.diagnostic, c.traitement, c.notes_clinicien, c.visit_date,
        p.name AS patient_name, p.species, p.breed,
        COALESCE(o.last_name || ' ' || o.first_name, 'Propriétaire') AS owner_name,
        o.email AS owner_email, o.first_name AS owner_first_name
      FROM consultations c
      JOIN patients p ON p.id = c.patient_id
      LEFT JOIN owners o ON o.id::text = p.owner_id::text
      WHERE c.id = ${Number(consultationId)} AND c.clinic_id = ${clinicId}
      LIMIT 1
    `);

    if (!consult.rows.length) return res.status(404).json({ error: "Consultation non trouvée" });
    const c = consult.rows[0] as any;

    if (!c.owner_email) return res.status(400).json({ error: "Email propriétaire non renseigné" });

    // Construire le résumé
    const visitDate = new Date(c.visit_date).toLocaleDateString("fr-FR");
    const subject = `Résumé de la consultation — ${c.patient_name} — ${visitDate}`;
    const body = `Bonjour ${c.owner_first_name || c.owner_name},

Suite à la consultation de ${c.patient_name} (${c.species}${c.breed ? `, ${c.breed}` : ""}) du ${visitDate}, voici le résumé :

**Motif de consultation :** ${c.motif || "—"}

**Diagnostic :** ${c.diagnostic || "—"}

**Traitement prescrit :** ${c.traitement || "—"}

${c.notes_clinicien ? `**Notes :** ${c.notes_clinicien}` : ""}

Pour toute question, n'hésitez pas à nous contacter.

Cordialement,
L'équipe vétérinaire`;

    const [comm] = await db.execute(sql`
      INSERT INTO communications (clinic_id, type, channel, recipient_email, recipient_name, subject, body, status, ref_id, ref_type, sent_at, created_by)
      VALUES (${clinicId}, 'POST_CONSULTATION', 'email', ${c.owner_email}, ${c.owner_name}, ${subject}, ${body}, 'SENT', ${Number(consultationId)}, 'consultation', NOW(), ${userId||null})
      RETURNING *
    `);

    return res.status(201).json({ data: { communication: comm, subject, body, recipientEmail: c.owner_email } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/communications/relance-impaye ─── Relance automatique multi-étapes
router.post("/relance-impaye", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { userId } = (req as any).auth || {};

    // Récupérer toutes les factures impayées avec nb relances
    const impayes = await db.execute(sql`
      SELECT
        i.id, i.invoice_number, i.invoice_date, i.total_ttc, i.due_date,
        (i.total_ttc - COALESCE(i.total_paid, 0)) AS reste_a_payer,
        (CURRENT_DATE - COALESCE(i.due_date, i.invoice_date)::date)::int AS jours_retard,
        COALESCE(o.last_name || ' ' || o.first_name, 'Inconnu') AS owner_name,
        o.email AS owner_email,
        COUNT(r.id)::int AS nb_relances,
        MAX(r.sent_at) AS derniere_relance
      FROM invoices i
      LEFT JOIN owners o ON o.id::text = i.owner_id::text
      LEFT JOIN relances r ON r.invoice_id = i.id
      WHERE i.clinic_id = ${clinicId}
        AND i.document_type = 'FACTURE'
        AND i.status IN ('FACTURE', 'EN_ATTENTE')
        AND (i.total_ttc - COALESCE(i.total_paid, 0)) > 0
        AND o.email IS NOT NULL
      GROUP BY i.id, o.last_name, o.first_name, o.email
      HAVING (
        COUNT(r.id) = 0
        OR MAX(r.sent_at) < NOW() - INTERVAL '7 days'
      )
      ORDER BY jours_retard DESC
    `);

    const results = [];
    for (const inv of impayes.rows as any[]) {
      const step = Math.min(inv.nb_relances + 1, 3); // max 3 étapes
      const tone = step === 1 ? "cordiale" : step === 2 ? "ferme" : "mise en demeure";

      const fmt = (n: number) => Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
      const dueDate = inv.due_date ? new Date(inv.due_date).toLocaleDateString("fr-FR") : new Date(inv.invoice_date).toLocaleDateString("fr-FR");

      const messages: Record<number, string> = {
        1: `Bonjour ${inv.owner_name},\n\nNous nous permettons de vous rappeler que la facture ${inv.invoice_number} d'un montant de ${fmt(inv.reste_a_payer)} est arrivée à échéance le ${dueDate}.\n\nNous vous remercions de bien vouloir procéder au règlement dans les plus brefs délais.\n\nCordialement,\nL'équipe vétérinaire`,
        2: `Bonjour ${inv.owner_name},\n\nMalgré notre précédent rappel, la facture ${inv.invoice_number} d'un montant de ${fmt(inv.reste_a_payer)} reste impayée depuis ${inv.jours_retard} jours.\n\nNous vous demandons de régulariser cette situation sous 5 jours ouvrés, faute de quoi nous nous verrons dans l'obligation de prendre des mesures supplémentaires.\n\nCordialement,\nL'équipe vétérinaire`,
        3: `Bonjour ${inv.owner_name},\n\nNous constatons, malgré nos relances précédentes, que la facture ${inv.invoice_number} d'un montant de ${fmt(inv.reste_a_payer)} demeure impayée depuis ${inv.jours_retard} jours.\n\nSans règlement de votre part dans les 48 heures, nous serons contraints de transmettre ce dossier à notre service de recouvrement.\n\nCordialement,\nL'équipe vétérinaire`,
      };

      const message = messages[step];

      // Enregistrer la relance
      await db.execute(sql`
        INSERT INTO relances (clinic_id, invoice_id, sent_by, channel, recipient_email, recipient_name, message, status)
        VALUES (${clinicId}, ${inv.id}, ${userId||'system'}, 'email', ${inv.owner_email}, ${inv.owner_name}, ${message}, 'sent')
      `);

      // Logguer dans communications
      await db.execute(sql`
        INSERT INTO communications (clinic_id, type, channel, recipient_email, recipient_name, subject, body, status, ref_id, ref_type, sent_at, created_by)
        VALUES (${clinicId}, 'RELANCE_IMPAYE', 'email', ${inv.owner_email}, ${inv.owner_name},
                ${`Relance ${step}/3 — ${inv.invoice_number}`}, ${message}, 'SENT', ${inv.id}, 'invoice', NOW(), ${userId||null})
      `);

      results.push({ invoiceId: inv.id, invoiceNumber: inv.invoice_number, step, tone, recipientEmail: inv.owner_email });
    }

    return res.json({ data: { relancesEnvoyees: results.length, details: results } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/communications/custom ─── Envoyer une communication manuelle
router.post("/custom", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { userId } = (req as any).auth || {};
    const { recipientEmail, recipientName, subject, body, channel = 'email', refId, refType } = req.body;
    if (!recipientEmail || !subject || !body) return res.status(400).json({ error: "recipientEmail, subject, body requis" });

    const [comm] = await db.execute(sql`
      INSERT INTO communications (clinic_id, type, channel, recipient_email, recipient_name, subject, body, status, ref_id, ref_type, sent_at, created_by)
      VALUES (${clinicId}, 'CUSTOM', ${channel}, ${recipientEmail}, ${recipientName||null}, ${subject}, ${body}, 'SENT', ${refId||null}, ${refType||null}, NOW(), ${userId||null})
      RETURNING *
    `);
    return res.status(201).json({ data: comm });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
