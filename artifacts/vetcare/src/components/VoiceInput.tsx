import { useState, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceInput({ onTranscript, className }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(
    typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
  const recRef = useRef<any>(null);

  if (!supported) return null;

  const toggle = () => {
    if (!recRef.current) {
      const SR =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      recRef.current = new SR() as any;
      recRef.current.lang = "fr-FR";
      recRef.current.continuous = true;
      recRef.current.interimResults = false;
      recRef.current.onresult = (e: any) => {
        const transcript = Array.from(e.results)
          .map((r: any) => r[0].transcript)
          .join(" ");
        onTranscript(transcript);
      };
      recRef.current.onerror = () => {
        setListening(false);
      };
      recRef.current.onend = () => {
        setListening(false);
      };
    }

    if (listening) {
      recRef.current.stop();
      setListening(false);
    } else {
      recRef.current.start();
      setListening(true);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggle}
            className={`h-8 w-8 ${listening ? "text-red-500 animate-pulse" : "text-muted-foreground hover:text-foreground"} ${className ?? ""}`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {listening ? "Arrêter la dictée" : "Dicter (fr-FR)"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
