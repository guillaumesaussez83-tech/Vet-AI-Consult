import { Router } from "express";
import { db } from "@workspace/db";
import { consultationsTable, patientsTable, ownersTable, actesConsultationsTable, actesTable, facturesTable } from "@workspace/db";
import { CreateConsultationBody, GetConsultationParams, UpdateConsultationBody, UpdateConsultationParams, ListConsultationsQueryParams, GenerateOrdonnanceParams, GenerateFactureParams } from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

async function getConsultationWithDetails(id: number) {
  const [c] = await db
    .select({
      id: consultationsTable.id,
      patientId: consultationsTable.patientId,
      veterinaire: consultationsTable.veterinaire,
      date: consultationsTable.date,
      statut: consultationsTable.statut,
      motif: consultationsTable.motif,
      anamnese: consultationsTable.anamnese,
      examenClinique: consultationsTable.examenClinique,
      examensComplementaires: consultationsTable.examensComplementaires,
      diagnostic: consultationsTable.diagnostic,
      diagnosticIA: consultationsTable.diagnosticIA,
      ordonnance: consultationsTable.ordonnance,
      notes: consultationsTable.notes,
      poids: consultationsTable.poids,
      temperature: consultationsTable.temperature,
      createdAt: consultationsTable.createdAt,
      patient: {
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
      },
    })
    .from(consultationsTable)
    .leftJoin(patientsTable, eq(consultationsTable.patientId, patientsTable.id))
    .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id))
    .where(eq(consultationsTable.id, id));

  if (!c) return null;

  const actes = await db
    .select({
      id: actesConsultationsTable.id,
      acteId: actesConsultationsTable.acteId,
      consultationId: actesConsultationsTable.consultationId,
      quantite: actesConsultationsTable.quantite,
      prixUnitaire: actesConsultationsTable.prixUnitaire,
      description: actesConsultationsTable.description,
      acte: {
        id: actesTable.id,
        code: actesTable.code,
        nom: actesTable.nom,
        categorie: actesTable.categorie,
        prixDefaut: actesTable.prixDefaut,
        description: actesTable.description,
        unite: actesTable.unite,
      },
    })
    .from(actesConsultationsTable)
    .leftJoin(actesTable, eq(actesConsultationsTable.acteId, actesTable.id))
    .where(eq(actesConsultationsTable.consultationId, id));

  const [facture] = await db.select().from(facturesTable).where(eq(facturesTable.consultationId, id));

  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    patient: c.patient ? {
      ...c.patient,
      createdAt: c.patient.createdAt.toISOString(),
      owner: c.patient.owner ? {
        ...c.patient.owner,
        createdAt: c.patient.owner.createdAt.toISOString(),
      } : null,
    } : null,
    actes,
    facture: facture ? { ...facture, createdAt: facture.createdAt.toISOString() } : null,
  };
}

router.get("/", async (req, res) => {
  try {
    const query = ListConsultationsQueryParams.safeParse(req.query);
    const { statut, date } = query.success ? query.data : {};

    let consultations;
    if (statut && date) {
      consultations = await db.select().from(consultationsTable)
        .where(sql`${consultationsTable.statut} = ${statut} AND ${consultationsTable.date} = ${date}`);
    } else if (statut) {
      consultations = await db.select().from(consultationsTable).where(eq(consultationsTable.statut, statut));
    } else if (date) {
      consultations = await db.select().from(consultationsTable).where(eq(consultationsTable.date, date));
    } else {
      consultations = await db.select().from(consultationsTable);
    }

    const result = await Promise.all(consultations.map(async (c) => {
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
        .where(eq(patientsTable.id, c.patientId));

      return {
        ...c,
        createdAt: c.createdAt.toISOString(),
        patient: patient ? {
          ...patient,
          createdAt: patient.createdAt.toISOString(),
          owner: patient.owner ? {
            ...patient.owner,
            createdAt: patient.owner.createdAt.toISOString(),
          } : null,
        } : null,
      };
    }));

    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateConsultationBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Données invalides" });

    const [consultation] = await db.insert(consultationsTable).values(body.data).returning();
    return res.status(201).json({ ...consultation, createdAt: consultation.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const params = GetConsultationParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const consultation = await getConsultationWithDetails(params.data.id);
    if (!consultation) return res.status(404).json({ error: "Consultation non trouvée" });

    return res.json(consultation);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const params = UpdateConsultationParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const body = UpdateConsultationBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Données invalides" });

    const { actes, ...consultationData } = body.data;

    if (Object.keys(consultationData).length > 0) {
      await db.update(consultationsTable).set(consultationData).where(eq(consultationsTable.id, params.data.id));
    }

    if (actes !== undefined) {
      await db.delete(actesConsultationsTable).where(eq(actesConsultationsTable.consultationId, params.data.id));
      if (actes.length > 0) {
        await db.insert(actesConsultationsTable).values(
          actes.map(a => ({
            acteId: (a.acteId && a.acteId > 0) ? a.acteId : null,
            consultationId: params.data.id,
            quantite: a.quantite,
            prixUnitaire: a.prixUnitaire,
            description: a.description ?? null,
          }))
        );
      }
    }

    const consultation = await getConsultationWithDetails(params.data.id);
    if (!consultation) return res.status(404).json({ error: "Consultation non trouvée" });

    return res.json(consultation);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/:id/actes", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const { description, quantite, prixUnitaire, acteId } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ error: "Description requise" });
    }
    if (prixUnitaire === undefined || prixUnitaire === null || isNaN(Number(prixUnitaire))) {
      return res.status(400).json({ error: "Prix unitaire requis" });
    }

    const [acte] = await db.insert(actesConsultationsTable).values({
      consultationId: id,
      acteId: (acteId && Number(acteId) > 0) ? Number(acteId) : null,
      quantite: Number(quantite) || 1,
      prixUnitaire: Number(prixUnitaire),
      description: String(description).trim(),
    }).returning();

    return res.status(201).json(acte);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/:id/ordonnance", async (req, res) => {
  try {
    const params = GenerateOrdonnanceParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const consultation = await getConsultationWithDetails(params.data.id);
    if (!consultation) return res.status(404).json({ error: "Consultation non trouvée" });

    const patient = consultation.patient;
    const actes = consultation.actes;

    const prompt = `Tu es un vétérinaire. Génère une ordonnance médicale structurée pour ce patient animal.

PATIENT : ${patient?.nom ?? "Inconnu"} (${patient?.espece ?? ""}, ${patient?.sexe ?? ""}, ${patient?.sterilise ? "stérilisé(e)" : "non stérilisé(e)"})
PROPRIÉTAIRE : ${patient?.owner?.nom ?? ""} ${patient?.owner?.prenom ?? ""}
DATE : ${consultation.date}
VÉTÉRINAIRE : Dr. ${consultation.veterinaire}

DIAGNOSTIC : ${consultation.diagnostic ?? consultation.diagnosticIA ?? "À préciser"}
ANAMNÈSE : ${consultation.anamnese ?? ""}
EXAMEN CLINIQUE : ${consultation.examenClinique ?? ""}
${actes.length > 0 ? `ACTES RÉALISÉS : ${actes.map(a => a.acte?.nom).filter(Boolean).join(", ")}` : ""}

Génère une ordonnance médicale vétérinaire complète avec :
- En-tête professionnel
- Identification du patient et propriétaire
- Les médicaments appropriés avec posologie, durée et instructions claires
- Conseils post-consultation
- Signature du vétérinaire

Format: texte structuré lisible, en français, professionnel.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return res.status(500).json({ error: "Erreur lors de la génération de l'ordonnance" });
    }

    await db.update(consultationsTable).set({ ordonnance: content.text }).where(eq(consultationsTable.id, params.data.id));

    return res.json({ ordonnance: content.text });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération de l'ordonnance" });
  }
});

router.post("/:id/facture", async (req, res) => {
  try {
    const params = GenerateFactureParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const [existingFacture] = await db.select().from(facturesTable).where(eq(facturesTable.consultationId, params.data.id));

    const actes = await db
      .select()
      .from(actesConsultationsTable)
      .where(eq(actesConsultationsTable.consultationId, params.data.id));

    const montantHT = parseFloat(actes.reduce((acc, a) => acc + a.prixUnitaire * a.quantite, 0).toFixed(2));
    const tva = 20;
    const montantTTC = parseFloat((montantHT * (1 + tva / 100)).toFixed(2));

    if (actes.length === 0) {
      return res.status(400).json({ error: "Aucun acte saisi — veuillez ajouter et enregistrer vos actes avant de générer la facture." });
    }
    if (montantHT === 0) {
      return res.status(400).json({ error: "Le total des actes est 0 € — saisissez des prix corrects avant de générer la facture." });
    }

    if (existingFacture) {
      const [updated] = await db.update(facturesTable)
        .set({ montantHT, tva, montantTTC })
        .where(eq(facturesTable.id, existingFacture.id))
        .returning();
      return res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
    }

    const year = new Date().getFullYear();
    const [lastFacture] = await db.select().from(facturesTable).orderBy(sql`${facturesTable.id} DESC`).limit(1);
    const nextNum = lastFacture ? (parseInt(lastFacture.numero.split("-")[2] ?? "0") + 1) : 1;
    const numero = `FACT-${year}-${String(nextNum).padStart(4, "0")}`;

    const [facture] = await db.insert(facturesTable).values({
      consultationId: params.data.id,
      numero,
      montantHT,
      tva,
      montantTTC,
      statut: "en_attente",
      dateEmission: new Date().toISOString().split("T")[0],
    }).returning();

    return res.json({ ...facture, createdAt: facture.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération de la facture" });
  }
});

export default router;
