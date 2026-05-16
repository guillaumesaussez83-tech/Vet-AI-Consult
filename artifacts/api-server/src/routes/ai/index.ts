import { Router } from "express";
import {
  db,
  actesTable,
  stockMedicamentsTable,
  ordonnancesTable,
  facturesTable,
  mouvementsStockTable,
  consultationsTable,
  patientsTable,
} from "@workspace/db"; // actesTable used by generer-facture-voix
import { GetDiagnosticIABody } from "@workspace/api-zod";
import { eq, and, ilike, desc, sql as drizzleSql } from "drizzle-orm";
import { ObjectStorageService } from "../../lib/objectStorage";
import { aiLimiter, pdfLimiter } from "../../middlewares/aiRateLimiter";
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
    if (!body.success) return res.status(400).json({ error: "DonnÃÂ©es invalides" });
    const result = await diagnosticDifferentiel(body.data);
    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la gÃÂ©nÃÂ©ration du diagnostic IA" });
  }
});

router.post("/diagnostic-enrichi", async (req, res) => {
  try {
    const { espece, race, age, poids, sexe, sterilise, anamnese, examenClinique, examensComplementaires, antecedents, allergies, objectPaths } = req.body;
    if (!anamnese || !examenClinique) {
      return res.status(400).json({ error: "AnamnÃÂ¨se et examen clinique requis" });
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
    return res.status(500).json({ error: "Erreur lors de la reformulation de l'anamnÃÂ¨se" });
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
    return res.status(500).json({ error: "Erreur lors de la gÃÂ©nÃÂ©ration du rÃÂ©sumÃÂ© client" });
  }
});

// CHANGE 5: Accept medicamentsDejaFactures from request body
router.post("/generer-facture-voix", pdfLimiter, async (req, res) => {
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
    return res.status(500).json({ error: "Erreur lors de la gÃÂ©nÃÂ©ration de la facture vocale" });
  }
});

router.post("/certificat", pdfLimiter, async (req, res) => {
  try {
    const { type, patient, owner, vaccinations, consultations, actes, veterinaire, clinique, cliniqueInfo } = req.body;
    if (!type || !patient) return res.status(400).json({ error: "type et patient requis" });
    const templates: Record<string, string> = {
      bonne_sante: "Certificat de bonne santÃÂ© pour voyage UE (ÃÂ©tat gÃÂ©nÃÂ©ral, vaccins, puce, date examen)",
      cession: "Certificat de cession pour vente (ÃÂ©tat de santÃÂ©, vaccins, vermifugations, absence de pathologie connue)",
      aptitude: "Certificat d'aptitude pour concours ou ÃÂ©levage (examen complet systÃÂ¨mes, locomoteur, cardiaque, respiratoire)",
      soins: "Attestation de soins pour assurance (liste actes, diagnostic, pronostic, durÃÂ©e traitement)",
      ordonnance: "Ordonnance sÃÂ©curisÃÂ©e (numÃÂ©ro vÃÂ©tÃÂ©rinaire, date, posologie dÃÂ©taillÃÂ©e, durÃÂ©e traitement, mentions lÃÂ©gales)",
    };
    const templateDesc = templates[type] ?? type;
    const ci = cliniqueInfo ?? {};
    const adresseComplete = [ci.adresse, ci.codePostal && ci.ville ? `${ci.codePostal} ${ci.ville}` : (ci.ville || "")].filter(Boolean).join(", ");
    const prompt = `Tu es vÃÂ©tÃÂ©rinaire praticien en France. GÃÂ©nÃÂ¨re un ${templateDesc} officiel et professionnel.

DONNÃÂES PATIENT :
${JSON.stringify(patient, null, 2)}

PROPRIÃÂTAIRE :
${JSON.stringify(owner, null, 2)}

${vaccinations?.length ? `HISTORIQUE VACCINAL :\n${JSON.stringify(vaccinations, null, 2)}` : ""}
${consultations?.length ? `CONSULTATIONS RÃÂCENTES :\n${JSON.stringify(consultations.slice(0, 3), null, 2)}` : ""}
${actes?.length ? `ACTES RÃÂALISÃÂS :\n${JSON.stringify(actes, null, 2)}` : ""}

VÃÂSÃÂRINAIRE SIGNATAIRE : ${veterinaire || "Dr. VÃÂ©tÃÂ©rinaire"}
CLINIQUE : ${ci.nom || clinique || "Clinique vÃÂ©tÃÂ©rinaire"}
${adresseComplete ? `ADRESSE : ${adresseComplete}` : ""}
${ci.telephone ? `TÃÂLÃÂPHONE : ${ci.telephone}` : ""}
${ci.email ? `EMAIL : ${ci.email}` : ""}
${ci.numeroOrdre ? `NÃÂ° ORDRE : ${ci.numeroOrdre}` : ""}
${ci.siret ? `SIRET : ${ci.siret}` : ""}
DATE : ${new Date().toLocaleDateString("fr-FR")}

INSTRUCTIONS :
- GÃÂ©nÃÂ¨re le certificat complet, professionnel, conforme aux exigences lÃÂ©gales franÃÂ§aises.
- Utilise les coordonnÃÂ©es exactes fournies ci-dessus Ã¢ÂÂ n'utilise JAMAIS de placeholders comme [Adresse du cabinet], [XXXX], [email@example.com], etc.
- Inclus toutes les mentions obligatoires.
- Utilise un format structurÃÂ© avec en-tÃÂªte (coordonnÃÂ©es clinique + vÃÂ©tÃÂ©rinaire), corps du document et signature.

RÃÂ©ponds UNIQUEMENT avec le texte du certificat, prÃÂªt ÃÂ  imprimer.`;
    const message = await (await import("@workspace/integrations-anthropic-ai")).anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const content = message.content[0];
    if (content.type !== "text") throw new Error("RÃÂ©ponse inattendue");
    return res.json({ certificat: content.text.trim() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la gÃÂ©nÃÂ©ration du certificat" });
  }
});

router.post("/carnet-vaccinations", async (req, res) => {
  try {
    const { patient, owner, vaccinations } = req.body;
    if (!patient) return res.status(400).json({ error: "patient requis" });
    const prompt = `Tu es vÃÂ©tÃÂ©rinaire. GÃÂ©nÃÂ¨re un rÃÂ©sumÃÂ© du carnet de santÃÂ© vaccinal pour ce patient animal.

ANIMAL : ${JSON.stringify(patient)}
PROPRIÃÂTAIRE : ${JSON.stringify(owner)}
VACCINATIONS : ${JSON.stringify(vaccinations ?? [])}
DATE D'AUJOURD'HUI : ${new Date().toLocaleDateString("fr-FR")}

GÃÂ©nÃÂ¨re un bilan vaccinal complet et professionnel qui explique :
1. Les vaccins rÃÂ©alisÃÂ©s et leur date
2. Les rappels ÃÂ  venir (prochains 6 mois)
3. Les vaccins en retard s'il y en a
4. Les recommandations vaccinales pour l'espÃÂ¨ce
5. Un rÃÂ©sumÃÂ© de protection actuelle

RÃÂ©ponds en franÃÂ§ais, de faÃÂ§on claire et lisible pour le propriÃÂ©taire.`;
    const message = await (await import("@workspace/integrations-anthropic-ai")).anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const content = message.content[0];
    if (content.type !== "text") throw new Error("RÃÂ©ponse inattendue");
    return res.json({ carnet: content.text.trim() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la gÃÂ©nÃÂ©ration du carnet" });
  }
});

router.post("/dictee-ordonnance", async (req, res) => {
  try {
    const { transcription } = req.body;
    if (!transcription || typeof transcription !== "string" || !transcription.trim()) {
      return res.status(400).json({ error: "Le texte de la dictÃÂ©e est requis" });
    }
    const { anthropic } = await import("@workspace/integrations-anthropic-ai");
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `Tu es un vÃÂ©tÃÂ©rinaire praticien expert en France. Tu gÃÂ©nÃÂ¨res des ordonnances vÃÂ©tÃÂ©rinaires prÃÂ©cises et mÃÂ©dicalement justifiÃÂ©es ÃÂ  partir de dictÃÂ©es vocales.

RÃÂGLES STRICTES :
1. Ne prescris JAMAIS d'antibiotiques (amoxicilline, amoxiclavulanate, cÃÂ©fovecine, mÃÂ©tronidazole, etc.) sans indication infectieuse confirmÃÂ©e ou trÃÂ¨s probable.
2. Calcule toujours les doses en mg/kg si le poids est mentionnÃÂ©.
3. Prescris UNIQUEMENT ce qui est mÃÂ©dicalement justifiÃÂ©.
4. AINS : prÃÂ©cise la durÃÂ©e maximale (5-7j chien, 3-5j chat).
5. CorticoÃÂ¯des : dÃÂ©croissance progressive.
6. StupÃÂ©fiants : mention "STUPÃÂFIANT Ã¢ÂÂ Ordonnance sÃÂ©curisÃÂ©e obligatoire".
7. quantite_a_delivrer doit ÃÂªtre un entier positif.
8. ANTI-DOUBLON STRICT : Si un mÃÂªme mÃÂ©dicament est mentionnÃÂ© plusieurs fois dans la dictÃÂ©e, ne l'inclure QU'UNE SEULE FOIS.
Inclus le champ estDelivre (boolean).`,
      messages: [{
        role: "user",
        content: `Extrait de cette dictÃÂ©e les prescriptions mÃÂ©dicamenteuses sous forme JSON structurÃÂ© :
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

RÃÂ©ponds UNIQUEMENT avec le JSON valide.

Texte de la dictÃÂ©e : "${transcription}"`
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
    const normaliserNom = (nom: string): string => (nom ?? "").toLowerCase().normalize("NFD").replace(/[ÃÂ-ÃÂ¯]/g, "").replace(/[^a-z0-9]/g, " ").trim().split(/\s+/).slice(0, 3).join(" ");
    const dedupMap = new Map<string, any>();
    for (const p of prescriptions) { const key = normaliserNom(p.nom_medicament ?? ""); if (key && !dedupMap.has(key)) dedupMap.set(key, p); }
    prescriptions = Array.from(dedupMap.values());
    const resultats = await Promise.all(prescriptions.map(async (p) => { const mots = p.nom_medicament.split(/\s+/).filter((m: string) => m.length > 2); let match = null; for (const mot of mots) { const [found] = await db.select({ id: stockMedicamentsTable.id, nom: stockMedicamentsTable.nom, prixVenteTTC: stockMedicamentsTable.prixVenteTTC, quantiteStock: stockMedicamentsTable.quantiteStock, unite: stockMedicamentsTable.unite }).from(stockMedicamentsTable).where(and(eq(stockMedicamentsTable.clinicId, req.clinicId), ilike(stockMedicamentsTable.nom, `%${mot}%`))).limit(1); if (found) { match = found; break; } } return { ...p, stockMatch: match }; }));
    return res.json({ prescriptions: resultats });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur lors de la dictÃÂ©e ordonnance" }); }
});

router.post("/confirmer-dictee-ordonnance", async (req, res) => {
  try {
    const { consultationId, patientId, veterinaire, prescriptions } = req.body;
    if (!consultationId || !prescriptions?.length) return res.status(400).json({ error: "consultationId et prescriptions requis" });
    const consId = Number(consultationId);
    const [cons] = await db.select({ id: consultationsTable.id }).from(consultationsTable).where(and(eq(consultationsTable.id, consId), eq(consultationsTable.clinicId, req.clinicId)));
    if (!cons) return res.status(404).json({ error: "Consultation introuvable" });
    if (patientId) { const [_pat] = await db.select({ id: patientsTable.id }).from(patientsTable).where(and(eq(patientsTable.id, Number(patientId)), eq(patientsTable.clinicId, req.clinicId))); if (!_pat) return res.status(403).json({ error: "Patient non autorisé" }); }
    const year = new Date().getFullYear();
    const [lastOrd] = await db.select({ num: ordonnancesTable.numeroOrdonnance }).from(ordonnancesTable).where(and(eq(ordonnancesTable.clinicId, req.clinicId), drizzleSql`numero_ordonnance LIKE ${"ORD-" + year + "-%"}`)).orderBy(desc(ordonnancesTable.id)).limit(1);
    const lastSeq = lastOrd?.num ? parseInt(lastOrd.num.split("-")[2] ?? "0") : 0;
    const numeroOrdonnance = `ORD-${year}-${String(lastSeq + 1).padStart(5, "0")}`;
    const cleanField = (v: any) => { if (v == null) return ""; const s = String(v).trim(); if (!s || s === "Ã¢ÂÂ" || s === "-" || /^null$/i.test(s)) return ""; return s; };
    const contenu = prescriptions.map((p: any) => { const delivre = p.estDelivre === false ? " [ÃÂ acheter en pharmacie]" : " [DÃÂ©livrÃÂ© en clinique]"; return [p.nom_medicament + delivre, cleanField(p.dose) && `Dose : ${cleanField(p.dose)}`, cleanField(p.voie_administration) && `Voie : ${cleanField(p.voie_administration)}`, cleanField(p.frequence) && `FrÃÂ©quence : ${cleanField(p.frequence)}`, cleanField(p.duree) && `DurÃÂ©e : ${cleanField(p.duree)}`].filter(Boolean).join(" Ã¢ÂÂ "); }).join("\n");
    const { ordonnance, medicamentsDelivres } = await db.transaction(async (tx) => {
      const [ordonnance] = await tx.insert(ordonnancesTable).values({ clinicId: req.clinicId, consultationId: consId, patientId: patientId ? Number(patientId) : null, veterinaire: veterinaire ?? null, contenu, numeroOrdonnance, genereIA: true }).returning();
      const [existingFacture] = await tx.select({ id: facturesTable.id, lignes: facturesTable.lignes, totalHT: facturesTable.totalHT, totalTVA: facturesTable.totalTVA, totalTTC: facturesTable.totalTTC }).from(facturesTable).where(and(eq(facturesTable.clinicId, req.clinicId), eq(facturesTable.consultationId, consId)));
      for (const p of prescriptions) { if (!p.stockMatch?.id) continue; const quantite = Math.max(1, Math.round(p.quantite_a_delivrer ?? 1)); await tx.insert(mouvementsStockTable).values({ clinicId: req.clinicId, medicamentId: p.stockMatch.id, typeMouvement: "sortie_consultation", quantite: -quantite, consultationId: consId, factureId: existingFacture?.id ?? null, motif: `Ordonnance ${numeroOrdonnance} Ã¢ÂÂ ${p.nom_medicament}`, utilisateur: veterinaire ?? "SystÃÂ¨me" }); await tx.update(stockMedicamentsTable).set({ quantiteStock: drizzleSql`quantite_stock - ${quantite}` }).where(and(eq(stockMedicamentsTable.clinicId, req.clinicId), eq(stockMedicamentsTable.id, p.stockMatch.id))); }
      const medicamentsDelivres = prescriptions.filter((p: any) => p.estDelivre !== false && p.stockMatch?.id && p.stockMatch?.prixVenteTTC);
      if (existingFacture?.id && medicamentsDelivres.length > 0) { const lignesExistantes = Array.isArray(existingFacture.lignes) ? existingFacture.lignes : []; const descExistantes = new Set(lignesExistantes.map((l: any) => (l.description ?? "").toLowerCase().trim())); const nouvLignes = medicamentsDelivres.filter((p: any) => !descExistantes.has((p.nom_medicament ?? "").toLowerCase().trim())).map((p: any) => { const quantite = Math.max(1, Math.round(p.quantite_a_delivrer ?? 1)); const prixTTC = Number(p.stockMatch.prixVenteTTC) || 0; const prixHT = prixTTC / 1.2; return { acteId: null, description: p.nom_medicament, quantite, prixUnitaire: prixHT, tvaRate: 20, montantHT: prixHT * quantite }; }); if (nouvLignes.length > 0) { const toutesLignes = [...lignesExistantes, ...nouvLignes]; const totalHT = toutesLignes.reduce((s, l) => s + (l.montantHT ?? 0), 0); await tx.update(facturesTable).set({ lignes: toutesLignes, totalHT: String(totalHT.toFixed(2)), totalTVA: String((totalHT * 0.2).toFixed(2)), totalTTC: String((totalHT * 1.2).toFixed(2)) }).where(eq(facturesTable.id, existingFacture.id)); } }
      return { ordonnance, medicamentsDelivres };
    });
    return res.status(201).json({ ordonnance: { ...ordonnance, createdAt: ordonnance.createdAt.toISOString(), updatedAt: ordonnance.updatedAt.toISOString() }, factureId: existingFacture?.id ?? null, medicamentsAjoutes: medicamentsDelivres.map((p: any) => p.nom_medicament) });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur lors de la confirmation de l'ordonnance" }); }
});

// GET /budget — budget IA 30 jours depuis v_ai_budget_clinic_30d
router.get("/budget", async (req, res) => {
  try {
    const clinicId = req.clinicId;
    if (!clinicId) return res.status(401).json({ error: "Non autorise" });

    const result = await db.execute(
      drizzleSql`
        SELECT *
        FROM v_ai_budget_clinic_30d
        WHERE clinic_id = ${clinicId}
        LIMIT 1
      `
    );

    const row = result.rows?.[0] ?? null;
    if (!row) {
      return res.status(200).json({
        clinicId,
        nb_appels: 0,
        consults_avec_ia: 0,
        cout_total_usd: 0,
        cout_moyen_par_consult_usd: 0,
        latence_moyenne_ms: null,
        nb_appels_sonnet: 0,
        nb_appels_mini: 0,
        alerte_budget: false,
        seuil_alerte: 0.15,
        message: "Aucune donnee IA sur les 30 derniers jours",
      });
    }

    return res.status(200).json({
      ...row,
      seuil_alerte: 0.15,
      cout_total_usd: Number(row.cout_total_usd ?? 0),
      cout_moyen_par_consult_usd: Number(row.cout_moyen_par_consult_usd ?? 0),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur budget IA" });
  }
});

export default router;
