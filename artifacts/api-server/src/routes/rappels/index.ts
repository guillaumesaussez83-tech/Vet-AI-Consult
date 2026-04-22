import { Router } from "express";
import { db } from "@workspace/db";
import { rappelsModelesTable, rappelsTable, consultationsTable, patientsTable, ownersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/modeles", async (req, res) => {
  try {
    const modeles = await db.select().from(rappelsModelesTable)
      .where(eq(rappelsModelesTable.clinicId, req.clinicId))
      .orderBy(rappelsModelesTable.nom);
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
      clinicId: req.clinicId,
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
    const [deleted] = await db.delete(rappelsModelesTable).where(and(
      eq(rappelsModelesTable.id, id),
      eq(rappelsModelesTable.clinicId, req.clinicId),
    )).returning();
    if (!deleted) return res.status(404).json({ error: "Modèle non trouvé" });
    return res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

router.get("/dus", async (req, res) => {
  try {
    const cid = req.clinicId;
    const modeles = await db.select().from(rappelsModelesTable).where(and(
      eq(rappelsModelesTable.clinicId, cid),
      eq(rappelsModelesTable.actif, true),
    ));

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
      .where(eq(consultationsTable.clinicId, cid))
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

// ─── Rappels liés à une consultation ─────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const cid = req.clinicId;
    const { consultationId, patientId, statut } = req.query as Record<string, string>;
    let rows;
    if (consultationId) {
      rows = await db.select().from(rappelsTable)
        .where(and(
          eq(rappelsTable.clinicId, cid),
          eq(rappelsTable.consultationId, parseInt(consultationId)),
        ))
        .orderBy(desc(rappelsTable.createdAt));
    } else if (patientId) {
      rows = await db.select().from(rappelsTable)
        .where(and(
          eq(rappelsTable.clinicId, cid),
          eq(rappelsTable.patientId, parseInt(patientId)),
        ))
        .orderBy(desc(rappelsTable.createdAt));
    } else {
      rows = await db.select().from(rappelsTable)
        .where(eq(rappelsTable.clinicId, cid))
        .orderBy(desc(rappelsTable.createdAt));
    }
    if (statut) rows = rows.filter(r => r.statut === statut);
    return res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { consultationId, patientId, label, joursDelai, notes } = req.body;
    if (!label) return res.status(400).json({ error: "label requis" });

    let dateEcheance: string | undefined;
    if (joursDelai != null) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(joursDelai));
      dateEcheance = d.toISOString().split("T")[0];
    }

    const [rappel] = await db.insert(rappelsTable).values({
      clinicId: req.clinicId,
      consultationId: consultationId ? parseInt(consultationId) : null,
      patientId: patientId ? parseInt(patientId) : null,
      label,
      joursDelai: joursDelai != null ? parseInt(joursDelai) : null,
      dateEcheance: dateEcheance ?? null,
      statut: "actif",
      notes: notes ?? null,
    }).returning();

    return res.status(201).json({ ...rappel, createdAt: rappel.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const { statut, notes } = req.body;
    const update: Record<string, unknown> = {};
    if (statut) update.statut = statut;
    if (notes !== undefined) update.notes = notes;
    const [rappel] = await db.update(rappelsTable).set(update).where(and(
      eq(rappelsTable.id, id),
      eq(rappelsTable.clinicId, req.clinicId),
    )).returning();
    if (!rappel) return res.status(404).json({ error: "Rappel non trouvé" });
    return res.json({ ...rappel, createdAt: rappel.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const [deleted] = await db.delete(rappelsTable).where(and(
      eq(rappelsTable.id, id),
      eq(rappelsTable.clinicId, req.clinicId),
    )).returning();
    if (!deleted) return res.status(404).json({ error: "Rappel non trouvé" });
    return res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
