import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable, ownersTable, consultationsTable } from "@workspace/db";
import { CreatePatientBody, GetPatientParams, UpdatePatientBody, UpdatePatientParams, DeletePatientParams, ListPatientsQueryParams, ListPatientConsultationsParams } from "@workspace/api-zod";
import { eq, ilike, or, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const query = ListPatientsQueryParams.safeParse(req.query);
    const { search, ownerId, espece } = query.success ? query.data : {};

    const conditions = [];
    if (ownerId) conditions.push(eq(patientsTable.ownerId, ownerId));
    if (espece) conditions.push(eq(patientsTable.espece, espece));

    const baseQuery = db
      .select({
        id: patientsTable.id,
        nom: patientsTable.nom,
        espece: patientsTable.espece,
        race: patientsTable.race,
        sexe: patientsTable.sexe,
        dateNaissance: patientsTable.dateNaissance,
        poids: patientsTable.poids,
        couleur: patientsTable.couleur,
        sterilise: patientsTable.sterilise,
        ownerId: patientsTable.ownerId,
        antecedents: patientsTable.antecedents,
        allergies: patientsTable.allergies,
        createdAt: patientsTable.createdAt,
        owner: {
          id: ownersTable.id,
          nom: ownersTable.nom,
          prenom: ownersTable.prenom,
          email: ownersTable.email,
          telephone: ownersTable.telephone,
          adresse: ownersTable.adresse,
          createdAt: ownersTable.createdAt,
        },
      })
      .from(patientsTable)
      .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id));

    let patients;
    if (search) {
      patients = await baseQuery.where(
        or(
          ilike(patientsTable.nom, `%${search}%`),
          ilike(patientsTable.espece, `%${search}%`),
          ilike(patientsTable.race, `%${search}%`),
          ilike(ownersTable.nom, `%${search}%`),
          ilike(ownersTable.prenom, `%${search}%`)
        )
      );
    } else if (conditions.length > 0) {
      patients = await baseQuery.where(and(...conditions));
    } else {
      patients = await baseQuery;
    }

    return res.json(patients.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      owner: p.owner ? { ...p.owner, createdAt: p.owner.createdAt.toISOString() } : null,
    })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreatePatientBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Données invalides" });

    const [patient] = await db.insert(patientsTable).values(body.data).returning();
    return res.status(201).json({ ...patient, createdAt: patient.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const params = GetPatientParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const [patient] = await db
      .select({
        id: patientsTable.id,
        nom: patientsTable.nom,
        espece: patientsTable.espece,
        race: patientsTable.race,
        sexe: patientsTable.sexe,
        dateNaissance: patientsTable.dateNaissance,
        poids: patientsTable.poids,
        couleur: patientsTable.couleur,
        sterilise: patientsTable.sterilise,
        ownerId: patientsTable.ownerId,
        antecedents: patientsTable.antecedents,
        allergies: patientsTable.allergies,
        createdAt: patientsTable.createdAt,
        owner: {
          id: ownersTable.id,
          nom: ownersTable.nom,
          prenom: ownersTable.prenom,
          email: ownersTable.email,
          telephone: ownersTable.telephone,
          adresse: ownersTable.adresse,
          createdAt: ownersTable.createdAt,
        },
      })
      .from(patientsTable)
      .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id))
      .where(eq(patientsTable.id, params.data.id));

    if (!patient) return res.status(404).json({ error: "Patient non trouvé" });

    return res.json({
      ...patient,
      createdAt: patient.createdAt.toISOString(),
      owner: patient.owner ? { ...patient.owner, createdAt: patient.owner.createdAt.toISOString() } : null,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const params = UpdatePatientParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const body = UpdatePatientBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Données invalides" });

    const [patient] = await db.update(patientsTable).set(body.data).where(eq(patientsTable.id, params.data.id)).returning();
    if (!patient) return res.status(404).json({ error: "Patient non trouvé" });

    return res.json({ ...patient, createdAt: patient.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const params = DeletePatientParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    await db.delete(patientsTable).where(eq(patientsTable.id, params.data.id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.get("/:id/consultations", async (req, res) => {
  try {
    const params = ListPatientConsultationsParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const consultations = await db.select().from(consultationsTable).where(eq(consultationsTable.patientId, params.data.id));

    return res.json(consultations.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

export default router;
