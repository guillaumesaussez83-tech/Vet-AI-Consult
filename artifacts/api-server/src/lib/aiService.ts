import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AI_MODEL, AI_MAX_TOKENS, TVA_RATE_MULTIPLIER } from "./constants";
import { searchVetKnowledge, formatRagContext } from "./vetKnowledgeService";
import type { ObjectStorageService } from "./objectStorage";

export interface DiagnosticParams {
  espece: string;
  race?: string | null;
  age?: string | null;
  poids?: number | null;
  sexe: string;
  sterilise: boolean;
  anamnese: string;
  examenClinique: string;
  examensComplementaires?: string | null;
  antecedents?: string | null;
  allergies?: string | null;
}

export interface DiagnosticItem {
  nom: string;
  probabilite: string;
  description: string;
}

export interface DiagnosticResult {
  diagnostics: DiagnosticItem[];
  recommandations: string;
  urgence: string;
  texteComplet: string;
}

export interface ResumeClientParams {
  diagnostic?: string | null;
  ordonnance?: string | null;
  notes?: string | null;
  espece?: string | null;
  nomAnimal?: string | null;
  nomProprietaire?: string | null;
}

export interface LigneFacture {
  acteId: number | null;
  description: string;
  quantite: number;
  prixUnitaire: number;
  tvaRate: number;
  montantHT: number;
}

export interface FactureVoixResult {
  lignes: LigneFacture[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  resume: string;
}

export interface ActeRef {
  id: number;
  nom: string;
  categorie: string;
  prixDefaut: number;
  tvaRate: number;
  unite?: string | null;
}

function parseDiagnosticResult(text: string): DiagnosticResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  return JSON.parse(jsonMatch[0]) as DiagnosticResult;
}

function fallbackDiagnostic(text: string): DiagnosticResult {
  return {
    diagnostics: [{ nom: "Diagnostic indéterminé", probabilite: "Modérée", description: text }],
    recommandations: "Consulter un spécialiste pour une évaluation approfondie",
    urgence: "Non urgent",
    texteComplet: text,
  };
}

/** Construit la requête RAG à partir des paramètres cliniques */
function buildRagQuery(params: DiagnosticParams): string {
  const parts: string[] = [params.espece];
  if (params.race) parts.push(params.race);
  if (params.age) parts.push(params.age);
  // Extraire les premiers mots-clés de l'anamnèse et de l'examen clinique
  parts.push(params.anamnese.substring(0, 300));
  parts.push(params.examenClinique.substring(0, 200));
  if (params.examensComplementaires) parts.push(params.examensComplementaires.substring(0, 150));
  return parts.filter(Boolean).join(" ");
}

// v1 — Reformulation anamnèse par dictée vocale
export async function reformulerAnamnese(transcript: string): Promise<{ anamnese: string }> {
  const prompt = `Tu es un vétérinaire qui prend des notes cliniques. Le texte suivant est une transcription brute d'une dictée vocale d'un vétérinaire ou d'une conversation avec un propriétaire d'animal.

TRANSCRIPTION BRUTE :
${transcript}

Reformule ce texte en une anamnèse médicale vétérinaire structurée, professionnelle et complète en français.
L'anamnèse doit :
- Être rédigée de manière claire et médicalement précise
- Organiser l'information de façon logique (motif principal, historique des symptômes, durée, évolution, contexte, traitements en cours, alimentation/hydratation, comportement)
- Éliminer les répétitions et les hésitations de la dictée
- Conserver tous les faits cliniques importants mentionnés
- Utiliser le vocabulaire médical vétérinaire approprié

Réponds UNIQUEMENT avec l'anamnèse reformulée, sans introduction ni commentaire.`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.short,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de réponse inattendu");
  return { anamnese: content.text.trim() };
}

// v1 — Structuration examen clinique par dictée
export async function structurerExamenClinique(transcript: string): Promise<{ examenClinique: string }> {
  const prompt = `Tu es un vétérinaire qui dicte ses notes d'examen clinique. Le texte suivant est une transcription brute de ses observations pendant l'examen physique d'un animal.

TRANSCRIPTION BRUTE :
${transcript}

Reformule et structure ce texte en un examen clinique vétérinaire complet et professionnel.
Le texte doit impérativement couvrir les éléments mentionnés et être organisé selon la structure classique :
- État général (attitude, état d'alerte, condition corporelle)
- Muqueuses (couleur, temps de recoloration capillaire)
- Paramètres vitaux (fréquence cardiaque, fréquence respiratoire, température si mentionnée)
- Auscultation cardiaque et pulmonaire
- Palpation abdominale
- Système locomoteur et posture
- Peau, pelage et phanères
- Ganglions lymphatiques
- Autres observations pertinentes

Garde uniquement ce qui est mentionné dans la transcription. N'invente aucune donnée.
Réponds UNIQUEMENT avec l'examen clinique structuré, sans introduction ni commentaire.`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.short,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de réponse inattendu");
  return { examenClinique: content.text.trim() };
}

// v2 — Diagnostic différentiel standard avec RAG ANMV/EMA/RESAPATH
export async function diagnosticDifferentiel(params: DiagnosticParams): Promise<DiagnosticResult> {
  const {
    espece, race, age, poids, sexe, sterilise,
    anamnese, examenClinique, examensComplementaires,
    antecedents, allergies,
  } = params;

  // ── RAG : récupérer les références vétérinaires pertinentes ──
  const ragResults = await searchVetKnowledge(buildRagQuery(params));
  const ragContext = formatRagContext(ragResults);

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
${examensComplementaires ? `\nEXAMENS COMPLÉMENTAIRES :\n${examensComplementaires}` : ""}
${poids ? `
CALCUL DE POSOLOGIE OBLIGATOIRE (poids = ${poids} kg) :
Pour CHAQUE médicament mentionné dans tes recommandations, tu DOIS calculer et indiquer :
• La dose totale en mg = posologie_mg/kg × ${poids} kg
• La posologie pratique en nombre de comprimés selon conditionnements standards
• La durée de traitement recommandée
Exemple : Carprofène 4 mg/kg/j × ${poids} kg = ${(4 * poids).toFixed(1)} mg/j → ${Math.ceil((4 * poids) / 50)} comprimé(s) de 50 mg une fois par jour pendant 5 à 7 jours
Ne laisse JAMAIS une posologie sans calcul concret si le poids est connu.` : ""}
${ragContext}
Réponds UNIQUEMENT avec un objet JSON valide (sans bloc de code markdown) ayant cette structure exacte :
{
  "diagnostics": [
    {"nom": "Nom du diagnostic 1", "probabilite": "Élevée/Modérée/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 2", "probabilite": "Élevée/Modérée/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 3", "probabilite": "Élevée/Modérée/Faible", "description": "Explication clinique concise"}
  ],
  "recommandations": "Recommandations thérapeutiques avec posologies CALCULÉES selon le poids de l'animal, conformes aux données ANMV/EMA/RESAPATH si disponibles",
  "urgence": "Urgence vitale/Urgence relative/Non urgent",
  "texteComplet": "Analyse clinique complète avec toutes les posologies calculées selon le poids réel de l'animal"
}`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.long,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de réponse inattendu");
  try {
    return parseDiagnosticResult(content.text.trim());
  } catch {
    return fallbackDiagnostic(content.text);
  }
}

// v2 — Diagnostic enrichi avec pièces jointes + RAG ANMV/EMA/RESAPATH
export async function diagnosticEnrichi(
  params: DiagnosticParams & { objectPaths?: string[] },
  storage: ObjectStorageService
): Promise<DiagnosticResult> {
  const {
    espece, race, age, poids, sexe, sterilise,
    anamnese, examenClinique, examensComplementaires,
    antecedents, allergies, objectPaths,
  } = params;

  // ── RAG : récupérer les références vétérinaires pertinentes ──
  const ragResults = await searchVetKnowledge(buildRagQuery(params));
  const ragContext = formatRagContext(ragResults);

  const textBlock = {
    type: "text" as const,
    text: `Tu es un vétérinaire expert en médecine des animaux de compagnie. Analyse le cas clinique complet suivant (incluant les résultats d'examens complémentaires fournis en pièces jointes) et propose un diagnostic différentiel structuré et enrichi.

INFORMATIONS SUR LE PATIENT :
- Espèce : ${espece || "Non précisée"}${race ? ` (Race : ${race})` : ""}
${age ? `- Âge : ${age}` : ""}
${poids ? `- Poids : ${poids} kg` : ""}
- Sexe : ${sexe || "Non précisé"}
- Stérilisé : ${sterilise ? "Oui" : "Non"}
${antecedents ? `- Antécédents médicaux : ${antecedents}` : ""}
${allergies ? `- Allergies connues : ${allergies}` : ""}

ANAMNÈSE :
${anamnese}

EXAMEN CLINIQUE :
${examenClinique}
${examensComplementaires ? `\nEXAMENS COMPLÉMENTAIRES (texte) :\n${examensComplementaires}` : ""}
${objectPaths && objectPaths.length > 0 ? "Des fichiers joints (radios, échos, bilans sanguins) sont fournis ci-dessus pour compléter votre analyse." : ""}
${poids ? `
CALCUL DE POSOLOGIE OBLIGATOIRE (poids = ${poids} kg) :
Pour CHAQUE médicament mentionné dans tes recommandations, tu DOIS calculer et indiquer :
• La dose totale en mg = posologie_mg/kg × ${poids} kg
• La posologie pratique en nombre de comprimés selon conditionnements standards
• La durée de traitement recommandée
Ne laisse JAMAIS une posologie sans calcul concret si le poids est connu.` : ""}
${ragContext}
Réponds UNIQUEMENT avec un objet JSON valide (sans bloc de code markdown) ayant cette structure exacte :
{
  "diagnostics": [
    {"nom": "Nom du diagnostic 1", "probabilite": "Élevée/Modérée/Faible", "description": "Explication clinique concise basée sur tous les éléments"},
    {"nom": "Nom du diagnostic 2", "probabilite": "Élevée/Modérée/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 3", "probabilite": "Élevée/Modérée/Faible", "description": "Explication clinique concise"}
  ],
  "recommandations": "Recommandations thérapeutiques avec posologies CALCULÉES selon le poids de l'animal, conformes aux données ANMV/EMA/RESAPATH si disponibles",
  "urgence": "Urgence vitale/Urgence relative/Non urgent",
  "texteComplet": "Analyse clinique complète avec toutes les posologies calculées selon le poids réel de l'animal"
}`,
  };

  const contentBlocks: any[] = [textBlock];

  if (Array.isArray(objectPaths) && objectPaths.length > 0) {
    for (const objPath of objectPaths) {
      try {
        const file = await storage.getObjectEntityFile(objPath);
        const [buffer] = await file.download();
        const base64 = buffer.toString("base64");
        const [metadata] = await file.getMetadata();
        const contentType = (metadata.contentType as string) || "image/jpeg";
        if (contentType === "application/pdf") {
          contentBlocks.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          });
        } else if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(contentType)) {
          contentBlocks.push({
            type: "image",
            source: { type: "base64", media_type: contentType, data: base64 },
          });
        }
      } catch {
        // Fichier ignoré silencieusement si inaccessible
      }
    }
  }

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.long,
    messages: [{ role: "user", content: contentBlocks }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de réponse inattendu");
  try {
    return parseDiagnosticResult(content.text.trim());
  } catch {
    return fallbackDiagnostic(content.text);
  }
}

// v1 — Résumé de consultation pour le propriétaire
export async function resumeClient(params: ResumeClientParams): Promise<{ resume: string }> {
  const { diagnostic, ordonnance, notes, espece, nomAnimal, nomProprietaire } = params;
  const prompt = `Tu es un vétérinaire bienveillant et pédagogue. Tu dois rédiger un résumé de consultation destiné au propriétaire d'un animal de compagnie. Ce résumé doit être écrit en langage simple, sans jargon médical, pour que le propriétaire comprenne bien ce qui s'est passé et l'importance du traitement.

INFORMATIONS :
${nomAnimal ? `- Nom de l'animal : ${nomAnimal}` : ""}
${espece ? `- Espèce : ${espece}` : ""}
${nomProprietaire ? `- Propriétaire : ${nomProprietaire}` : ""}

DIAGNOSTIC MÉDICAL :
${diagnostic || "Non précisé"}

ORDONNANCE :
${ordonnance || "Aucune prescription"}
${notes ? `\nNOTES COMPLÉMENTAIRES :\n${notes}` : ""}

Rédige un résumé de consultation destiné au propriétaire avec les sections suivantes :
1. Ce que nous avons fait lors de cette consultation (examen réalisé, de façon simple)
2. Ce que nous avons trouvé (le diagnostic expliqué simplement, le pronostic)
3. Le traitement prescrit (chaque médicament expliqué simplement : pourquoi, comment donner, pendant combien de temps)
4. Les points d'attention importants (signes à surveiller, quand rappeler ou revenir)
5. Un message de conclusion rassurant et encourageant

Le ton doit être chaleureux, professionnel et rassurant. Écris en "nous" (la clinique vétérinaire). Évite tout terme médical sans explication.
Réponds UNIQUEMENT avec le résumé, sans introduction ni commentaire.`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.short,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de réponse inattendu");
  return { resume: content.text.trim() };
}

// v1 — Génération de facture par dictée vocale
export async function genererFactureVoix(transcript: string, actes: ActeRef[]): Promise<FactureVoixResult> {
  const actesJson = actes.map(a => ({
    id: a.id,
    nom: a.nom,
    categorie: a.categorie,
    prixDefaut: a.prixDefaut,
    tvaRate: a.tvaRate,
    unite: a.unite,
  }));

  const prompt = `Tu es un assistant de facturation vétérinaire. Le texte suivant est la transcription d'un vétérinaire qui dicte les actes réalisés lors d'une consultation.

TRANSCRIPTION DU VÉTÉRINAIRE :
"${transcript}"

LISTE DES ACTES DISPONIBLES EN BASE DE DONNÉES :
${JSON.stringify(actesJson, null, 2)}

Analyse la transcription et génère les lignes de facturation.
Pour chaque acte ou produit mentionné :
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
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.short,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de réponse inattendu");

  const text = content.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Aucun JSON trouvé dans la réponse");

  const result = JSON.parse(jsonMatch[0]) as FactureVoixResult;

  const actesPrices = new Map(actes.map(a => [a.id, a.prixDefaut]));
  const lignesCorrigees: LigneFacture[] = (result.lignes ?? []).map(l => {
    const prix =
      l.acteId != null && actesPrices.has(l.acteId)
        ? (actesPrices.get(l.acteId) ?? l.prixUnitaire)
        : (l.prixUnitaire ?? 0);
    const montantHT = prix * (l.quantite ?? 1);
    return { ...l, prixUnitaire: prix, montantHT };
  });

  const totalHT = lignesCorrigees.reduce((s, l) => s + l.montantHT, 0);
  const totalTVA = totalHT * TVA_RATE_MULTIPLIER;
  const totalTTC = totalHT + totalTVA;

  return { ...result, lignes: lignesCorrigees, totalHT, totalTVA, totalTTC };
}
