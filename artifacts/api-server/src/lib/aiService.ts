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
    diagnostics: [{ nom: "Diagnostic indÃ©terminÃ©", probabilite: "ModÃ©rÃ©e", description: text }],
    recommandations: "Consulter un spÃ©cialiste pour une Ã©valuation approfondie",
    urgence: "Non urgent",
    texteComplet: text,
  };
}

/** Construit la requÃªte RAG Ã  partir des paramÃ¨tres cliniques */
function buildRagQuery(params: DiagnosticParams): string {
  const parts: string[] = [params.espece];
  if (params.race) parts.push(params.race);
  if (params.age) parts.push(params.age);
  parts.push(params.anamnese.substring(0, 300));
  parts.push(params.examenClinique.substring(0, 200));
  if (params.examensComplementaires) parts.push(params.examensComplementaires.substring(0, 150));
  return parts.filter(Boolean).join(" ");
}

// v1 â Reformulation anamnÃ¨se par dictÃ©e vocale
export async function reformulerAnamnese(transcript: string): Promise<{ anamnese: string }> {
  const prompt = `Tu es un vÃ©tÃ©rinaire qui prend des notes cliniques. Le texte suivant est une transcription brute d'une dictÃ©e vocale d'un vÃ©tÃ©rinaire ou d'une conversation avec un propriÃ©taire d'animal.

TRANSCRIPTION BRUTE :
${transcript}

Reformule ce texte en une anamnÃ¨se mÃ©dicale vÃ©tÃ©rinaire structurÃ©e, professionnelle et complÃ¨te en franÃ§ais.
L'anamnÃ¨se doit :
- Ãtre rÃ©digÃ©e de maniÃ¨re claire et mÃ©dicalement prÃ©cise
- Organiser l'information de faÃ§on logique (motif principal, historique des symptÃ´mes, durÃ©e, Ã©volution, contexte, traitements en cours, alimentation/hydratation, comportement)
- Ãliminer les rÃ©pÃ©titions et les hÃ©sitations de la dictÃ©e
- Conserver tous les faits cliniques importants mentionnÃ©s
- Utiliser le vocabulaire mÃ©dical vÃ©tÃ©rinaire appropriÃ©

RÃ©ponds UNIQUEMENT avec l'anamnÃ¨se reformulÃ©e, sans introduction ni commentaire.`;
  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.short,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de rÃ©ponse inattendu");
  return { anamnese: content.text.trim() };
}

// v1 â Structuration examen clinique par dictÃ©e
export async function structurerExamenClinique(transcript: string): Promise<{ examenClinique: string }> {
  const prompt = `Tu es un vÃ©tÃ©rinaire qui dicte ses notes d'examen clinique. Le texte suivant est une transcription brute de ses observations pendant l'examen physique d'un animal.

TRANSCRIPTION BRUTE :
${transcript}

Reformule et structure ce texte en un examen clinique vÃ©tÃ©rinaire complet et professionnel.
Le texte doit impÃ©rativement couvrir les Ã©lÃ©ments mentionnÃ©s et Ãªtre organisÃ© selon la structure classique :
- Ãtat gÃ©nÃ©ral (attitude, Ã©tat d'alerte, condition corporelle)
- Muqueuses (couleur, temps de recoloration capillaire)
- ParamÃ¨tres vitaux (frÃ©quence cardiaque, frÃ©quence respiratoire, tempÃ©rature si mentionnÃ©e)
- Auscultation cardiaque et pulmonaire
- Palpation abdominale
- SystÃ¨me locomoteur et posture
- Peau, pelage et phanÃ¨res
- Ganglions lymphatiques
- Autres observations pertinentes

Garde uniquement ce qui est mentionnÃ© dans la transcription. N'invente aucune donnÃ©e.
RÃ©ponds UNIQUEMENT avec l'examen clinique structurÃ©, sans introduction ni commentaire.`;
  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.short,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de rÃ©ponse inattendu");
  return { examenClinique: content.text.trim() };
}

// v2 â Diagnostic diffÃ©rentiel standard avec RAG ANMV/EMA/RESAPATH
export async function diagnosticDifferentiel(params: DiagnosticParams): Promise<DiagnosticResult> {
  const {
    espece, race, age, poids, sexe, sterilise, anamnese, examenClinique,
    examensComplementaires, antecedents, allergies,
  } = params;

  // ââ RAG : rÃ©cupÃ©rer les rÃ©fÃ©rences vÃ©tÃ©rinaires pertinentes ââ
  const ragResults = await searchVetKnowledge(buildRagQuery(params));
  const ragContext = formatRagContext(ragResults);

  const prompt = `Tu es un vÃ©tÃ©rinaire expert en mÃ©decine des animaux de compagnie. Analyse le cas clinique suivant et propose un diagnostic diffÃ©rentiel structurÃ©.

INFORMATIONS SUR LE PATIENT :
- EspÃ¨ce : ${espece}${race ? ` (Race : ${race})` : ""}
${age ? `- Ãge : ${age}` : ""}
${poids ? `- Poids : ${poids} kg` : ""}
- Sexe : ${sexe}
- StÃ©rilisÃ© : ${sterilise ? "Oui" : "Non"}
${antecedents ? `- AntÃ©cÃ©dents mÃ©dicaux : ${antecedents}` : ""}
${allergies ? `- Allergies connues : ${allergies}` : ""}

ANAMNÃSE :
${anamnese}

EXAMEN CLINIQUE :
${examenClinique}
${examensComplementaires ? `\nEXAMENS COMPLÃMENTAIRES :\n${examensComplementaires}` : ""}
${poids ? `
CALCUL DE POSOLOGIE OBLIGATOIRE (poids = ${poids} kg) :
Pour CHAQUE mÃ©dicament mentionnÃ© dans tes recommandations, tu DOIS calculer et indiquer :
â¢ La dose totale en mg = posologie_mg/kg Ã ${poids} kg
â¢ La posologie pratique en nombre de comprimÃ©s selon conditionnements standards
â¢ La durÃ©e de traitement recommandÃ©e
Exemple : CarprofÃ¨ne 4 mg/kg/j Ã ${poids} kg = ${(4 * poids).toFixed(1)} mg/j â ${Math.ceil((4 * poids) / 50)} comprimÃ©(s) de 50 mg une fois par jour pendant 5 Ã  7 jours
Ne laisse JAMAIS une posologie sans calcul concret si le poids est connu.` : ""}
${ragContext}

RÃ©ponds UNIQUEMENT avec un objet JSON valide (sans bloc de code markdown) ayant cette structure exacte :
{
  "diagnostics": [
    {"nom": "Nom du diagnostic 1", "probabilite": "ÃlevÃ©e/ModÃ©rÃ©e/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 2", "probabilite": "ÃlevÃ©e/ModÃ©rÃ©e/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 3", "probabilite": "ÃlevÃ©e/ModÃ©rÃ©e/Faible", "description": "Explication clinique concise"}
  ],
  "recommandations": "Recommandations thÃ©rapeutiques avec posologies CALCULÃES selon le poids de l'animal, conformes aux donnÃ©es ANMV/EMA/RESAPATH si disponibles",
  "urgence": "Urgence vitale/Urgence relative/Non urgent",
  "texteComplet": "Analyse clinique complÃ¨te avec toutes les posologies calculÃ©es selon le poids rÃ©el de l'animal"
}`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.long,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de rÃ©ponse inattendu");
  try {
    return parseDiagnosticResult(content.text.trim());
  } catch {
    return fallbackDiagnostic(content.text);
  }
}

// v2 â Diagnostic enrichi avec piÃ¨ces jointes + RAG ANMV/EMA/RESAPATH
export async function diagnosticEnrichi(
  params: DiagnosticParams & { objectPaths?: string[] },
  storage: ObjectStorageService
): Promise<DiagnosticResult> {
  const {
    espece, race, age, poids, sexe, sterilise, anamnese, examenClinique,
    examensComplementaires, antecedents, allergies, objectPaths,
  } = params;

  // ââ RAG : rÃ©cupÃ©rer les rÃ©fÃ©rences vÃ©tÃ©rinaires pertinentes ââ
  const ragResults = await searchVetKnowledge(buildRagQuery(params));
  const ragContext = formatRagContext(ragResults);

  const textBlock = {
    type: "text" as const,
    text: `Tu es un vÃ©tÃ©rinaire expert en mÃ©decine des animaux de compagnie. Analyse le cas clinique complet suivant (incluant les rÃ©sultats d'examens complÃ©mentaires fournis en piÃ¨ces jointes) et propose un diagnostic diffÃ©rentiel structurÃ© et enrichi.

INFORMATIONS SUR LE PATIENT :
- EspÃ¨ce : ${espece || "Non prÃ©cisÃ©e"}${race ? ` (Race : ${race})` : ""}
${age ? `- Ãge : ${age}` : ""}
${poids ? `- Poids : ${poids} kg` : ""}
- Sexe : ${sexe || "Non prÃ©cisÃ©"}
- StÃ©rilisÃ© : ${sterilise ? "Oui" : "Non"}
${antecedents ? `- AntÃ©cÃ©dents mÃ©dicaux : ${antecedents}` : ""}
${allergies ? `- Allergies connues : ${allergies}` : ""}

ANAMNÃSE :
${anamnese}

EXAMEN CLINIQUE :
${examenClinique}
${examensComplementaires ? `\nEXAMENS COMPLÃMENTAIRES (texte) :\n${examensComplementaires}` : ""}
${objectPaths && objectPaths.length > 0 ? "Des fichiers joints (radios, Ã©chos, bilans sanguins) sont fournis ci-dessus pour complÃ©ter votre analyse." : ""}
${poids ? `
CALCUL DE POSOLOGIE OBLIGATOIRE (poids = ${poids} kg) :
Pour CHAQUE mÃ©dicament mentionnÃ© dans tes recommandations, tu DOIS calculer et indiquer :
â¢ La dose totale en mg = posologie_mg/kg Ã ${poids} kg
â¢ La posologie pratique en nombre de comprimÃ©s selon conditionnements standards
â¢ La durÃ©e de traitement recommandÃ©e
Ne laisse JAMAIS une posologie sans calcul concret si le poids est connu.` : ""}
${ragContext}

RÃ©ponds UNIQUEMENT avec un objet JSON valide (sans bloc de code markdown) ayant cette structure exacte :
{
  "diagnostics": [
    {"nom": "Nom du diagnostic 1", "probabilite": "ÃlevÃ©e/ModÃ©rÃ©e/Faible", "description": "Explication clinique concise basÃ©e sur tous les Ã©lÃ©ments"},
    {"nom": "Nom du diagnostic 2", "probabilite": "ÃlevÃ©e/ModÃ©rÃ©e/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 3", "probabilite": "ÃlevÃ©e/ModÃ©rÃ©e/Faible", "description": "Explication clinique concise"}
  ],
  "recommandations": "Recommandations thÃ©rapeutiques avec posologies CALCULÃES selon le poids de l'animal, conformes aux donnÃ©es ANMV/EMA/RESAPATH si disponibles",
  "urgence": "Urgence vitale/Urgence relative/Non urgent",
  "texteComplet": "Analyse clinique complÃ¨te avec toutes les posologies calculÃ©es selon le poids rÃ©el de l'animal"
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
          contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } });
        } else if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(contentType)) {
          contentBlocks.push({ type: "image", source: { type: "base64", media_type: contentType, data: base64 } });
        }
      } catch {
        // Fichier ignorÃ© silencieusement si inaccessible
      }
    }
  }

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.long,
    messages: [{ role: "user", content: contentBlocks }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de rÃ©ponse inattendu");
  try {
    return parseDiagnosticResult(content.text.trim());
  } catch {
    return fallbackDiagnostic(content.text);
  }
}

// v1 â RÃ©sumÃ© de consultation pour le propriÃ©taire
export async function resumeClient(params: ResumeClientParams): Promise<{ resume: string }> {
  const { diagnostic, ordonnance, notes, espece, nomAnimal, nomProprietaire } = params;
  const prompt = `Tu es un vÃ©tÃ©rinaire bienveillant et pÃ©dagogue. Tu dois rÃ©diger un rÃ©sumÃ© de consultation destinÃ© au propriÃ©taire d'un animal de compagnie. Ce rÃ©sumÃ© doit Ãªtre Ã©crit en langage simple, sans jargon mÃ©dical, pour que le propriÃ©taire comprenne bien ce qui s'est passÃ© et l'importance du traitement.

INFORMATIONS :
${nomAnimal ? `- Nom de l'animal : ${nomAnimal}` : ""}
${espece ? `- EspÃ¨ce : ${espece}` : ""}
${nomProprietaire ? `- PropriÃ©taire : ${nomProprietaire}` : ""}

DIAGNOSTIC MÃDICAL :
${diagnostic || "Non prÃ©cisÃ©"}

ORDONNANCE :
${ordonnance || "Aucune prescription"}
${notes ? `\nNOTES COMPLÃMENTAIRES :\n${notes}` : ""}

RÃ©dige un rÃ©sumÃ© de consultation destinÃ© au propriÃ©taire avec les sections suivantes :
1. Ce que nous avons fait lors de cette consultation (examen rÃ©alisÃ©, de faÃ§on simple)
2. Ce que nous avons trouvÃ© (le diagnostic expliquÃ© simplement, le pronostic)
3. Le traitement prescrit (chaque mÃ©dicament expliquÃ© simplement : pourquoi, comment donner, pendant combien de temps)
4. Les points d'attention importants (signes Ã  surveiller, quand rappeler ou revenir)
5. Un message de conclusion rassurant et encourageant

Le ton doit Ãªtre chaleureux, professionnel et rassurant. Ãcris en "nous" (la clinique vÃ©tÃ©rinaire). Ãvite tout terme mÃ©dical sans explication.
RÃ©ponds UNIQUEMENT avec le rÃ©sumÃ©, sans introduction ni commentaire.`;
  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.short,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de rÃ©ponse inattendu");
  return { resume: content.text.trim() };
}

// v2 â GÃ©nÃ©ration de facture par dictÃ©e vocale (avec exclusion des mÃ©dicaments dÃ©jÃ  dans l'ordonnance)
export async function genererFactureVoix(
  transcript: string,
  actes: ActeRef[],
  medicamentsDejaFactures: string[] = []
): Promise<FactureVoixResult> {
  const actesJson = actes.map(a => ({
    id: a.id,
    nom: a.nom,
    categorie: a.categorie,
    prixDefaut: a.prixDefaut,
    tvaRate: a.tvaRate,
    unite: a.unite,
  }));

  const exclusionNote = medicamentsDejaFactures.length > 0
    ? `\nMÃDICAMENTS DÃJÃ INTÃGRÃS DANS L'ORDONNANCE (NE PAS dupliquer dans la facture) :\n${medicamentsDejaFactures.map(m => `- ${m}`).join("\n")}\n`
    : "";

  const prompt = `Tu es un assistant de facturation vÃ©tÃ©rinaire. Le texte suivant est la transcription d'un vÃ©tÃ©rinaire qui dicte les actes rÃ©alisÃ©s lors d'une consultation.

TRANSCRIPTION DU VÃTÃRINAIRE :
"${transcript}"

LISTE DES ACTES DISPONIBLES EN BASE DE DONNÃES :
${JSON.stringify(actesJson, null, 2)}
${exclusionNote}
Analyse la transcription et gÃ©nÃ¨re les lignes de facturation.
Pour chaque acte ou produit mentionnÃ© :
1. Essaie de l'associer Ã  un acte de la base de donnÃ©es (utilise son id)
2. Si aucun acte ne correspond exactement, crÃ©e une ligne libre (acteId Ã  null) avec une description et un prix estimÃ© cohÃ©rent
3. Respecte les quantitÃ©s mentionnÃ©es (ex: "2 comprimÃ©s", "3 sÃ©ances")
4. TVA Ã  20% sur tous les actes
5. N'inclus JAMAIS les mÃ©dicaments listÃ©s dans "MÃDICAMENTS DÃJÃ INTÃGRÃS DANS L'ORDONNANCE"

RÃ©ponds UNIQUEMENT avec un JSON valide (sans markdown) de cette forme exacte :
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
  "resume": "Courte description de la facturation dictÃ©e"
}`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.short,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Type de rÃ©ponse inattendu");

  const text = content.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Aucun JSON trouvÃ© dans la rÃ©ponse");

  const result = JSON.parse(jsonMatch[0]) as FactureVoixResult;
  const actesPrices = new Map(actes.map(a => [a.id, a.prixDefaut]));
  const lignesCorrigees: LigneFacture[] = (result.lignes ?? []).map(l => {
    const prix = l.acteId != null && actesPrices.has(l.acteId)
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
