import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Loader2, CheckCircle, AlertTriangle, Package } from "lucide-react";

const API_BASE = "/api";

function displayField(v: unknown, fallback = "à définir"): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  if (!s || s === "—" || s === "-" || s === "–" || /^(null|undefined)$/i.test(s)) return fallback;
  return s;
}

interface Prescription {
  nom_medicament: string;
  dose: string;
  voie_administration: string;
  frequence: string;
  duree: string;
  quantite_a_delivrer: number;
  unite: string;
  stockMatch: { id: number; nom: string; prixVenteTTC: number; quantiteStock: number; unite: string } | null;
}

export interface PrescriptionConfirmee {
  nom_medicament: string;
  dose: string;
  voie_administration: string;
  frequence: string;
  duree: string;
  quantite_a_delivrer: number;
  unite: string;
  stockMatch: { id: number; nom: string; prixVenteTTC: number; quantiteStock: number; unite: string } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirmed: (prescriptions: PrescriptionConfirmee[], ordonnanceTexte: string) => void;
}

export default function DicteeOrdonnanceDialog({ open, onClose, onConfirmed }: Props) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<"dictee" | "analyse" | "recap">("dictee");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Dictée vocale non supportée par ce navigateur", description: "Utilisez Chrome ou Edge, ou saisissez le texte manuellement.", variant: "destructive" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript + " ";
      }
      if (finalText) setTranscript(prev => prev + finalText);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const analyser = async () => {
    if (!transcript.trim()) {
      toast({ title: "Aucun texte à analyser", variant: "destructive" });
      return;
    }
    setLoading(true);
    setPhase("analyse");
    try {
      const res = await fetch(`${API_BASE}/ai/dictee-ordonnance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcription: transcript }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPrescriptions(data.prescriptions ?? []);
      setPhase("recap");
    } catch (e) {
      toast({ title: "Erreur d'analyse IA", description: String(e), variant: "destructive" });
      setPhase("dictee");
    } finally {
      setLoading(false);
    }
  };

  const confirmer = () => {
    const lignes = prescriptions.map(p => {
      const nom = `${p.nom_medicament}${displayField(p.dose) !== "à définir" ? " " + p.dose : ""}`;
      const voie = displayField(p.voie_administration);
      const freq = displayField(p.frequence);
      const duree = displayField(p.duree);
      const parts = [
        nom,
        `${voie}, ${freq} pendant ${duree}`,
        (p.quantite_a_delivrer != null && p.quantite_a_delivrer > 0)
          ? `Qté : ${p.quantite_a_delivrer} ${displayField(p.unite, "unité")}`
          : null,
      ].filter(Boolean);
      return parts.join(" — ");
    }).join("\n");
    onConfirmed(prescriptions, lignes);
    handleClose();
  };

  const handleClose = () => {
    setPhase("dictee");
    setTranscript("");
    setPrescriptions([]);
    setListening(false);
    recognitionRef.current?.stop();
    onClose();
  };

  const totalFacture = prescriptions.reduce((sum, p) => sum + (p.stockMatch?.prixVenteTTC ?? 0) * Math.max(1, p.quantite_a_delivrer), 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Dictée d'ordonnance assistée par IA
          </DialogTitle>
        </DialogHeader>

        {phase === "dictee" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dictez votre prescription oralement ou saisissez-la ci-dessous. L'IA extraira les médicaments et les retrouvera dans le stock.
            </p>
            <div className="flex gap-2">
              {!listening ? (
                <Button variant="outline" onClick={startListening} className="gap-2">
                  <Mic className="h-4 w-4 text-primary" />
                  Démarrer la dictée
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopListening} className="gap-2 animate-pulse">
                  <MicOff className="h-4 w-4" />
                  Arrêter la dictée
                </Button>
              )}
            </div>
            <Textarea
              rows={6}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Je prescris Amoxicilline 200mg suspension injectable, 1ml par kilo en sous-cutané, une injection aujourd'hui. Et Méloxicam 0,5mg/kg per os pendant 5 jours, 2 comprimés par jour..."
              className="font-mono text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button onClick={analyser} disabled={!transcript.trim() || loading}>
                Analyser avec l'IA
              </Button>
            </div>
          </div>
        )}

        {phase === "analyse" && (
          <div className="flex flex-col items-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Analyse en cours — extraction des prescriptions...</p>
          </div>
        )}

        {phase === "recap" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>{prescriptions.length} médicament{prescriptions.length > 1 ? "s" : ""} extrait{prescriptions.length > 1 ? "s" : ""} depuis la dictée</span>
            </div>

            {prescriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Aucune prescription détectée dans la dictée.</p>
                <Button variant="outline" className="mt-4" onClick={() => setPhase("dictee")}>
                  Recommencer
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {prescriptions.map((p, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm">{p.nom_medicament}</div>
                        {p.stockMatch ? (
                          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-xs whitespace-nowrap">
                            <Package className="h-3 w-3 mr-1" />
                            En stock
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">Non trouvé en stock</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>Dose : {displayField(p.dose)} — {displayField(p.voie_administration)}</div>
                        <div>
                          Fréquence : {displayField(p.frequence)} — Durée :{" "}
                          <span className={displayField(p.duree) === "à définir" ? "text-amber-600 font-medium" : ""}>
                            {displayField(p.duree)}
                          </span>
                        </div>
                        <div>
                          Quantité à délivrer :{" "}
                          <strong>
                            {p.quantite_a_delivrer != null && p.quantite_a_delivrer > 0
                              ? `${p.quantite_a_delivrer} ${displayField(p.unite, "unité")}`
                              : "à définir"}
                          </strong>
                        </div>
                      </div>
                      {p.stockMatch && (
                        <div className="text-xs border-t pt-2 flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Stock: <strong>{p.stockMatch.nom}</strong> — {p.stockMatch.quantiteStock} disponibles
                          </span>
                          <span className="font-semibold text-primary">
                            {(p.stockMatch.prixVenteTTC * Math.max(1, p.quantite_a_delivrer)).toFixed(2)} €
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {totalFacture > 0 && (
                  <div className="border-t pt-3 flex justify-between text-sm font-semibold">
                    <span>Total ajouté à la facture :</span>
                    <span className="text-primary">{totalFacture.toFixed(2)} € TTC</span>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setPhase("dictee")}>Modifier</Button>
                  <Button onClick={confirmer}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmer l'ordonnance
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
