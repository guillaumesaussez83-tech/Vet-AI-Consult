export interface ActeRefPrompt {
  id: number;
  nom: string;
  categorie: string;
  prixDefaut: number;
  tvaRate: number;
  unite?: string | null;
}

export function buildFacturationPrompt(
  transcript: string,
  actes: ActeRefPrompt[],
  exclusionNote: string,
): string {
  const actesJson = actes.map(a => ({
    id: a.id,
    nom: a.nom,
    categorie: a.categorie,
    prixDefaut: a.prixDefaut,
    tvaRate: a.tvaRate,
    unite: a.unite,
  }));

  return `Tu es un assistant de facturation veterinaire. Le texte suivant est la transcription d'un veterinaire qui dicte les actes realises lors d'une consultation.

TRANSCRIPTION DU VETERINAIRE :
"${transcript}"

LISTE DES ACTES DISPONIBLES EN BASE DE DONNEES :
${JSON.stringify(actesJson, null, 2)}
${exclusionNote}
Analyse la transcription et genere les lignes de facturation.
Pour chaque acte ou produit mentionne :
1. Essaie de l'associer a un acte de la base de donnees (utilise son id)
2. Si aucun acte ne correspond exactement, cree une ligne libre (acteId a null)
3. Respecte les quantites mentionnees
4. TVA a 20% sur tous les actes
5. N'inclus JAMAIS les medicaments listes dans les medicaments deja integres dans l'ordonnance

Reponds UNIQUEMENT avec un JSON valide (sans markdown) de cette forme exacte :
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
  "resume": "Courte description de la facturation dictee"
}`;
}
