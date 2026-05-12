import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable, ownersTable, consultationsTable } from "@workspace/db";
import {
  CreatePatientBody,
  GetPatientParams,
  UpdatePatientBody,
  UpdatePatientParams,
  DeletePatientParams,
  ListPatientsQueryParams,
  ListPatientConsultationsParams,
} from "@workspace/api-zod";
import { eq, ilike, or, and, asc } from "drizzle-orm";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from "../../lib/constants";
import { validate } from "../../middlewares/validate";
import { CreatePatientSchema } from "../../schemas";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const query = ListPatientsQueryParams.safeParse(req.query);
    const { search, ownerId, espece } = query.success ? query.data : {};
    const rawLimit = parseInt(req.query.limit as string || "");
    const rawOffset = parseInt(req.query.offset as string || "0");
    const limit = isNaN(rawLimit) ? PAGINATION_DEFAULT_LIMIT : Math.max(1, Math.min(rawLimit, PAGINATION_MAX_LIMIT));
    const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);

    const conditions = [eq(patientsTable.clinicId, req.clinicId!)];
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
        puce: patientsTable.puce,
        passeport: patientsTable.passeport,
        assurance: patientsTable.assurance,
        assuranceNom: patientsTable.assuranceNom,
        agressif: patientsTable.agressif,
        createdAt: patientsTable.createdAt,
        owner: {
          id: ownersTable.id,
          nom: ownersTable.nom,
          prenom: ownersTable.prenom,
          email: ownersTable.email,
          telephone: ownersTable.telephone,
          adresse: ownersTable.adresse,
          rgpdAccepted: ownersTable.rgpdAccepted,
          rgpdAcceptedAt: ownersTable.rgpdAcceptedAt,
          rgpdDocumentUrl: ownersTable.rgpdDocumentUrl,
          createdAt: ownersTable.createdAt,
        },
      })
      .from(patientsTable)
      .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id));

    let patients;
    if (search) {
      patients = await baseQuery
        .where(and(
          eq(patientsTable.clinicId, req.clinicId!),
          or(
            ilike(patientsTable.nom, `%${search}%`),
            ilike(patientsTable.espece, `%${search}%`),
            ilike(patientsTable.race, `%${search}%`),
            ilike(ownersTable.nom, `%${search}%`),
            ilike(ownersTable.prenom, `%${search}%`),
          ),
        ))
        .orderBy(asc(patientsTable.nom))
        .limit(limit)
        .offset(offset);
    } else {
      patients = await baseQuery
        .where(and(...conditions))
        .orderBy(asc(patientsTable.nom))
        .limit(limit)
        .offset(offset);
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

router.post("/", validate(CreatePatientSchema), async (req, res) => {
  try {
    const body = CreatePatientBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "DonnÃÂÃÂ©es invalides" });
    const [own] = await db.select({ id: ownersTable.id }).from(ownersTable)
      .where(and(eq(ownersTable.clinicId, req.clinicId!), eq(ownersTable.id, body.data.ownerId)));
    if (!own) return res.status(400).json({ error: "PropriÃÂÃÂ©taire introuvable" });
    const [patient] = await db.insert(patientsTable).values({ ...body.data, clinicId: req.clinicId }).returning();
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
        puce: patientsTable.puce,
        passeport: patientsTable.passeport,
        assurance: patientsTable.assurance,
        assuranceNom: patientsTable.assuranceNom,
        agressif: patientsTable.agressif,
        createdAt: patientsTable.createdAt,
        owner: {
          id: ownersTable.id,
          nom: ownersTable.nom,
          prenom: ownersTable.prenom,
          email: ownersTable.email,
          telephone: ownersTable.telephone,
          adresse: ownersTable.adresse,
          rgpdAccepted: ownersTable.rgpdAccepted,
          rgpdAcceptedAt: ownersTable.rgpdAcceptedAt,
          rgpdDocumentUrl: ownersTable.rgpdDocumentUrl,
          createdAt: ownersTable.createdAt,
        },
      })
      .from(patientsTable)
      .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id))
      .where(and(eq(patientsTable.clinicId, req.clinicId!), eq(patientsTable.id, params.data.id)));
    if (!patient) return res.status(404).json({ error: "Patient non trouvÃÂÃÂ©" });
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
    if (!body.success) return res.status(400).json({ error: "DonnÃÂÃÂ©es invalides" });
    const [patient] = await db.update(patientsTable).set(body.data).where(and(eq(patientsTable.clinicId, req.clinicId!), eq(patientsTable.id, params.data.id))).returning();
    if (!patient) return res.status(404).json({ error: "Patient non trouvÃÂÃÂ©" });
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

    // VÃÂÃÂ©rifier l'absence de consultations liÃÂÃÂ©es avant suppression
    // (ÃÂÃÂ©vite une erreur FK PostgreSQL opaque et protÃÂÃÂ¨ge les donnÃÂÃÂ©es mÃÂÃÂ©dicales)
    const [linked] = await db
      .select({ id: consultationsTable.id })
      .from(consultationsTable)
      .where(and(
        eq(consultationsTable.clinicId, req.clinicId!),
        eq(consultationsTable.patientId, params.data.id),
      ))
      .limit(1);

    if (linked) {
      return res.status(409).json({
        error: "Ce patient possÃÂÃÂ¨de des consultations. Supprimez d'abord toutes ses consultations avant de supprimer le patient.",
      });
    }

    await db.delete(patientsTable).where(and(eq(patientsTable.clinicId, req.clinicId!), eq(patientsTable.id, params.data.id)));
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
    const consultations = await db.select().from(consultationsTable).where(and(eq(consultationsTable.clinicId, req.clinicId!), eq(consultationsTable.patientId, params.data.id)));
    return res.json(consultations.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/batch", async (req, res) => {
  try {
    const { patients, motherId, fatherId } = req.body as {
      patients: Array<{
        nom: string; espece: string; sexe: string; race?: string;
        couleur?: string; dateNaissance?: string; poids?: number;
        ownerId: number; clinicId?: number;
      }>;
      motherId?: number;
      fatherId?: number;
    };
    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({ error: "patients array required" });
    }
    if (patients.length > 20) {
      return res.status(400).json({ error: "Maximum 20 patients par portee" });
    }
    const rows = await db.insert(patientsTable).values(
      patients.map(p => ({
        ...p,
        clinicId: req.clinicId, // security: always override client-supplied clinicId
        motherId: motherId ?? null,
        fatherId: fatherId ?? null,
        sterilise: false,
        assurance: false,
        agressif: false,
        consentementRgpd: false,
      }))
    ).returning();
    return res.status(201).json({ data: rows, count: rows.length });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
