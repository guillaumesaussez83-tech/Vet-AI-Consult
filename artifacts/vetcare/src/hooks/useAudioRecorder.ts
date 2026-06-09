import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Capture audio micro via MediaRecorder, en mode TOGGLE (un start, un stop).
 * Mains libres entre les deux. Conçu pour la dictée pré-enregistrée AssemblyAI :
 * on enregistre localement entre les 2 clics, puis le blob est remis via `onComplete`
 * (l'envoi à l'endpoint /api/ai/transcribe se fait côté consommateur, étape suivante).
 *
 * Garde-fous (cf. risques identifiés) :
 *  - libération du micro (stop des tracks) au stop ET au démontage -> l'indicateur
 *    micro s'éteint même si le véto oublie de cliquer "stop" ou navigue ailleurs.
 *  - auto-stop à durée max (~3 min) -> évite un micro ouvert indéfiniment + un blob
 *    qui gonfle, et borne le coût AssemblyAI / la latence de transcription.
 */
interface UseAudioRecorderOptions {
  maxDurationMs?: number;
  onComplete?: (blob: Blob) => void;
  onError?: (message: string) => void;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isSupported: boolean;
  error: string | null;
  seconds: number;
  start: () => Promise<void>;
  stop: () => void;
}

const DEFAULT_MAX_MS = 3 * 60 * 1000; // ~3 min

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const { maxDurationMs = DEFAULT_MAX_MS } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Callbacks gardés en ref pour éviter les stale closures sans recréer start/stop.
  const onCompleteRef = useRef(options.onComplete);
  const onErrorRef = useRef(options.onError);
  useEffect(() => {
    onCompleteRef.current = options.onComplete;
    onErrorRef.current = options.onError;
  });

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined";

  // Libère micro + timers. Idempotent.
  const cleanup = useCallback(() => {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop()); // coupe le micro
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop(); // déclenche onstop -> assemble le blob + onComplete + cleanup
    } else {
      cleanup();
      setIsRecording(false);
    }
  }, [cleanup]);

  const start = useCallback(async () => {
    if (!isSupported) {
      const msg = "L'enregistrement audio n'est pas supporté par ce navigateur.";
      setError(msg);
      onErrorRef.current?.(msg);
      return;
    }
    if (recorderRef.current) return; // déjà en cours
    setError(null);
    setSeconds(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;

      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        cleanup();
        setIsRecording(false);
        if (blob.size > 0) onCompleteRef.current?.(blob);
      };
      rec.onerror = () => {
        const msg = "Erreur pendant l'enregistrement audio.";
        setError(msg);
        onErrorRef.current?.(msg);
        cleanup();
        setIsRecording(false);
      };

      rec.start();
      setIsRecording(true);
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      autoStopRef.current = setTimeout(() => stop(), maxDurationMs); // auto-stop ~3 min
    } catch (err) {
      const denied = (err as DOMException)?.name === "NotAllowedError";
      const msg = denied
        ? "Accès au micro refusé. Autorisez le micro dans votre navigateur."
        : "Impossible d'accéder au micro.";
      setError(msg);
      onErrorRef.current?.(msg);
      cleanup();
      setIsRecording(false);
    }
  }, [isSupported, maxDurationMs, cleanup, stop]);

  // Démontage (navigation, fermeture) -> micro relâché même sans clic "stop".
  useEffect(() => cleanup, [cleanup]);

  return { isRecording, isSupported, error, seconds, start, stop };
}
