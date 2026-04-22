import { Router } from "express";
import { db } from "@workspace/db";
import { vaccinationsTable, patientsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/patient/:patientId", async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    if (isNaN(patientId)) return res.status(400).json({ error: "ID invalide" });
    const vaccinations = await db
      .select()
      .from(vaccinationsTable)
      .where(and(
        eq(vaccinationsTable.patientId, patientId),
        eq(vaccinationsTable.clinicId, req.clinicId),
      ))
      .orderBy(desc(vaccinationsTable.dateInjection));
    return res.json(vaccinations);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { patientId, nomVaccin, dateInjection, dateRappel, lotNumero, fabricant, voieInjection, veterinaire, notes } = req.body;
    if (!patientId || !nomVaccin || !dateInjection) {
      return res.status(400).json({ error: "patientId, nomVaccin et dateInjection sont requis" });
    }
    // Vérifier que le patient appartient à la clinique
    const [patient] = await db.select({ id: patientsTable.id }).from(patientsTable)
      .where(and(eq(patientsTable.id, parseInt(patientId)), eq(patientsTable.clinicId, req.clinicId)));
    if (!patient) return res.status(404).json({ error: "Patient introuvable" });

    const [vac] = await db.insert(vaccinationsTable).values({
      patientId: parseInt(patientId),
      clinicId: req.clinicId,
      nomVaccin, dateInjection, dateRappel, lotNumero, fabricant, voieInjection, veterinaire, notes,
    }).returning();
    return res.status(201).json(vac);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const { clinicId: _ignored, ...payload } = req.body;
    const [vac] = await db.update(vaccinationsTable).set(payload).where(and(
      eq(vaccinationsTable.id, id),
      eq(vaccinationsTable.clinicId, req.clinicId),
    )).returning();
    if (!vac) return res.status(404).json({ error: "Vaccination non trouvée" });
    return res.json(vac);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    await db.delete(vaccinationsTable).where(and(
      eq(vaccinationsTable.id, id),
      eq(vaccinationsTable.clinicId, req.clinicId),
    ));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
