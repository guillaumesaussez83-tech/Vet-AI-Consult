import { Router } from "express";
import { db } from "@workspace/db";
import { facturesTable, consultationsTable, patientsTable, ownersTable } from "@workspace/db";
import { GetFactureParams, UpdateFactureStatutParams, UpdateFactureStatutBody, ListFacturesQueryParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const query = ListFacturesQueryParams.safeParse(req.query);
    const { statut } = query.success ? query.data : {};

    let factures;
    if (statut) {
      factures = await db.select().from(facturesTable).where(eq(facturesTable.statut, statut));
    } else {
      factures = await db.select().from(facturesTable);
    }

    const result = await Promise.all(factures.map(async (f) => {
      const [consultation] = await db
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
        .where(eq(consultationsTable.id, f.consultationId));

      return {
        ...f,
        dateEmission: f.dateEmission,
        createdAt: f.createdAt.toISOString(),
        consultation: consultation ? {
          ...consultation,
          createdAt: consultation.createdAt.toISOString(),
          patient: consultation.patient ? {
            ...consultation.patient,
            createdAt: consultation.patient.createdAt.toISOString(),
            owner: consultation.patient.owner ? {
              ...consultation.patient.owner,
              createdAt: consultation.patient.owner.createdAt.toISOString(),
            } : null,
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

router.get("/:id", async (req, res) => {
  try {
    const params = GetFactureParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const [facture] = await db.select().from(facturesTable).where(eq(facturesTable.id, params.data.id));
    if (!facture) return res.status(404).json({ error: "Facture non trouvée" });

    const [consultation] = await db
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
      .where(eq(consultationsTable.id, facture.consultationId));

    return res.json({
      ...facture,
      createdAt: facture.createdAt.toISOString(),
      consultation: consultation ? {
        ...consultation,
        createdAt: consultation.createdAt.toISOString(),
        patient: consultation.patient ? {
          ...consultation.patient,
          createdAt: consultation.patient.createdAt.toISOString(),
          owner: consultation.patient.owner ? {
            ...consultation.patient.owner,
            createdAt: consultation.patient.owner.createdAt.toISOString(),
          } : null,
        } : null,
      } : null,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const params = UpdateFactureStatutParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const body = UpdateFactureStatutBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Données invalides" });

    const updateData: Record<string, unknown> = { statut: body.data.statut };
    if (body.data.datePaiement) {
      updateData.datePaiement = body.data.datePaiement;
    }

    const [facture] = await db.update(facturesTable).set(updateData).where(eq(facturesTable.id, params.data.id)).returning();
    if (!facture) return res.status(404).json({ error: "Facture non trouvée" });

    return res.json({ ...facture, createdAt: facture.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

export default router;
