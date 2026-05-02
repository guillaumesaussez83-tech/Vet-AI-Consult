import { Router } from "express";
import {
  db,
  actesTable,
  stockMedicamentsTable,
  ordonnancesTable,
  facturesTable,
  mouvementsStockTable,
  consultationsTable,
} from "@workspace/db"; // actesTable used by generer-facture-voix
import { GetDiagnosticIABody } from "@workspace/api-zod";
import { eq, and, ilike, desc, sql as drizzleSql } from "drizzle-orm";
import { ObjectStorageService } from "../../lib/objectStorage";
import { aiLimiter } from "../../middlewares/aiRateLimiter";
import {
  reformulerAnamnese,
  structurerExamenClinique,
  diagnosticDifferentiel,
  diagnosticEnrichi,
  resumeClient,
  genererFactureVoix,
} from "../../lib/aiService";

const router = Router();
router.use(aiLimiter);
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

// CHANGE 5: Accept medicamentsDejaFactures from request body
router.post("/generer-facture-voix", async (req, res) => {
  try {
    const { transcript, medicamentsDejaFactures = [] } = req.body;
    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return res.status(400).json({ error: "Le transcript est requis" });
    }
    const actes = await db.select().from(actesTable).where(eq(actesTable.clinicId, req.clinicId));
    const result = await genererFactureVoix(
      transcript,
      actes.map(a => ({
        id: a.id,
        nom: a.nom,
        categorie: a.categorie,
        prixDefaut: a.prixDefaut,
        tvaRate: a.tvaRate ?? 20,
        unite: a.unite,
      })),
      medicamentsDejaFactures
    );
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

VÉSÉRINAIRE SIGNATAIRE : ${veterinaire || "Dr. Vétérinaire"}
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
1. Ne prescris JAMAIS d'antibiotiques (amoxicilline, amoxiclavulanate, céfovecine, métronidazole, etc.) sans indication infectieuse confirmée ou très probable.
2. Calcule toujours les doses en mg/kg si le poids est mentionné.
3. Prescris UNIQUEMENT ce qui est médicalement justifié.
4. AINS : précise la durée maximale (5-7j chien, 3-5j chat).
5. Corticoïdes : décroissance progressive.
6. Stupéfiants : mention "STUPÉFIANT — Ordonnance sécurisée obligatoire".
7. quantite_a_delivrer doit être un entier positif.
8. ANTI-DOUBLON STRICT : Si un même médicament est mentionné plusieurs fois dans la dictée, ne l'inclure QU'UNE SEULE FOIS.
Inclus le champ estDelivre (boolean).`,
      messages: [{
        role: "user",
        content: `Extrait de cette dictée les prescriptions médicamenteuses sous forme JSON structuré :
[{
  "nom_medicament": string,
  "dose": string,
  "voie_administration": string,
  "frequence": string,
  "duree": string,
  "quantite_a_delivrer": number,
  "unite": string,
  "justification": string,
  "estDelivre": boolean
}]

Réponds UNIQUEMENT avec le JSON valide.

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
    const normaliserNom = (nom: string): string => (nom ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, " ").trim().split(/\s+/).slice(0, 3).join(" ");
    const dedupMap = new Map<string, any>();
    for (const p of prescriptions) { const key = normaliserNom(p.nom_medicament ?? ""); if (key && !dedupMap.has(key)) dedupMap.set(key, p); }
    prescriptions = Array.from(dedupMap.values());
    const resultats = await Promise.all(prescriptions.map(async (p) => { const mots = p.nom_medicament.split(/\s+/).filter((m: string) => m.length > 2); let match = null; for (const mot of mots) { const [found] = await db.select({ id: stockMedicamentsTable.id, nom: stockMedicamentsTable.nom, prixVenteTTC: stockMedicamentsTable.prixVenteTTC, quantiteStock: stockMedicamentsTable.quantiteStock, unite: stockMedicamentsTable.unite }).from(stockMedicamentsTable).where(and(eq(stockMedicamentsTable.clinicId, req.clinicId), ilike(stockMedicamentsTable.nom, `%${mot}%`))).limit(1); if (found) { match = found; break; } } return { ...p, stockMatch: match }; }));
    return res.json({ prescriptions: resultats });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur lors de la dictée ordonnance" }); }
});

router.post("/confirmer-dictee-ordonnance", async (req, res) => {
  try {
    const { consultationId, patientId, veterinaire, prescriptions } = req.body;
    if (!consultationId || !prescriptions?.length) return res.status(400).json({ error: "consultationId et prescriptions requis" });
    const consId = Number(consultationId);
    const [cons] = await db.select({ id: consultationsTable.id }).from(consultationsTable).where(and(eq(consultationsTable.id, consId), eq(consultationsTable.clinicId, req.clinicId)));
    if (!cons) return res.status(404).json({ error: "Consultation introuvable" });
    const year = new Date().getFullYear();
    const [lastOrd] = await db.select({ num: ordonnancesTable.numeroOrdonnance }).from(ordonnancesTable).where(and(eq(ordonnancesTable.clinicId, req.clinicId), drizzleSql`numero_ordonnance LIKE ${"ORD-" + year + "-%"}`)).orderBy(desc(ordonnancesTable.id)).limit(1);
    const lastSeq = lastOrd?.num ? parseInt(lastOrd.num.split("-")[2] ?? "0") : 0;
    const numeroOrdonnance = `OQD$t�ear}-${String(lastSeq + 1).padStart(5, "0")}`;
    const cleanField = (v: any) => { if (v == null) return ""; const s = String(v).trim(); if (!s || s === "—" || s === "-" || /^null$/i.test(s)) return ""; return s; };
    const contenu = prescriptions.map((p: any) => { const delivre = p.estDelivre === false ? " [À acheter en pharmacie]" : " [Délivré en clinique]"; return [p.nom_medicament + delivre, cleanField(p.dose) && `Dose : ${cleanField(p.dose)}`, cleanField(p.voie_administration) && `Voie : ${cleanField(p.voie_administration)}`, cleanField(p.frequence) && `Fréquence : ${cleanField(p.frequence)}`, cleanField(p.duree) && `Durée : ${cleanField(p.duree)}`].filter(Boolean).join(" — "); }).join("\n");
    const [ordonnance] = await db.insert(ordonnancesTable).values({ clinicId: req.clinicId, consultationId: consId, patientId: patientId ? Number(patientId) : null, veterinaire: veterinaire ?? null, contenu, numeroOrdonnance, genereIA: true }).returning();
    const [existingFacture] = await db.select({ id: facturesTable.id, lignes: facturesTable.lignes, totalHT: facturesTable.totalHT, totalTVA: facturesTable.totalTVA, totalTTC: facturesTable.totalTTC }).from(facturesTable).where(and(eq(facturesTable.clinicId, req.clinicId), eq(facturesTable.consultationId, consId)));
    for (const p of prescriptions) { if (!p.stockMatch?.id) continue; const quantite = Math.max(1, Math.round(p.quantite_a_delivrer ?? 1)); await db.insert(mouvementsStockTable).values({ clinicId: req.clinicId, medicamentId: p.stockMatch.id, typeMouvement: "sortie_consultation", quantite: -quantite, consultationId: consId, factureId: existingFacture?.id ?? null, motif: `Ordonnance ${numeroOrdonnance} — ${p.nom_medicament}`, utilisateur: veterinaire ?? "Système" }); await db.update(stockMedicamentsTable).set({ quantiteStock: drizzleSql`quantite_stock - ${quantite}` }).where(and(eq(stockMedicamentsTable.clinicId, req.clinicId), eq(stockMedicamentsTable.id, p.stockMatch.id))); }
    const medicamentsDelivres = prescriptions.filter((p: any) => p.estDelivre !== false && p.stockMatch@.id && p.stockMatch?.prixVenteTTC);
    if (existingFacture?.id && medicamentsDelivres.length > 0) { const lignesExistantes = Array.isArray(existingFacture.lignes) ? existingFacture.lignes : []; const descExistantes = new Set(lignesExistantes.map((l: any) => (l.description ?? "").toLowerCase().trim())); const nouvLignes = medicamentsDelivres.filter((p: any) => !descExistantes.has((p.nom_medicament ?? "").toLowerCase().trim())).map((p: any) => { const quantite = Math.max(1, Math.round(p.quantite_a_delivrer ?? 1)); const prixTTC = Number(p.stockMatch.prixVenteTTC) || 0; const prixHT = prixTTC / 1.2; return { acteId: null, description: p.nom_medicament, quantite, prixUnitaire: prixHT, tvaRate: 20, montantHT: prixHT * quantite }; }); if (nouvLignes.length > 0) { const toutesLignes = [...lignesExistantes, ...nouvLignes]; const totalHT = toutesLignes.reduce((s, l) => s + (l.montantHT ?? 0), 0); await db.update(facturesTable).set({ lignes: toutesLignes, totalHT: String(totalHT.toFixed(2)), totalTVA: String((totalHT * 0.2).toFixed(2)), totalTTC: String((totalHT * 1.2).toFixed(2)) }).where(eq(facturesTable.id, existingFacture.id)); } }
    return res.status(201).json({ ordonnance: { ...ordonnance, createdAt: ordonnance.createdAt.toISOString(), updatedAt: ordonnance.updatedAt.toISOString() }, factureId: existingFacture?.id ?? null, medicamentsAjoutes: medicamentsDelivres.map((p: any) => p.nom_medicament) });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur lors de la confirmation de l'ordonnance" }); }
});

export default router;
