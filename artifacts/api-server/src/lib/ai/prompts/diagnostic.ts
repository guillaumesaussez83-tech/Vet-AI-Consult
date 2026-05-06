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

export function buildDiagnosticPrompt(params: DiagnosticBuildParams, ragContext: string): string {
  const { espece, race, age, poids, sexe, sterilise, anamnese, examenClinique,
    examensComplementaires, antecedents, allergies } = params;

  const posologieBlock = poids ? `
CALCUL DE POSOLOGIE OBLIGATOIRE (poids = ${poids} kg) :
Pour CHAQUE medicament mentionne dans tes recommandations, tu DOIS calculer et indiquer :
- La dose totale en mg = posologie_mg/kg x ${poids} kg
- La posologie pratique en nombre de comprimes selon conditionnements standards
- La duree de traitement recommandee
Ne laisse JAMAIS une posologie sans calcul concret si le poids est connu.` : "";

  return `Tu es un veterinaire expert en medecine des animaux de compagnie. Analyse le cas clinique suivant et propose un diagnostic differentiel structure.

INFORMATIONS SUR LE PATIENT :
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
${ragContext}

Reponds UNIQUEMENT avec un objet JSON valide (sans bloc de code markdown) ayant cette structure exacte :
{
  "diagnostics": [
    {"nom": "Nom du diagnostic 1", "probabilite": "Elevee/Moderee/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 2", "probabilite": "Elevee/Moderee/Faible", "description": "Explication clinique concise"},
    {"nom": "Nom du diagnostic 3", "probabilite": "Elevee/Moderee/Faible", "description": "Explication clinique concise"}
  ],
  "recommandations": "Recommandations therapeutiques avec posologies CALCULEES selon le poids de l'animal",
  "urgence": "Urgence vitale/Urgence relative/Non urgent",
  "texteComplet": "Analyse clinique complete avec toutes les posologies calculees selon le poids reel de l'animal"
}`;
}
