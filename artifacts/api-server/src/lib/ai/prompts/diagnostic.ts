import { renderCardioUrgencesBlock } from "./cardioUrgences";

export interface DiagnosticBuildParams {
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

// Contexte clinique PARTAGE par le prompt synchrone et le prompt streame : patient,
// anamnese, examen, calcul de posologie obligatoire, bloc urgences cardio, contexte RAG.
// Centralise ici pour que les deux prompts restent rigoureusement synchronises -- en
// particulier l'injection du catalogue cardio (renderCardioUrgencesBlock), qui est une
// SECURITE CLINIQUE : si un seul des deux prompts l'oubliait, le streaming raterait des
// urgences vitales que le mode synchrone detecte.
function buildClinicalContext(params: DiagnosticBuildParams, ragContext: string): string {
  const { espece, race, age, poids, sexe, sterilise, anamnese, examenClinique,
    examensComplementaires, antecedents, allergies } = params;

  const posologieBlock = poids ? `
CALCUL DE POSOLOGIE OBLIGATOIRE (poids = ${poids} kg) :
Pour CHAQUE medicament mentionne dans tes recommandations, tu DOIS calculer et indiquer :
- La dose totale en mg = posologie_mg/kg x ${poids} kg
- La posologie pratique en nombre de comprimes selon conditionnements standards
- La duree de traitement recommandee
Ne laisse JAMAIS une posologie sans calcul concret si le poids est connu.` : "";

  return `INFORMATIONS SUR LE PATIENT :
- Espece : ${espece}${race ? ` (Race : ${race})` : ""}${age ? `\n- Age : ${age}` : ""}
${poids ? `- Poids : ${poids} kg` : ""}
- Sexe : ${sexe}
- Sterilise : ${sterilise ? "Oui" : "Non"}
${antecedents ? `- Antecedents medicaux : ${antecedents}` : ""}
${allergies ? `- Allergies connues : ${allergies}` : ""}

ANAMNESE :
${anamnese}

EXAMEN CLINIQUE :
${examenClinique}
${examensComplementaires ? `\nEXAMENS COMPLEMENTAIRES :\n${examensComplementaires}` : ""}
${posologieBlock}

${renderCardioUrgencesBlock()}

${ragContext}`;
}

export function buildDiagnosticPrompt(params: DiagnosticBuildParams, ragContext: string): string {
  // IMPORTANT : la consigne de sortie (format JSON) est placee EN TETE, avant le
  // bloc cardio (volumineux) et le contexte RAG, pour qu'elle ne soit jamais la
  // victime d'une troncature du prompt. Donnees cliniques ensuite ; RAG en dernier
  // (le moins critique si jamais une troncature survenait).
  return `Tu es un veterinaire expert en medecine des animaux de compagnie. Analyse le cas clinique ci-dessous et propose un diagnostic differentiel structure.

Reponds UNIQUEMENT avec un objet JSON valide (sans bloc de code markdown) ayant cette structure exacte (si aucun signal cardio n'est present : "urgencesVitales": [] et "urgenceVitaleDetectee": false) :
{
  "diagnostics": [
    {"nom": "Nom du diagnostic 1", "probabilite": "Elevee/Moderee/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 2", "probabilite": "Elevee/Moderee/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 3", "probabilite": "Elevee/Moderee/Faible", "description": "Explication clinique concise"}
  ],
  "recommandations": "Recommandations therapeutiques avec posologies CALCULEES selon le poids de l'animal",
  "urgence": "Urgence vitale/Urgence relative/Non urgent",
  "urgenceVitaleDetectee": false,
  "urgencesVitales": [
    {"signal": "id du signal cardio (ex: detresse-respiratoire-aigue)", "niveau": "alerte forte", "declencheurs": ["element reellement present dans l'anamnese ou l'examen"], "causeMortelle": "cause mortelle a ne pas rater meme si peu probable", "actionImmediate": "geste ou examen immediat (radio thorax, echo, ECG/Holter...)"}
  ],
  "texteComplet": "Analyse clinique complete avec toutes les posologies calculees selon le poids reel de l'animal"
}

${buildClinicalContext(params, ragContext)}`;
}

// Version STREAMEE du prompt diagnostic (SSE). Reponse en DEUX parties :
//   1. ANALYSE CLINIQUE en prose -> streamee au fil de l'eau au veterinaire (UX).
//   2. separateur "---JSON---" puis JSON structure -> parse cote serveur EN FIN de flux,
//      porteur de urgencesVitales/urgenceVitaleDetectee = la banniere de securite.
//
// POINT DE VIGILANCE (le coeur de cette etape) : la prose precede le JSON, donc une
// prose trop longue pourrait consommer tout le budget max_tokens AVANT le JSON et le
// tronquer -> urgencesVitales perdues -> banniere muette. Deux garde-fous dans le prompt :
//   (a) la prose est BORNEE (8-12 phrases, ~250 mots) ;
//   (b) le JSON est declare OBLIGATOIRE, "ne jamais omettre ni tronquer".
// Avec maxTokens "medium" (6000), une prose bornee (~400 tokens) laisse une marge tres
// large au JSON (~600 tokens). PAS de champ texteComplet ici : la prose EST le texte
// complet (re-injecte cote serveur dans le DiagnosticResult).
export function buildDiagnosticStreamPrompt(params: DiagnosticBuildParams, ragContext: string): string {
  return `Tu es un veterinaire expert en medecine des animaux de compagnie. Analyse le cas clinique ci-dessous.

Ta reponse comporte DEUX parties, dans cet ordre EXACT.

=== PARTIE 1 : ANALYSE CLINIQUE (prose, destinee au veterinaire) ===
Redige une analyse clinique CONCISE et DENSE : 8 a 12 phrases maximum (~250 mots).
Couvre le raisonnement diagnostique, les hypotheses principales et la conduite a tenir,
en integrant les posologies calculees selon le poids. PAS de longues listes a puces,
PAS de remplissage : sois directement utile en consultation.

=== PARTIE 2 : DONNEES STRUCTUREES (JSON, destine au logiciel) ===
Ecris ensuite le separateur EXACT, seul sur sa ligne :
---JSON---
Puis, immediatement apres, UNIQUEMENT un objet JSON valide (sans bloc de code markdown)
ayant cette structure exacte. Ce JSON est OBLIGATOIRE : ne l'omets JAMAIS et ne le tronque
jamais, meme si l'analyse precedente est longue. N'y repete PAS l'analyse en prose.
Si aucun signal cardio n'est present : "urgencesVitales": [] et "urgenceVitaleDetectee": false.
{
  "diagnostics": [
    {"nom": "Nom du diagnostic 1", "probabilite": "Elevee/Moderee/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 2", "probabilite": "Elevee/Moderee/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 3", "probabilite": "Elevee/Moderee/Faible", "description": "Explication clinique concise"}
  ],
  "recommandations": "Recommandations therapeutiques avec posologies CALCULEES selon le poids de l'animal",
  "urgence": "Urgence vitale/Urgence relative/Non urgent",
  "urgenceVitaleDetectee": false,
  "urgencesVitales": [
    {"signal": "id du signal cardio (ex: detresse-respiratoire-aigue)", "niveau": "alerte forte", "declencheurs": ["element reellement present dans l'anamnese ou l'examen"], "causeMortelle": "cause mortelle a ne pas rater meme si peu probable", "actionImmediate": "geste ou examen immediat (radio thorax, echo, ECG/Holter...)"}
  ]
}

${buildClinicalContext(params, ragContext)}`;
}
