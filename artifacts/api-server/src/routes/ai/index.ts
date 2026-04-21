import { Router } from "express";
import { db, actesTable, stockMedicamentsTable, ordonnancesTable, facturesTable, mouvementsStockTable } from "@workspace/db"; // actesTable used by generer-facture-voix
import { GetDiagnosticIABody } from "@workspace/api-zod";
import { eq, ilike, desc, sql as drizzleSql } from "drizzle-orm";
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
    const { type, patient, owner, vaccinations, consultations, actes, veterinaire, clinique, cliniqueInfo } = req.body;
    if (!type || !patient) return res.status(400).json({ error: "type et patient requis" });

    const templates: Record<string, string> = {
      bonne_sante: "Certificat de bonne santé pour voyage UE (état général, vaccins, puce, date examen)",
      cession: "Certificat de cession pour vente (état de santé, vaccins, vermifugations, absence de pathologie connue)",
      aptitude: "Certificat d'aptitude pour concours ou élevage (examen complet systèmes, locomoteur, cardiaque, respiratoire)",
      soins: "Attestation de soins pour assurance (liste actes, diagnostic, pronostic, durée traitement)",
      ordonnance: "Ordonnance sécurisée (numéro vétérinaire, date, posologie détaillée, durée traitement, mentions légales)",
    };

    const templateDesc = templates[type] ?? type;
    const ci = cliniqueInfo ?? {};
    const adresseComplete = [ci.adresse, ci.codePostal && ci.ville ? `${ci.codePostal} ${ci.ville}` : (ci.ville || "")].filter(Boolean).join(", ");
    const prompt = `Tu es vétérinaire praticien en France. Génère un ${templateDesc} officiel et professionnel.

DONNÉES PATIENT :
${JSON.stringify(patient, null, 2)}

PROPRIÉTAIRE :
${JSON.stringify(owner, null, 2)}

${vaccinations?.length ? `HISTORIQUE VACCINAL :\n${JSON.stringify(vaccinations, null, 2)}` : ""}

${consultations?.length ? `CONSULTATIONS RÉCENTES :\n${JSON.stringify(consultations.slice(0, 3), null, 2)}` : ""}

${actes?.length ? `ACTES RÉALISÉS :\n${JSON.stringify(actes, null, 2)}` : ""}

VÉTÉRINAIRE SIGNATAIRE : ${veterinaire || "Dr. Vétérinaire"}
CLINIQUE : ${ci.nom || clinique || "Clinique vétérinaire"}
${adresseComplete ? `ADRESSE : ${adresseComplete}` : ""}
${ci.telephone ? `TÉLÉPHONE : ${ci.telephone}` : ""}
${ci.email ? `EMAIL : ${ci.email}` : ""}
${ci.numeroOrdre ? `N° ORDRE : ${ci.numeroOrdre}` : ""}
${ci.siret ? `SIRET : ${ci.siret}` : ""}

DATE : ${new Date().toLocaleDateString("fr-FR")}

INSTRUCTIONS :
- Génère le certificat complet, professionnel, conforme aux exigences légales françaises.
- Utilise les coordonnées exactes fournies ci-dessus — n'utilise JAMAIS de placeholders comme [Adresse du cabinet], [XXXX], [email@example.com], etc.
- Inclus toutes les mentions obligatoires.
- Utilise un format structuré avec en-tête (coordonnées clinique + vétérinaire), corps du document et signature.
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

router.post("/dictee-ordonnance", async (req, res) => {
  try {
    const { transcription } = req.body;
    if (!transcription || typeof transcription !== "string" || !transcription.trim()) {
      return res.status(400).json({ error: "Le texte de la dictée est requis" });
    }

    const { anthropic } = await import("@workspace/integrations-anthropic-ai");
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `Tu es un vétérinaire praticien expert en France. Tu génères des ordonnances vétérinaires précises et médicalement justifiées à partir de dictées vocales.

RÈGLES STRICTES :
1. Ne prescris JAMAIS d'antibiotiques (amoxicilline, amoxiclavulanate, céfovecine, métronidazole, etc.) sans indication infectieuse confirmée ou très probable. Une entorse, une boiterie mécanique, une OCD, une allergie cutanée non surinfectée NE justifient PAS d'antibiotique.
2. Calcule toujours les doses en mg/kg si le poids est mentionné. Sinon, indique une dose standard pour l'espèce.
3. Prescris UNIQUEMENT ce qui est médicalement justifié par le diagnostic mentionné — pas par les hypothèses écartées.
4. Pour les AINS (méloxicam, carprofène, robenacoxib) : précise la durée maximale (5-7j chien, 3-5j chat) et mentionne la protection gastrique si > 5j.
5. Pour les corticoïdes : précise toujours la décroissance progressive.
6. Pour les stupéfiants (kétamine, morphine, fentanyl, butorphanol, méthadone, buprénorphine) : ajoute la mention "STUPÉFIANT — Ordonnance sécurisée obligatoire".
7. quantite_a_delivrer doit être un entier positif représentant le nombre d'unités à délivrer (comprimés, flacons, tubes, etc.).`,
      messages: [{
        role: "user",
        content: `Extrait de cette dictée les prescriptions médicamenteuses sous forme JSON structuré :
[{
  "nom_medicament": string,         // ex: "Amoxicilline 200mg"
  "dose": string,                    // ex: "10 mg/kg" ou "1 comprimé"
  "voie_administration": string,    // ex: "per os", "sous-cutané", "intraveineux"
  "frequence": string,               // ex: "2 fois par jour", "matin et soir", "1 fois par jour"
  "duree": string,                   // OBLIGATOIRE — toujours exprimée en jours, ex: "7 jours", "5 jours", "10 jours". Si la durée n'est pas dictée, déduis une durée standard pour le médicament (AINS: 5j, antibiotiques: 7-10j, corticoïdes avec décroissance: 7-14j). NE JAMAIS laisser vide ou null.
  "quantite_a_delivrer": number,     // entier positif
  "unite": string,                   // ex: "comprimé", "ml", "flacon"
  "justification": string
}]
Réponds UNIQUEMENT avec le JSON valide, sans texte supplémentaire ni bloc markdown.

Texte de la dictée : "${transcription}"`
      }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
    let prescriptions: any[] = [];
    try {
      const jsonStr = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      prescriptions = JSON.parse(jsonStr);
    } catch {
      return res.status(422).json({ error: "Impossible de parser les prescriptions depuis la transcription" });
    }

    const resultats = await Promise.all(prescriptions.map(async (p) => {
      const mots = p.nom_medicament.split(/\s+/).filter((m: string) => m.length > 2);
      let match = null;
      for (const mot of mots) {
        const [found] = await db
          .select({ id: stockMedicamentsTable.id, nom: stockMedicamentsTable.nom, prixVenteTTC: stockMedicamentsTable.prixVenteTTC, quantiteStock: stockMedicamentsTable.quantiteStock, unite: stockMedicamentsTable.unite })
          .from(stockMedicamentsTable)
          .where(ilike(stockMedicamentsTable.nom, `%${mot}%`))
          .limit(1);
        if (found) { match = found; break; }
      }
      return { ...p, stockMatch: match };
    }));

    return res.json({ prescriptions: resultats });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la dictée ordonnance" });
  }
});

router.post("/confirmer-dictee-ordonnance", async (req, res) => {
  try {
    const { consultationId, patientId, veterinaire, prescriptions } = req.body;
    if (!consultationId || !prescriptions?.length) {
      return res.status(400).json({ error: "consultationId et prescriptions requis" });
    }

    const year = new Date().getFullYear();
    const [lastOrd] = await db
      .select({ num: ordonnancesTable.numeroOrdonnance })
      .from(ordonnancesTable)
      .where(drizzleSql`numero_ordonnance LIKE ${"ORD-" + year + "-%"}`)
      .orderBy(desc(ordonnancesTable.id))
      .limit(1);
    const lastSeq = lastOrd?.num ? parseInt(lastOrd.num.split("-")[2] ?? "0") : 0;
    const numeroOrdonnance = `ORD-${year}-${String(lastSeq + 1).padStart(5, "0")}`;

    // Strip null/dash/"null" values from AI-returned fields
    const cleanField = (v: any): string => {
      if (v == null) return "";
      const s = String(v).trim();
      if (!s || s === "—" || s === "-" || s === "–" || /^null$/i.test(s) || /^undefined$/i.test(s)) return "";
      return s;
    };

    const contenu = prescriptions.map((p: any) => {
      const dose = cleanField(p.dose);
      const voie = cleanField(p.voie_administration);
      const freq = cleanField(p.frequence);
      const duree = cleanField(p.duree);

      // qte: only include when we have an actual numeric quantity
      const rawQte = cleanField(p.quantite_a_delivrer != null ? String(p.quantite_a_delivrer) : null);
      const unite = cleanField(p.unite);
      // Only build qte string if rawQte is a number or non-empty meaningful value (not just a unit word)
      const qte = rawQte ? `${rawQte}${unite ? " " + unite : ""}`.trim() : "";

      const parts = [
        p.nom_medicament,
        dose && `Dose : ${dose}`,
        voie && `Voie : ${voie}`,
        freq && `Fréquence : ${freq}`,
        duree && `Durée : ${duree}`,
        qte && `Qté : ${qte}`,
      ].filter(Boolean);
      return parts.join(" — ");
    }).join("\n");

    const [ordonnance] = await db.insert(ordonnancesTable).values({
      consultationId: Number(consultationId),
      patientId: patientId ? Number(patientId) : null,
      veterinaire: veterinaire ?? null,
      contenu,
      numeroOrdonnance,
      genereIA: true,
    }).returning();

    const [existingFacture] = await db
      .select({ id: facturesTable.id })
      .from(facturesTable)
      .where(eq(facturesTable.consultationId, Number(consultationId)));

    for (const p of prescriptions) {
      if (!p.stockMatch?.id) continue;
      const quantite = Math.max(1, Math.round(p.quantite_a_delivrer ?? 1));

      await db.insert(mouvementsStockTable).values({
        medicamentId: p.stockMatch.id,
        typeMouvement: "sortie_consultation",
        quantite: -quantite,
        consultationId: Number(consultationId),
        factureId: existingFacture?.id ?? null,
        motif: `Ordonnance ${numeroOrdonnance} — ${p.nom_medicament}`,
        utilisateur: veterinaire ?? "Système",
      });

      await db.update(stockMedicamentsTable)
        .set({ quantiteStock: drizzleSql`quantite_stock - ${quantite}` })
        .where(eq(stockMedicamentsTable.id, p.stockMatch.id));
    }

    return res.status(201).json({
      ordonnance: { ...ordonnance, createdAt: ordonnance.createdAt.toISOString(), updatedAt: ordonnance.updatedAt.toISOString() },
      factureId: existingFacture?.id ?? null,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la confirmation de l'ordonnance" });
  }
});

export default router;
