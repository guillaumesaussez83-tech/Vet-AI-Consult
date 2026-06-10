import { useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { apiFetch } from "@/lib/api-fetch";

/**
 * Dictée vocale pré-enregistrée via AssemblyAI (Medical Mode FR).
 * Toggle mains libres : « Dicter » -> écoute continue -> « Arrêter » -> le blob audio
 * est envoyé à /api/ai/transcribe (clé AssemblyAI 100% serveur), et le texte transcrit
 * est remis via `onTranscript` (le parent décide quoi en faire : ici, append à l'anamnèse).
 *
 * Composant DÉDIÉ (n'utilise pas le VoiceRecorder partagé) -> blast radius isolé au step 2.
 */
function formatDuree(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function DicteeVocaleAssemblyAI({
  onTranscript,
}: {
  onTranscript: (text: string) => void;
}) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBlob = async (blob: Blob) => {
    setError(null);
    setIsTranscribing(true);
    try {
      const res = await apiFetch("/api/ai/transcribe", {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      if (!res.ok) {
        setError(
          res.status === 503
            ? "Service de transcription non configuré."
            : res.status === 504
            ? "La transcription a dépassé le délai imparti. Essayez une dictée plus courte."
            : "Échec de la transcription. Veuillez réessayer.",
        );
        return;
      }
      const json = await res.json();
      const transcript = String((json?.data ?? json)?.transcript ?? "").trim();
      if (transcript) onTranscript(transcript);
      else setError("Aucune parole détectée. Réessayez.");
    } catch {
      setError("Problème réseau pendant la transcription. Veuillez réessayer.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const { isRecording, isSupported, seconds, start, stop } = useAudioRecorder({
    onComplete: handleBlob,
    onError: setError,
  });

  if (!isSupported) return null;

  return (
    <div className="space-y-2 border rounded-xl p-4 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-muted-foreground/40"}`}
          />
          <span className="text-sm font-medium text-muted-foreground">
            {isRecording
              ? `Écoute en cours… ${formatDuree(seconds)}`
              : isTranscribing
              ? "Transcription en cours…"
              : "Dictée vocale (AssemblyAI · médical FR)"}
          </span>
        </div>
        <Button
          type="button"
          variant={isRecording ? "destructive" : "outline"}
          size="sm"
          onClick={isRecording ? stop : start}
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Transcription…
            </>
          ) : isRecording ? (
            <>
              <Square className="mr-2 h-4 w-4" />
              Arrêter
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" />
              Dicter
            </>
          )}
        </Button>
      </div>

      {isRecording && (
        <p className="text-xs text-muted-foreground">
          Parlez librement, mains libres. Cliquez « Arrêter » quand vous avez terminé (arrêt
          automatique à 3 min).
        </p>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export default DicteeVocaleAssemblyAI;
