import { Mic, MicOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export interface VoiceRecorderProps {
  onAction: (transcript: string) => Promise<void>;
  actionLabel: string;
  isProcessing?: boolean;
  actionButtonClassName?: string;
  placeholder?: string;
}

export function VoiceRecorder({
  onAction,
  actionLabel,
  isProcessing = false,
  actionButtonClassName = "bg-violet-600 hover:bg-violet-700 text-white",
  placeholder = "Parlez maintenant...",
}: VoiceRecorderProps) {
  const { toast } = useToast();
  const [isRunningAction, setIsRunningAction] = useState(false);
  const {
    isListening,
    isSupported,
    fullText,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition("fr-FR");

  if (!isSupported) return null;

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  const handleAction = async () => {
    if (!transcript.trim()) {
      toast({ title: "Aucun texte enregistré", variant: "destructive" });
      return;
    }
    setIsRunningAction(true);
    try {
      await onAction(transcript);
      resetTranscript();
    } catch {
      toast({ title: "Erreur lors du traitement", description: "Veuillez réessayer.", variant: "destructive" });
    } finally {
      setIsRunningAction(false);
    }
  };

  const busy = isRunningAction || isProcessing;

  return (
    <div className="space-y-3 border rounded-xl p-4 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isListening ? "bg-red-500 animate-pulse" : "bg-muted-foreground/40"}`} />
          <span className="text-sm font-medium text-muted-foreground">
            {isListening ? "Enregistrement en cours..." : "Dictée vocale"}
          </span>
        </div>
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          size="sm"
          onClick={handleToggleMic}
          disabled={busy}
        >
          {isListening ? (
            <><MicOff className="mr-2 h-4 w-4" />Arrêter</>
          ) : (
            <><Mic className="mr-2 h-4 w-4" />Enregistrer</>
          )}
        </Button>
      </div>

      {(fullText || isListening) && (
        <div className={`min-h-[80px] rounded-lg border p-3 text-sm bg-background ${isListening ? "border-red-300 ring-1 ring-red-200" : "border-border"}`}>
          {fullText ? (
            <span>{fullText}</span>
          ) : (
            <span className="text-muted-foreground italic">{placeholder}</span>
          )}
        </div>
      )}

      {transcript && !isListening && (
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleAction}
          disabled={busy}
          className={`w-full ${actionButtonClassName}`}
        >
          {busy ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Traitement en cours...</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4" />{actionLabel}</>
          )}
        </Button>
      )}
    </div>
  );
}
