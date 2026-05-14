import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { db, consultationPatientsTable, patientsTable, ownersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router({ mergeParams: true });

// GET /api/consultations/:consultationId/patients
router.get("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const consultationId = Number(req.params.consultationId);
    const rows = await db
      .select({
        id: consultationPatientsTable.id,
        patientId: consultationPatientsTable.patientId,
        patientName: patientsTable.nom,
        espece: patientsTable.espece,
        race: patientsTable.race,
        ownerName: ownersTable.nom,
      })
      .from(consultationPatientsTable)
      .innerJoin(patientsTable, eq(patientsTable.id, consultationPatientsTable.patientId))
      .leftJoin(ownersTable, eq(ownersTable.id, patientsTable.ownerId))
      .where(eq(consultationPatientsTable.consultationId, consultationId));
    return res.json({ data: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/consultations/:consultationId/patients
router.post("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const consultationId = Number(req.params.consultationId);
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId required" });
    const [row] = await db
      .insert(consultationPatientsTable)
      .values({ consultationId, patientId: Number(patientId) })
      .onConflictDoNothing()
      .returning();
    return res.status(201).json({ data: row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/consultations/:consultationId/patients/:patientId
router.delete("/:patientId", requireAuth(), async (req: Request, res: Response) => {
  try {
    const consultationId = Number(req.params.consultationId);
    const patientId = Number(req.params.patientId);
    await db
      .delete(consultationPatientsTable)
      .where(and(
        eq(consultationPatientsTable.consultationId, consultationId),
        eq(consultationPatientsTable.patientId, patientId)
      ));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
