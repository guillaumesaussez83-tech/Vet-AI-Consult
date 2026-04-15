import { Router } from "express";
import { db, actesTable } from "@workspace/db";
import { GetDiagnosticIABody } from "@workspace/api-zod";
import { ObjectStorageService } from "../../lib/objectStorage";
import {
  reformulerAnamnese,
  structurerExamenClinique,
  diagnosticDifferentiel,
  diagnosticEnrichi,
  resumeClient,
  genererFactureVoix,
} from "../../lib/aiService";

const router = Router();
const storage = new ObjectStorageService();

router.post("/diagnostic", async (req, res) => {
  try {
    const body = GetDiagnosticIABody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Données invalides" });

    const result = await diagnosticDifferentiel(body.data);
    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération du diagnostic IA" });
  }
});

router.post("/diagnostic-enrichi", async (req, res) => {
  try {
    const { espece, race, age, poids, sexe, sterilise, anamnese, examenClinique, examensComplementaires, antecedents, allergies, objectPaths } = req.body;
    if (!anamnese || !examenClinique) {
      return res.status(400).json({ error: "Anamnèse et examen clinique requis" });
    }

    const result = await diagnosticEnrichi(
      { espece, race, age, poids, sexe, sterilise, anamnese, examenClinique, examensComplementaires, antecedents, allergies, objectPaths },
      storage
    );
    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors du diagnostic enrichi" });
  }
});

router.post("/reformuler-anamnese", async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return res.status(400).json({ error: "Le transcript est requis" });
    }

    const result = await reformulerAnamnese(transcript);
    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la reformulation de l'anamnèse" });
  }
});

router.post("/structurer-examen-clinique", async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return res.status(400).json({ error: "Le transcript est requis" });
    }

    const result = await structurerExamenClinique(transcript);
    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la structuration de l'examen clinique" });
  }
});

router.post("/resume-client", async (req, res) => {
  try {
    const { diagnostic, ordonnance, notes, espece, nomAnimal, nomProprietaire } = req.body;
    if (!diagnostic && !ordonnance) {
      return res.status(400).json({ error: "Diagnostic ou ordonnance requis" });
    }

    const result = await resumeClient({ diagnostic, ordonnance, notes, espece, nomAnimal, nomProprietaire });
    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération du résumé client" });
  }
});

router.post("/generer-facture-voix", async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return res.status(400).json({ error: "Le transcript est requis" });
    }

    const actes = await db.select().from(actesTable);
    const result = await genererFactureVoix(transcript, actes.map(a => ({
      id: a.id,
      nom: a.nom,
      categorie: a.categorie,
      prixDefaut: a.prixDefaut,
      tvaRate: a.tvaRate ?? 20,
      unite: a.unite,
    })));

    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération de la facture vocale" });
  }
});

export default router;
