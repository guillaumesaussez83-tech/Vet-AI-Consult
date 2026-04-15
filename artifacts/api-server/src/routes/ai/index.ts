import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, actesTable } from "@workspace/db";
import { GetDiagnosticIABody } from "@workspace/api-zod";

const router = Router();

router.post("/diagnostic", async (req, res) => {
  try {
    const body = GetDiagnosticIABody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Données invalides" });

    const { espece, race, age, poids, sexe, sterilise, anamnese, examenClinique, examensComplementaires, antecedents, allergies } = body.data;

    const prompt = `Tu es un vétérinaire expert en médecine des animaux de compagnie. Analyse le cas clinique suivant et propose un diagnostic différentiel structuré.

INFORMATIONS SUR LE PATIENT :
- Espèce : ${espece}${race ? ` (Race : ${race})` : ""}
${age ? `- Âge : ${age}` : ""}
${poids ? `- Poids : ${poids} kg` : ""}
- Sexe : ${sexe}
- Stérilisé : ${sterilise ? "Oui" : "Non"}
${antecedents ? `- Antécédents médicaux : ${antecedents}` : ""}
${allergies ? `- Allergies connues : ${allergies}` : ""}

ANAMNÈSE :
${anamnese}

EXAMEN CLINIQUE :
${examenClinique}

${examensComplementaires ? `EXAMENS COMPLÉMENTAIRES :\n${examensComplementaires}` : ""}

Réponds UNIQUEMENT avec un objet JSON valide (sans bloc de code markdown) ayant cette structure exacte :
{
  "diagnostics": [
    {"nom": "Nom du diagnostic 1", "probabilite": "Élevée/Modérée/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 2", "probabilite": "Élevée/Modérée/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 3", "probabilite": "Élevée/Modérée/Faible", "description": "Explication clinique concise"}
  ],
  "recommandations": "Recommandations thérapeutiques et examens complémentaires à effectuer",
  "urgence": "Urgence vitale/Urgence relative/Non urgent",
  "texteComplet": "Analyse clinique complète et détaillée"
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return res.status(500).json({ error: "Erreur lors de la génération du diagnostic" });
    }

    let diagnostic;
    try {
      const text = content.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      diagnostic = JSON.parse(jsonMatch[0]);
    } catch {
      diagnostic = {
        diagnostics: [{ nom: "Diagnostic indéterminé", probabilite: "Modérée", description: content.text }],
        recommandations: "Consulter un spécialiste pour une évaluation approfondie",
        urgence: "Non urgent",
        texteComplet: content.text,
      };
    }

    return res.json(diagnostic);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération du diagnostic IA" });
  }
});

router.post("/reformuler-anamnese", async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return res.status(400).json({ error: "Le transcript est requis" });
    }

    const prompt = `Tu es un vétérinaire qui prend des notes cliniques. Le texte suivant est une transcription brute d'une dictée vocale d'un vétérinaire ou d'une conversation avec un propriétaire d'animal.

TRANSCRIPTION BRUTE :
${transcript}

Reformule ce texte en une anamnèse médicale vétérinaire structurée, professionnelle et complète en français. L'anamnèse doit :
- Être rédigée de manière claire et médicalement précise
- Organiser l'information de façon logique (motif principal, historique des symptômes, durée, évolution, contexte, traitements en cours, alimentation/hydratation, comportement)
- Éliminer les répétitions et les hésitations de la dictée
- Conserver tous les faits cliniques importants mentionnés
- Utiliser le vocabulaire médical vétérinaire approprié

Réponds UNIQUEMENT avec l'anamnèse reformulée, sans introduction ni commentaire.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return res.status(500).json({ error: "Erreur lors de la reformulation" });
    }

    return res.json({ anamnese: content.text.trim() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la reformulation de l'anamnèse" });
  }
});

router.post("/generer-facture-voix", async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return res.status(400).json({ error: "Le transcript est requis" });
    }

    const actes = await db.select().from(actesTable);
    const actesJson = actes.map(a => ({
      id: a.id,
      nom: a.nom,
      categorie: a.categorie,
      prixDefaut: a.prixDefaut,
      tvaRate: a.tvaRate ?? 20,
      unite: a.unite,
    }));

    const prompt = `Tu es un assistant de facturation vétérinaire. Le texte suivant est la transcription d'un vétérinaire qui dicte les actes réalisés lors d'une consultation.

TRANSCRIPTION DU VÉTÉRINAIRE :
"${transcript}"

LISTE DES ACTES DISPONIBLES EN BASE DE DONNÉES :
${JSON.stringify(actesJson, null, 2)}

Analyse la transcription et génère les lignes de facturation. Pour chaque acte ou produit mentionné :
1. Essaie de l'associer à un acte de la base de données (utilise son id)
2. Si aucun acte ne correspond exactement, crée une ligne libre (acteId à null) avec une description et un prix estimé cohérent
3. Respecte les quantités mentionnées (ex: "2 comprimés", "3 séances")
4. TVA à 20% sur tous les actes

Réponds UNIQUEMENT avec un JSON valide (sans markdown) de cette forme exacte :
{
  "lignes": [
    {
      "acteId": 3,
      "description": "Consultation standard",
      "quantite": 1,
      "prixUnitaire": 45.00,
      "tvaRate": 20,
      "montantHT": 45.00
    }
  ],
  "totalHT": 45.00,
  "totalTVA": 9.00,
  "totalTTC": 54.00,
  "resume": "Courte description de la facturation dictée"
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return res.status(500).json({ error: "Erreur lors de la génération" });
    }

    let result;
    try {
      const text = content.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      result = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(500).json({ error: "Impossible de parser la réponse de l'IA" });
    }

    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération de la facture vocale" });
  }
});

export default router;
