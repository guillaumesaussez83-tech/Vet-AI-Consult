import { AssemblyAI } from "assemblyai";

// Dictee vocale (STT) via AssemblyAI -- API pre-enregistree (async : upload + polling
// geres par le SDK). La cle ASSEMBLYAI_API_KEY reste 100% serveur (jamais cote front).
//
// Medical Mode NATIF d'AssemblyAI (domain "medical-v1") : add-on qui booste la
// reconnaissance des termes cliniques (molecules, posologies, conditions). Supporte le
// francais. Valide cote produit sur du vocabulaire veterinaire reel (cardio + molecules
// type furosemide / clopidogrel / pimobendane / atenolol). Pas de keyterms au premier
// jet (affinage ulterieur).
const ASSEMBLYAI_LANGUAGE = "fr";
const ASSEMBLYAI_DOMAIN = "medical-v1";

let _client: AssemblyAI | null = null;

function getClient(): AssemblyAI {
  const apiKey = process.env["ASSEMBLYAI_API_KEY"];
  if (!apiKey) {
    // Erreur typee pour que la route reponde 503 (service non configure) plutot que 500.
    throw Object.assign(new Error("ASSEMBLYAI_API_KEY manquante"), { code: "STT_NOT_CONFIGURED" });
  }
  if (!_client) _client = new AssemblyAI({ apiKey });
  return _client;
}

/**
 * Transcrit un buffer audio (blob MediaRecorder) via AssemblyAI.
 * FR + Medical Mode. Renvoie le texte transcrit (trim), chaine vide si aucun texte.
 */
export async function transcribeAudio(audio: Buffer): Promise<string> {
  const transcript = await getClient().transcripts.transcribe({
    audio,
    language_code: ASSEMBLYAI_LANGUAGE,
    domain: ASSEMBLYAI_DOMAIN,
  });
  if (transcript.status === "error") {
    throw new Error(transcript.error ?? "AssemblyAI transcription error");
  }
  return (transcript.text ?? "").trim();
}
