import { Router } from "express";
import { db } from "@workspace/db";
import { rendezVousTable, patientsTable, ownersTable } from "@workspace/db";
import { eq, and, gte, lte, asc } from "drizzle-orm";

const router = Router();

const selectRdv = {
  id: rendezVousTable.id,
  dateHeure: rendezVousTable.dateHeure,
  dureeMinutes: rendezVousTable.dureeMinutes,
  patientId: rendezVousTable.patientId,
  ownerId: rendezVousTable.ownerId,
  veterinaire: rendezVousTable.veterinaire,
  motif: rendezVousTable.motif,
  statut: rendezVousTable.statut,
  statutSalle: rendezVousTable.statutSalle,
  notes: rendezVousTable.notes,
  createdAt: rendezVousTable.createdAt,
  updatedAt: rendezVousTable.updatedAt,
  patient: {
    id: patientsTable.id,
    nom: patientsTable.nom,
    espece: patientsTable.espece,
  },
  owner: {
    id: ownersTable.id,
    nom: ownersTable.nom,
    prenom: ownersTable.prenom,
    telephone: ownersTable.telephone,
    email: ownersTable.email,
  },
};

function formatRdv(r: typeof selectRdv & { createdAt: Date; updatedAt: Date }) {
  return { ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}

router.get("/", async (req, res) => {
  try {
    const { from, to, veterinaire } = req.query;

    const conditions = [];
    if (from) conditions.push(gte(rendezVousTable.dateHeure, from as string));
    if (to) conditions.push(lte(rendezVousTable.dateHeure, to as string));
    if (veterinaire) conditions.push(eq(rendezVousTable.veterinaire, veterinaire as string));

    const rdvs = await db
      .select(selectRdv)
      .from(rendezVousTable)
      .leftJoin(patientsTable, eq(rendezVousTable.patientId, patientsTable.id))
      .leftJoin(ownersTable, eq(rendezVousTable.ownerId, ownersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(rendezVousTable.dateHeure));

    return res.json(rdvs.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.get("/salle-attente", async (req, res) => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const from = `${dateStr}T00:00:00`;
    const to = `${dateStr}T23:59:59`;

    const rdvs = await db
      .select(selectRdv)
      .from(rendezVousTable)
      .leftJoin(patientsTable, eq(rendezVousTable.patientId, patientsTable.id))
      .leftJoin(ownersTable, eq(rendezVousTable.ownerId, ownersTable.id))
      .where(and(
        gte(rendezVousTable.dateHeure, from),
        lte(rendezVousTable.dateHeure, to),
      ))
      .orderBy(asc(rendezVousTable.dateHeure));

    return res.json(rdvs.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { dateHeure, dureeMinutes, patientId, ownerId, veterinaire, motif, statut, notes } = req.body;
    if (!dateHeure) return res.status(400).json({ error: "dateHeure est requis" });
    const [rdv] = await db.insert(rendezVousTable).values({
      dateHeure,
      dureeMinutes: dureeMinutes ?? 30,
      patientId: patientId ? parseInt(patientId) : null,
      ownerId: ownerId ? parseInt(ownerId) : null,
      veterinaire, motif,
      statut: statut ?? "planifié",
      statutSalle: "en_attente_arrivee",
      notes,
    }).returning();
    return res.status(201).json(rdv);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.patch("/:id/statut-salle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const { statutSalle } = req.body;
    if (!statutSalle) return res.status(400).json({ error: "statutSalle est requis" });
    const VALID = ["en_attente_arrivee", "arrive", "en_consultation", "en_attente_resultat", "a_encaisser", "termine"];
    if (!VALID.includes(statutSalle)) return res.status(400).json({ error: "Statut invalide" });

    const rdvs = await db
      .update(rendezVousTable)
      .set({ statutSalle })
      .where(eq(rendezVousTable.id, id))
      .returning();

    if (!rdvs[0]) return res.status(404).json({ error: "RDV non trouvé" });

    const full = await db
      .select(selectRdv)
      .from(rendezVousTable)
      .leftJoin(patientsTable, eq(rendezVousTable.patientId, patientsTable.id))
      .leftJoin(ownersTable, eq(rendezVousTable.ownerId, ownersTable.id))
      .where(eq(rendezVousTable.id, id))
      .limit(1);

    return res.json(full[0] ? { ...full[0], createdAt: full[0].createdAt.toISOString(), updatedAt: full[0].updatedAt.toISOString() } : rdvs[0]);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const [rdv] = await db.update(rendezVousTable).set(req.body).where(eq(rendezVousTable.id, id)).returning();
    if (!rdv) return res.status(404).json({ error: "RDV non trouvé" });
    return res.json(rdv);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    await db.delete(rendezVousTable).where(eq(rendezVousTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
