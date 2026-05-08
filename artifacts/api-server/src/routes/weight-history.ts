import { Router } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
router.use(requireAuth());

// GET /api/weight-history/:patientId
router.get("/:patientId", async (req: any, res) => {
  try {
      const patientId = parseInt(req.params.patientId);
  if (isNaN(patientId)) return res.status(400).json({ error: "patientId invalide" });
  const clinicId = req.auth?.sessionClaims?.clinicId as string;
    const rows = await db.execute(sql`
      SELECT wh.*, c.motif as consultation_motif
      FROM weight_history wh
      LEFT JOIN consultations c ON c.id = wh.consultation_id
      WHERE wh.patient_id = ${req.params.patientId} AND wh.clinic_id = ${clinicId}
      ORDER BY wh.measured_at ASC
    `);
    res.json({ success: true, data: rows.rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/weight-history
router.post("/", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    const { patientId, weight, measuredAt, consultationId, notes } = req.body;
    if (!patientId || !weight) return res.status(400).json({ success: false, error: "patientId et weight requis" });

    const ts = measuredAt || new Date().toISOString();
    const result = await db.execute(sql`
      INSERT INTO weight_history (clinic_id, patient_id, weight, measured_at, consultation_id, notes, created_at)
      VALUES (${clinicId}, ${patientId}, ${weight}, ${ts}, ${consultationId || null}, ${notes || null}, NOW())
      RETURNING id
    `);

    // Mettre à jour aussi la colonne poids courante sur le patient
    await db.execute(sql`
      UPDATE patients SET poids = ${weight} WHERE id = ${patientId} AND clinic_id = ${clinicId}
    `);

    res.json({ success: true, data: { id: (result.rows[0] as any).id } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/weight-history/:id
router.delete("/:id", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    await db.execute(sql`
      DELETE FROM weight_history WHERE id = ${req.params.id} AND clinic_id = ${clinicId}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
