export function buildAnamnesePrompt(transcript: string): string {
  return `Tu es un veterinaire qui prend des notes cliniques. Le texte suivant est une transcription brute d'une dictee vocale d'un veterinaire ou d'une conversation avec un proprietaire d'animal.

TRANSCRIPTION BRUTE :
${transcript}

Reformule ce texte en une anamnese medicale veterinaire structuree, professionnelle et complete en francais.
L'anamnese doit :
- Etre redigee de maniere claire et medicalement precise
- Organiser l'information de facon logique (motif principal, historique des symptomes, duree, evolution, contexte, traitements en cours, alimentation/hydratation, comportement)
- Eliminer les repetitions et les hesitations de la dictee
- Conserver tous les faits cliniques importants mentionnes
- Utiliser le vocabulaire medical veterinaire approprie

Reponds UNIQUEMENT avec l'anamnese reformulee, sans introduction ni commentaire.`;
}
