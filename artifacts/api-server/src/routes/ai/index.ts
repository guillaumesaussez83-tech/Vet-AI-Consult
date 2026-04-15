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

router.post("/certificat", async (req, res) => {
  try {
    const { type, patient, owner, vaccinations, consultations, actes, veterinaire, clinique } = req.body;
    if (!type || !patient) return res.status(400).json({ error: "type et patient requis" });

    const templates: Record<string, string> = {
      bonne_sante: "Certificat de bonne santé pour voyage UE (état général, vaccins, puce, date examen)",
      cession: "Certificat de cession pour vente (état de santé, vaccins, vermifugations, absence de pathologie connue)",
      aptitude: "Certificat d'aptitude pour concours ou élevage (examen complet systèmes, locomoteur, cardiaque, respiratoire)",
      soins: "Attestation de soins pour assurance (liste actes, diagnostic, pronostic, durée traitement)",
      ordonnance: "Ordonnance sécurisée (numéro vétérinaire, date, posologie détaillée, durée traitement, mentions légales)",
    };

    const templateDesc = templates[type] ?? type;
    const prompt = `Tu es vétérinaire praticien en France. Génère un ${templateDesc} officiel et professionnel.

DONNÉES PATIENT :
${JSON.stringify(patient, null, 2)}

PROPRIÉTAIRE :
${JSON.stringify(owner, null, 2)}

${vaccinations?.length ? `HISTORIQUE VACCINAL :\n${JSON.stringify(vaccinations, null, 2)}` : ""}

${consultations?.length ? `CONSULTATIONS RÉCENTES :\n${JSON.stringify(consultations.slice(0, 3), null, 2)}` : ""}

${actes?.length ? `ACTES RÉALISÉS :\n${JSON.stringify(actes, null, 2)}` : ""}

VÉTÉRINAIRE SIGNATAIRE : ${veterinaire || "Dr. Vétérinaire"}
${clinique ? `CLINIQUE : ${clinique}` : ""}

DATE : ${new Date().toLocaleDateString("fr-FR")}

Génère le certificat complet, professionnel, conforme aux exigences légales françaises. Inclus toutes les mentions obligatoires. Utilise un format structuré avec en-tête, corps du document et signature.
Réponds UNIQUEMENT avec le texte du certificat, prêt à imprimer.`;

    const message = await (await import("@workspace/integrations-anthropic-ai")).anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Réponse inattendue");
    return res.json({ certificat: content.text.trim() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération du certificat" });
  }
});

router.post("/carnet-vaccinations", async (req, res) => {
  try {
    const { patient, owner, vaccinations } = req.body;
    if (!patient) return res.status(400).json({ error: "patient requis" });

    const prompt = `Tu es vétérinaire. Génère un résumé du carnet de santé vaccinal pour ce patient animal.

ANIMAL : ${JSON.stringify(patient)}
PROPRIÉTAIRE : ${JSON.stringify(owner)}
VACCINATIONS : ${JSON.stringify(vaccinations ?? [])}

DATE D'AUJOURD'HUI : ${new Date().toLocaleDateString("fr-FR")}

Génère un bilan vaccinal complet et professionnel qui explique :
1. Les vaccins réalisés et leur date
2. Les rappels à venir (prochains 6 mois)
3. Les vaccins en retard s'il y en a
4. Les recommandations vaccinales pour l'espèce
5. Un résumé de protection actuelle

Réponds en français, de façon claire et lisible pour le propriétaire.`;

    const message = await (await import("@workspace/integrations-anthropic-ai")).anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Réponse inattendue");
    return res.json({ carnet: content.text.trim() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération du carnet" });
  }
});

export default router;
