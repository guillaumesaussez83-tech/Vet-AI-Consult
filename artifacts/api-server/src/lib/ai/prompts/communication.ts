export interface ResumeClientBuildParams {
  diagnostic?: string | null;
  ordonnance?: string | null;
  notes?: string | null;
  espece?: string | null;
  nomAnimal?: string | null;
  nomProprietaire?: string | null;
}

export function buildResumeClientPrompt(params: ResumeClientBuildParams): string {
  const { diagnostic, ordonnance, notes, espece, nomAnimal, nomProprietaire } = params;
  return `Tu es un veterinaire bienveillant et pedagogue. Tu dois rediger un resume de consultation destine au proprietaire d'un animal de compagnie. Ce resume doit etre ecrit en langage simple, sans jargon medical.

INFORMATIONS :
${nomAnimal ? `- Nom de l'animal : ${nomAnimal}` : ""}
${espece ? `- Espece : ${espece}` : ""}
${nomProprietaire ? `- Proprietaire : ${nomProprietaire}` : ""}

DIAGNOSTIC MEDICAL :
${diagnostic || "Non precise"}

ORDONNANCE :
${ordonnance || "Aucune prescription"}
${notes ? `\nNOTES COMPLEMENTAIRES :\n${notes}` : ""}

Redige un resume de consultation destine au proprietaire avec les sections suivantes :
1. Ce que nous avons fait lors de cette consultation
2. Ce que nous avons trouve (diagnostic explique simplement)
3. Le traitement prescrit (chaque medicament explique : pourquoi, comment donner, combien de temps)
4. Les points d'attention importants (signes a surveiller, quand rappeler ou revenir)
5. Un message de conclusion rassurant

Le ton doit etre chaleureux, professionnel et rassurant. Ecris en "nous" (la clinique veterinaire).
Reponds UNIQUEMENT avec le resume, sans introduction ni commentaire.`;
}
