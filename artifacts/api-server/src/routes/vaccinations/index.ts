import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "../../../db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── GET /api/vaccinations ─── Liste par clinique avec rappels dus
router.get("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { patientId, upcoming } = req.query;

    let whereExtra = "";
    if (patientId) whereExtra += ` AND v.patient_id = ${Number(patientId)}`;
    if (upcoming === "true") whereExtra += ` AND v.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'`;

    const rows = await db.execute(sql.raw(`
      SELECT
        v.*,
        p.name AS patient_name, p.species AS patient_species, p.breed AS patient_breed,
        COALESCE(o.last_name || ' ' || o.first_name, 'Inconnu') AS owner_name,
        o.email AS owner_email, o.phone_mobile AS owner_phone,
        -- Rappel existant
        (SELECT vr.status FROM vaccination_reminders vr WHERE vr.vaccination_id = v.id ORDER BY vr.created_at DESC LIMIT 1) AS reminder_status,
        -- Jours avant rappel
        (v.next_due_date - CURRENT_DATE)::int AS jours_avant_rappel
      FROM vaccinations v
      JOIN patients p ON p.id = v.patient_id
      LEFT JOIN owners o ON o.id::text = p.owner_id::text
      WHERE v.clinic_id = '${clinicId}'
      ${whereExtra}
      ORDER BY v.next_due_date ASC NULLS LAST, v.vaccine_date DESC
    `));
    res.json({ data: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vaccinations ─── Enregistrer une vaccination
router.post("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { userId } = (req as any).auth || {};
    const { patientId, ownerId, vaccineType, vaccineName, vaccineDate, nextDueDate, batchNumber, notes, consultationId } = req.body;
    if (!patientId || !vaccineType || !vaccineDate) return res.status(400).json({ error: "patientId, vaccineType, vaccineDate requis" });

    const [row] = await db.execute(sql`
      INSERT INTO vaccinations (clinic_id, patient_id, owner_id, vaccine_type, vaccine_name, vaccine_date, next_due_date, batch_number, notes, consultation_id, created_by)
      VALUES (${clinicId}, ${Number(patientId)}, ${ownerId ? Number(ownerId) : null},
              ${vaccineType}, ${vaccineName||null}, ${vaccineDate}, ${nextDueDate||null},
              ${batchNumber||null}, ${notes||null}, ${consultationId ? Number(consultationId) : null}, ${userId||null})
      RETURNING *
    `);

    // Créer un rappel auto si nextDueDate est renseigné
    if (nextDueDate) {
      // Rappel 30 jours avant
      const reminderDate = new Date(nextDueDate);
      reminderDate.setDate(reminderDate.getDate() - 30);

      // Récupérer l'email du propriétaire
      const owner = await db.execute(sql`
        SELECT o.email, o.phone_mobile, o.last_name, o.first_name
        FROM patients p
        LEFT JOIN owners o ON o.id::text = p.owner_id::text
        WHERE p.id = ${Number(patientId)}
        LIMIT 1
      `);
      const ownerData = owner.rows[0] as any;

      await db.execute(sql`
        INSERT INTO vaccination_reminders (clinic_id, vaccination_id, patient_id, owner_id, reminder_date, channel, recipient_email, recipient_phone)
        VALUES (${clinicId}, ${(row as any).id}, ${Number(patientId)}, ${ownerId ? Number(ownerId) : null},
                ${reminderDate.toISOString().slice(0,10)}, 'email',
                ${ownerData?.email || null}, ${ownerData?.phone_mobile || null})
      `).catch(() => {});
    }

    res.status(201).json({ data: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vaccinations/rappels ─── Rappels à envoyer aujourd'hui + en retard
router.get("/rappels", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;

    const rappels = await db.execute(sql`
      SELECT
        vr.*,
        v.vaccine_type, v.vaccine_name, v.next_due_date,
        p.name AS patient_name, p.species,
        COALESCE(o.last_name || ' ' || o.first_name, 'Inconnu') AS owner_name,
        o.email AS owner_email, o.phone_mobile AS owner_phone
      FROM vaccination_reminders vr
      JOIN vaccinations v ON v.id = vr.vaccination_id
      JOIN patients p ON p.id = vr.patient_id
      LEFT JOIN owners o ON o.id::text = p.owner_id::text
      WHERE vr.clinic_id = ${clinicId}
        AND vr.status = 'PENDING'
        AND vr.reminder_date <= CURRENT_DATE
      ORDER BY v.next_due_date ASC
    `);

    res.json({ data: rappels.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vaccinations/rappels/:id/send ─── Marquer rappel comme envoyé
router.post("/rappels/:id/send", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { message } = req.body;

    await db.execute(sql`
      UPDATE vaccination_reminders SET
        status = 'SENT', sent_at = NOW(), message = ${message||null}
      WHERE id = ${Number(req.params.id)} AND clinic_id = ${clinicId}
    `);

    // Logguer dans communications
    const reminder = await db.execute(sql`
      SELECT vr.*, p.name AS patient_name, o.email, o.last_name, o.first_name
      FROM vaccination_reminders vr
      JOIN patients p ON p.id = vr.patient_id
      LEFT JOIN owners o ON o.id::text = p.owner_id::text
      WHERE vr.id = ${Number(req.params.id)}
      LIMIT 1
    `);
    const r = reminder.rows[0] as any;
    if (r) {
      await db.execute(sql`
        INSERT INTO communications (clinic_id, type, channel, recipient_email, recipient_name, subject, body, status, ref_id, ref_type, sent_at)
        VALUES (${clinicId}, 'VACCINATION_REMINDER', 'email', ${r.email||null}, ${r.last_name ? r.last_name + ' ' + r.first_name : null},
                ${`Rappel vaccin — ${r.patient_name}`}, ${message||null}, 'SENT', ${Number(req.params.id)}, 'vaccination', NOW())
      `).catch(() => {});
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vaccinations/stats ─── Stats rapides
router.get("/stats", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const stats = await db.execute(sql`
      SELECT
        COUNT(DISTINCT v.id)::int AS total_vaccins,
        COUNT(DISTINCT CASE WHEN v.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN v.id END)::int AS rappels_30j,
        COUNT(DISTINCT CASE WHEN v.next_due_date < CURRENT_DATE THEN v.id END)::int AS rappels_en_retard,
        COUNT(DISTINCT CASE WHEN vr.status = 'PENDING' AND vr.reminder_date <= CURRENT_DATE THEN vr.id END)::int AS relances_pending
      FROM vaccinations v
      LEFT JOIN vaccination_reminders vr ON vr.vaccination_id = v.id
      WHERE v.clinic_id = ${clinicId}
    `);
    res.json({ data: stats.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
