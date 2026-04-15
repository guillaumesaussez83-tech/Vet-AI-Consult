import { Router } from "express";
import { db } from "@workspace/db";
import { anesthesieProtocolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AI_MODEL, AI_MAX_TOKENS } from "../../lib/constants";

const router = Router();

router.get("/consultation/:consultationId", async (req, res) => {
  try {
    const consultationId = parseInt(req.params.consultationId);
    if (isNaN(consultationId)) return res.status(400).json({ error: "ID invalide" });
    const [protocole] = await db.select().from(anesthesieProtocolesTable)
      .where(eq(anesthesieProtocolesTable.consultationId, consultationId));
    return res.json(protocole ?? null);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { consultationId, poids, premedication, premedicationDose, premedicationVoie,
      induction, inductionDose, maintenance, maintenancePourcentage, monitoring,
      heureReveil, scoreReveil, complications, notes } = req.body;
    if (!consultationId) return res.status(400).json({ error: "consultationId requis" });

    const existing = await db.select().from(anesthesieProtocolesTable)
      .where(eq(anesthesieProtocolesTable.consultationId, parseInt(consultationId)));

    let result;
    if (existing.length > 0) {
      [result] = await db.update(anesthesieProtocolesTable)
        .set({ poids, premedication, premedicationDose, premedicationVoie, induction, inductionDose,
          maintenance, maintenancePourcentage, monitoring, heureReveil, scoreReveil, complications, notes })
        .where(eq(anesthesieProtocolesTable.consultationId, parseInt(consultationId)))
        .returning();
    } else {
      [result] = await db.insert(anesthesieProtocolesTable).values({
        consultationId: parseInt(consultationId), poids, premedication, premedicationDose, premedicationVoie,
        induction, inductionDose, maintenance, maintenancePourcentage, monitoring,
        heureReveil, scoreReveil, complications, notes,
      }).returning();
    }
    return res.status(200).json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.post("/generer-ia", async (req, res) => {
  try {
    const { espece, race, poids, age, diagnostic, actes } = req.body;
    if (!espece || !poids) return res.status(400).json({ error: "espece et poids requis" });

    const prompt = `Tu es un vétérinaire anesthésiste expert. Génère un protocole anesthésique adapté pour un animal avec les caractéristiques suivantes :

Espèce : ${espece}
${race ? `Race : ${race}` : ""}
Poids : ${poids} kg
${age ? `Âge : ${age}` : ""}
${diagnostic ? `Diagnostic / motif chirurgical : ${diagnostic}` : ""}
${actes ? `Actes prévus : ${actes}` : ""}

Fournis un protocole anesthésique complet incluant :
1. Prémédication recommandée (molécule, dose en mg/kg, voie d'administration)
2. Induction anesthésique (molécule, dose, durée d'action)
3. Maintenance (agent halogéné %, O2 %)
4. Monitoring recommandé (paramètres à surveiller, fréquence)
5. Gestion du réveil
6. Précautions particulières pour cette espèce/race

Base tes recommandations sur les protocoles vétérinaires actuels. Sois précis sur les dosages.
Réponds en français, de façon structurée et directement utilisable en clinique.`;

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS.short,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Réponse inattendue");
    return res.json({ protocole: content.text.trim() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération du protocole IA" });
  }
});

export default router;
