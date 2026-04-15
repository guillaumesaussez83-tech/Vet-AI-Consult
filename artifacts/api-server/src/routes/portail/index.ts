import { Router } from "express";
import { db } from "@workspace/db";
import { portailTokensTable, ownersTable, patientsTable, consultationsTable, vaccinationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [tokenRecord] = await db.select().from(portailTokensTable)
      .where(eq(portailTokensTable.token, token));
    if (!tokenRecord) return res.status(404).json({ error: "Lien invalide ou expiré" });

    const [owner] = await db.select().from(ownersTable).where(eq(ownersTable.id, tokenRecord.ownerId));
    if (!owner) return res.status(404).json({ error: "Propriétaire introuvable" });

    const patients = await db.select().from(patientsTable).where(eq(patientsTable.ownerId, owner.id));

    const patientsWithData = await Promise.all(patients.map(async (patient) => {
      const [lastConsultation] = await db.select().from(consultationsTable)
        .where(eq(consultationsTable.patientId, patient.id))
        .orderBy(desc(consultationsTable.date))
        .limit(1);

      const vaccinations = await db.select().from(vaccinationsTable)
        .where(eq(vaccinationsTable.patientId, patient.id))
        .orderBy(desc(vaccinationsTable.dateInjection));

      return { ...patient, lastConsultation: lastConsultation ?? null, vaccinations };
    }));

    return res.json({
      owner: {
        nom: owner.nom,
        prenom: owner.prenom,
        email: owner.email,
        telephone: owner.telephone,
      },
      patients: patientsWithData,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.post("/generate/:ownerId", async (req, res) => {
  try {
    const ownerId = parseInt(req.params.ownerId);
    if (isNaN(ownerId)) return res.status(400).json({ error: "ID invalide" });

    const existing = await db.select().from(portailTokensTable)
      .where(eq(portailTokensTable.ownerId, ownerId));

    if (existing.length > 0) {
      return res.json({ token: existing[0].token });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await db.insert(portailTokensTable).values({ ownerId, token });
    return res.status(201).json({ token });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
