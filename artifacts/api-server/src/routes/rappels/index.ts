import { Router } from "express";
import { db } from "@workspace/db";
import { rappelsModelesTable, consultationsTable, patientsTable, ownersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/modeles", async (req, res) => {
  try {
    const modeles = await db.select().from(rappelsModelesTable).orderBy(rappelsModelesTable.nom);
    return res.json(modeles.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/modeles", async (req, res) => {
  try {
    const { nom, description, periodiciteJours } = req.body;
    if (!nom || !periodiciteJours) return res.status(400).json({ error: "Données invalides" });
    const [modele] = await db.insert(rappelsModelesTable).values({
      nom,
      description: description || null,
      periodiciteJours: parseInt(periodiciteJours),
    }).returning();
    return res.status(201).json({ ...modele, createdAt: modele.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.delete("/modeles/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const [deleted] = await db.delete(rappelsModelesTable).where(eq(rappelsModelesTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Modèle non trouvé" });
    return res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

router.get("/dus", async (req, res) => {
  try {
    const modeles = await db.select().from(rappelsModelesTable).where(eq(rappelsModelesTable.actif, true));

    const consultations = await db
      .select({
        id: consultationsTable.id,
        date: consultationsTable.date,
        motif: consultationsTable.motif,
        patientId: consultationsTable.patientId,
        patient: {
          id: patientsTable.id,
          nom: patientsTable.nom,
          espece: patientsTable.espece,
          race: patientsTable.race,
          dateNaissance: patientsTable.dateNaissance,
          agressif: patientsTable.agressif,
        },
        owner: {
          id: ownersTable.id,
          nom: ownersTable.nom,
          prenom: ownersTable.prenom,
          telephone: ownersTable.telephone,
          email: ownersTable.email,
        },
      })
      .from(consultationsTable)
      .leftJoin(patientsTable, eq(consultationsTable.patientId, patientsTable.id))
      .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id))
      .orderBy(desc(consultationsTable.date));

    const today = new Date();

    const lastConsultationByPatient = new Map<number, string>();
    for (const c of consultations) {
      if (c.patientId && !lastConsultationByPatient.has(c.patientId)) {
        lastConsultationByPatient.set(c.patientId, c.date);
      }
    }

    const patientsUniques = new Map<number, typeof consultations[0]>();
    for (const c of consultations) {
      if (c.patientId && !patientsUniques.has(c.patientId)) {
        patientsUniques.set(c.patientId, c);
      }
    }

    const dus: any[] = [];
    for (const [patientId, derniereCons] of lastConsultationByPatient.entries()) {
      const derniere = new Date(derniereCons);
      const joursEcoules = Math.floor((today.getTime() - derniere.getTime()) / (1000 * 60 * 60 * 24));
      const consult = patientsUniques.get(patientId);
      if (!consult) continue;

      for (const modele of modeles) {
        if (joursEcoules >= modele.periodiciteJours) {
          const joursRetard = joursEcoules - modele.periodiciteJours;
          dus.push({
            modele,
            patient: consult.patient,
            owner: consult.owner,
            derniereConsultation: derniereCons,
            joursEcoules,
            joursRetard,
            urgent: joursRetard > 30,
          });
        }
      }
    }

    dus.sort((a, b) => b.joursRetard - a.joursRetard);

    return res.json(dus);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

export default router;
