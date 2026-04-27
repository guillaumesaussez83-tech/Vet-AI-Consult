import { useState, useRef, useCallback, useEffect } from "react";

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  liveText: string;
  fullText: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(lang = "fr-FR"): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [liveText, setLiveText] = useState("");
  const recognitionRef = useRef<any>(null);
    useEffect(() => {
          return () => {
                  if (recognitionRef.current) {
                            recognitionRef.current.stop();
                            recognitionRef.current = null;
                  }
          };
    }, []);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += t;
        } else {
          interimChunk += t;
        }
      }
      if (finalChunk) {
        setTranscript(prev => prev + (prev ? " " : "") + finalChunk.trim());
        setLiveText("");
      } else {
        setLiveText(interimChunk);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setLiveText("");
    };
    recognition.onerror = () => {
      setIsListening(false);
      setLiveText("");
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [isSupported, lang]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setLiveText("");
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setLiveText("");
  }, []);

  const fullText = transcript + (liveText ? (transcript ? " " : "") + liveText : "");

  return {
    isListening,
    isSupported,
    transcript,
    liveText,
    fullText,
    startListening,
    stopListening,
    resetTranscript,
  };
}
