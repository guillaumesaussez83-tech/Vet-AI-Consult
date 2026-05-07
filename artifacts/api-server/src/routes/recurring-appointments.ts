import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// GET /api/recurring-appointments
router.get("/", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    const rows = await db.execute(sql`
      SELECT ra.*, p.nom as patient_nom, o.nom as owner_nom, o.prenom as owner_prenom
      FROM recurring_appointments ra
      LEFT JOIN patients p ON p.id = ra.patient_id
      LEFT JOIN owners o ON o.id = ra.owner_id
      WHERE ra.clinic_id = ${clinicId} AND ra.active = true
      ORDER BY ra.created_at DESC
    `);
    res.json({ success: true, data: rows.rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/recurring-appointments
router.post("/", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    const { patientId, ownerId, veterinaire, veterinaireId, motif, typeRdv, dureeMinutes,
            frequency, dayOfWeek, timeOfDay, startDate, endDate, notes } = req.body;
    const now = new Date().toISOString();

    const result = await db.execute(sql`
      INSERT INTO recurring_appointments (clinic_id, patient_id, owner_id, veterinaire, veterinaire_id,
        motif, type_rdv, duree_minutes, frequency, day_of_week, time_of_day, start_date, end_date, notes,
        active, created_at, updated_at)
      VALUES (${clinicId}, ${patientId || null}, ${ownerId || null}, ${veterinaire || null},
        ${veterinaireId || null}, ${motif || null}, ${typeRdv || "CONSULTATION"},
        ${dureeMinutes || 30}, ${frequency || "MONTHLY"}, ${dayOfWeek ?? null},
        ${timeOfDay || "09:00"}, ${startDate || null}, ${endDate || null},
        ${notes || null}, true, ${now}, ${now})
      RETURNING id
    `);

    const id = (result.rows[0] as any).id;
    // Générer les prochains RDV automatiquement
    await generateNextAppointments(clinicId, id, 12);

    res.json({ success: true, data: { id } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/recurring-appointments/:id/generate — génère les prochains RDV
router.post("/:id/generate", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    const { count = 12 } = req.body;
    const generated = await generateNextAppointments(clinicId, parseInt(req.params.id), count);
    res.json({ success: true, data: { generated } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/recurring-appointments/:id
router.delete("/:id", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    await db.execute(sql`
      UPDATE recurring_appointments SET active = false, updated_at = NOW()
      WHERE id = ${req.params.id} AND clinic_id = ${clinicId}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

async function generateNextAppointments(clinicId: string, recurringId: number, count: number): Promise<number> {
  const rows = await db.execute(sql`
    SELECT * FROM recurring_appointments WHERE id = ${recurringId} AND clinic_id = ${clinicId}
  `);
  if (rows.rows.length === 0) return 0;
  const rec = rows.rows[0] as any;

  // Calculer les prochaines dates
  const dates: Date[] = [];
  let current = rec.start_date ? new Date(rec.start_date) : new Date();
  const endDate = rec.end_date ? new Date(rec.end_date) : null;
  const [h, m] = (rec.time_of_day || "09:00").split(":").map(Number);

  for (let i = 0; i < count; i++) {
    const d = new Date(current);
    d.setHours(h, m, 0, 0);
    if (endDate && d > endDate) break;
    if (d > new Date()) dates.push(new Date(d));

    // Avancer selon la fréquence
    switch (rec.frequency) {
      case "WEEKLY":     current.setDate(current.getDate() + 7);    break;
      case "BIWEEKLY":   current.setDate(current.getDate() + 14);   break;
      case "MONTHLY":    current.setMonth(current.getMonth() + 1);  break;
      case "QUARTERLY":  current.setMonth(current.getMonth() + 3);  break;
      case "YEARLY":     current.setFullYear(current.getFullYear() + 1); break;
    }
  }

  let created = 0;
  for (const dateHeure of dates) {
    // Vérifier si le RDV existe déjà
    const exists = await db.execute(sql`
      SELECT id FROM rendez_vous WHERE clinic_id = ${clinicId}
        AND patient_id = ${rec.patient_id} AND date_heure = ${dateHeure.toISOString()}
    `);
    if (exists.rows.length > 0) continue;

    // Récupérer infos patient/owner
    let patientNom = "", ownerNom = "", ownerTel = "";
    if (rec.patient_id) {
      const pr = await db.execute(sql`SELECT nom FROM patients WHERE id = ${rec.patient_id}`);
      patientNom = (pr.rows[0] as any)?.nom || "";
    }
    if (rec.owner_id) {
      const or = await db.execute(sql`SELECT nom, prenom, telephone FROM owners WHERE id = ${rec.owner_id}`);
      const o = or.rows[0] as any;
      ownerNom = o ? `${o.nom} ${o.prenom}` : "";
      ownerTel = o?.telephone || "";
    }

    await db.execute(sql`
      INSERT INTO rendez_vous (clinic_id, date_heure, duree_minutes, patient_id, owner_id,
        veterinaire, veterinaire_id, motif, type_rdv, proprietaire_nom, proprietaire_telephone,
        animal_nom, statut, notes, created_at)
      VALUES (${clinicId}, ${dateHeure.toISOString()}, ${rec.duree_minutes || 30},
        ${rec.patient_id || null}, ${rec.owner_id || null},
        ${rec.veterinaire || null}, ${rec.veterinaire_id || null},
        ${rec.motif || null}, ${rec.type_rdv || "CONSULTATION"},
        ${ownerNom || null}, ${ownerTel || null}, ${patientNom || null},
        'CONFIRME', ${rec.notes ? `RDV récurrent: ${rec.notes}` : "RDV récurrent"},
        NOW())
    `);
    created++;
  }

  await db.execute(sql`
    UPDATE recurring_appointments SET last_generated_at = NOW() WHERE id = ${recurringId}
  `);

  return created;
}

export default router;
