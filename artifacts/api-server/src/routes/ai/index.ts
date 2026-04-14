import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
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

${examensComplementaires ? `EXAMENS COMPLÉMENTAIRES :
${examensComplementaires}` : ""}

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

export default router;
