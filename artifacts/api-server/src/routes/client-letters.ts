import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// GET /api/client-letters?ownerId=X
router.get("/", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    const { ownerId } = req.query;
    let query = sql`
      SELECT cl.*, p.nom as patient_nom
      FROM client_letters cl
      LEFT JOIN patients p ON p.id = cl.patient_id
      WHERE cl.clinic_id = ${clinicId}
    `;
    if (ownerId) {
      query = sql`
        SELECT cl.*, p.nom as patient_nom
        FROM client_letters cl
        LEFT JOIN patients p ON p.id = cl.patient_id
        WHERE cl.clinic_id = ${clinicId} AND cl.owner_id = ${ownerId}
        ORDER BY cl.created_at DESC
      `;
    } else {
      query = sql`
        SELECT cl.*, p.nom as patient_nom, o.nom as owner_nom, o.prenom as owner_prenom
        FROM client_letters cl
        LEFT JOIN patients p ON p.id = cl.patient_id
        LEFT JOIN owners o ON o.id = cl.owner_id
        WHERE cl.clinic_id = ${clinicId}
        ORDER BY cl.created_at DESC LIMIT 100
      `;
    }
    const rows = await db.execute(query);
    res.json({ success: true, data: rows.rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/client-letters
router.post("/", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    const userId = req.auth?.userId;
    const { ownerId, patientId, type, subject, content, sendNow } = req.body;
    if (!ownerId || !subject || !content) {
      return res.status(400).json({ success: false, error: "ownerId, subject, content requis" });
    }
    const now = new Date().toISOString();
    const result = await db.execute(sql`
      INSERT INTO client_letters (clinic_id, owner_id, patient_id, type, subject, content, sent_at, created_by, created_at)
      VALUES (${clinicId}, ${ownerId}, ${patientId || null}, ${type || "AUTRE"}, ${subject}, ${content},
        ${sendNow ? now : null}, ${userId || null}, ${now})
      RETURNING id
    `);
    res.json({ success: true, data: { id: (result.rows[0] as any).id } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/client-letters/:id/send — marquer comme envoyé
router.put("/:id/send", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    await db.execute(sql`
      UPDATE client_letters SET sent_at = NOW()
      WHERE id = ${req.params.id} AND clinic_id = ${clinicId}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/client-letters/:id
router.delete("/:id", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    await db.execute(sql`
      DELETE FROM client_letters WHERE id = ${req.params.id} AND clinic_id = ${clinicId}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
