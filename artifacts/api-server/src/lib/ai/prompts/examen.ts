export function buildExamenPrompt(transcript: string): string {
  return `Tu es un veterinaire qui dicte ses notes d'examen clinique. Le texte suivant est une transcription brute de ses observations pendant l'examen physique d'un animal.

TRANSCRIPTION BRUTE :
${transcript}

Reformule et structure ce texte en un examen clinique veterinaire complet et professionnel selon la structure classique :
- Etat general (attitude, etat d'alerte, condition corporelle)
- Muqueuses (couleur, temps de recoloration capillaire)
- Parametres vitaux (frequence cardiaque, frequence respiratoire, temperature si mentionnee)
- Auscultation cardiaque et pulmonaire
- Palpation abdominale
- Systeme locomoteur et posture
- Peau, pelage et phaneres
- Ganglions lymphatiques
- Autres observations pertinentes

Garde uniquement ce qui est mentionne dans la transcription. N'invente aucune donnee.
Reponds UNIQUEMENT avec l'examen clinique structure, sans introduction ni commentaire.`;
}
