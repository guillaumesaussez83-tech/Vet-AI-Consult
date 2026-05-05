import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Loader2, ChevronRight, Check, ArrowLeft, Stethoscope, ClipboardList, FlaskConical, FileCheck } from "lucide-react";

const API_BASE = "/api/consultations";
const PHASES = ["ANAMNESE", "EXAMEN", "SYNTHESE", "TERMINEE"];

export default function ConsultationWorkflow() {
  const [, params] = useRoute("/consultations/:id/workflow");
  const consultationId = params?.id;
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [workflowState, setWorkflowState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [examensValides, setExamensValides] = useState([]);
  const [ordonnanceInfo, setOrdonnanceInfo] = useState(null);
  const recognitionRef = useRef(null);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  }, [getToken]);

  const fetchWorkflowState = useCallback(async () => {
    if (!consultationId) return;
    try {
      const headers = await authHeaders();
      const r = await fetch(API_BASE + "/" + consultationId + "/workflow-state", { headers });
      if (r.ok) {
        const data = await r.json();
        setWorkflowState(data);
        if (data.phase === "SYNTHESE" && data.examenIA?.examens_proposes) {
          setExamensValides(data.examenIA.examens_proposes.map(e => e.examen));
        }
      }
    } catch (e) {
      console.error("workflow fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [consultationId, authHeaders]);

  useEffect(() => {
    fetchWorkflowState();
  }, [fetchWorkflowState]);

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Micro non supporte", description: "Utilisez Chrome ou Edge", variant: "destructive" });
      return;
    }
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setTranscript(prev => prev ? prev + " " + text : text);
    };
    rec.onerror = rec.onend = () => setIsRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const callAPI = async (endpoint, method, body) => {
    const headers = await authHeaders();
    const r = await fetch(API_BASE + "/" + consultationId + "/" + endpoint, {
      method, headers, body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error("API error " + r.status);
    return r.json();
  };

  const submitPhase = async (endpoint, body, successMsg) => {
    setSubmitting(true);
    try {
      const result = await callAPI(endpoint, "POST", body);
      if (endpoint === "valider-examens" && result.ordonnanceId) {
        setOrdonnanceInfo({ id: result.ordonnanceId, numero: result.ordonnanceNumero });
      }
      toast({ title: successMsg });
      setTranscript("");
      await fetchWorkflowState();
    } catch (e) {
      toast({ title: "Erreur", description: "Requete echouee", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" />
    </div>
  );

  const phase = workflowState?.phase || "ANAMNESE";
  const phaseIdx = PHASES.indexOf(phase);
  const phaseLabels = { ANAMNESE: "Anamnese", EXAMEN: "Examen clinique", SYNTHESE: "Examens compl.", TERMINEE: "Terminee" };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={"/consultations/" + consultationId}><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button></Link>
        <h1 className="text-2xl font-bold">Consultation guidee par IA</h1>
      </div>

      {/* Barre de progression */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {["ANAMNESE", "EXAMEN", "SYNTHESE"].map((p, i) => {
          const done = i < phaseIdx;
          const active = p === phase;
          return (
            <div key={p} className="flex items-center gap-2">
              <div className={"flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap " + (done ? "bg-green-100 text-green-700" : active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400")}>
                {done ? <Check className="h-3 w-3" /> : null}
                {phaseLabels[p]}
              </div>
              {i < 2 && <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* PHASE 1 - ANAMNESE */}
      {phase === "ANAMNESE" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-blue-500" />Phase 1 — Anamnese du proprietaire</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">Dictez ce que rapporte le proprietaire : symptomes, duree, alimentation, antecedents...</p>
            <div className="flex gap-3 items-center">
              <Button onClick={isRecording ? stopRecording : startRecording} variant={isRecording ? "destructive" : "default"}>
                {isRecording ? <><MicOff className="h-4 w-4 mr-2" />Arreter</> : <><Mic className="h-4 w-4 mr-2" />Dicter</>}
              </Button>
              {isRecording && <Badge variant="outline" className="text-red-500 border-red-300 animate-pulse">En ecoute...</Badge>}
            </div>
            <Textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Transcription automatique ou saisie manuelle..." rows={5} />
            <Button onClick={() => submitPhase("anamnese", { transcription: transcript }, "Anamnese analysee par l'IA")} disabled={!transcript.trim() || submitting} className="w-full">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyse IA...</> : "Analyser avec l'IA ->"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recap anamnese */}
      {phaseIdx > 0 && workflowState?.anamneseIA && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader><CardTitle className="text-green-800 text-base flex items-center gap-2"><Check className="h-4 w-4" />Anamnese analysee</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{workflowState.anamneseIA.resume}</p>
            <div className="flex flex-wrap gap-2">
              {(workflowState.anamneseIA.hypotheses_initiales || []).slice(0, 3).map((h, i) => (
                <Badge key={i} variant={h.probabilite === "haute" ? "default" : "outline"}>{h.diagnostic} ({h.probabilite})</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PHASE 2 - EXAMEN */}
      {phase === "EXAMEN" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-purple-500" />Phase 2 — Examen clinique</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">Dictez vos constatations : temperature, muqueuses, auscultation, palpation, reflexes...</p>
            {workflowState?.anamneseIA?.points_cles_examen?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm">
                <p className="font-semibold text-blue-700 mb-1">Points a verifier selon l'anamnese :</p>
                <ul className="list-disc list-inside text-blue-600 space-y-0.5">
                  {workflowState.anamneseIA.points_cles_examen.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            <div className="flex gap-3 items-center">
              <Button onClick={isRecording ? stopRecording : startRecording} variant={isRecording ? "destructive" : "default"}>
                {isRecording ? <><MicOff className="h-4 w-4 mr-2" />Arreter</> : <><Mic className="h-4 w-4 mr-2" />Dicter</>}
              </Button>
              {isRecording && <Badge variant="outline" className="text-red-500 border-red-300 animate-pulse">En ecoute...</Badge>}
            </div>
            <Textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Ex: Temperature 39.8, muqueuses rosees, FC 100/min, souffle grade 2/6..." rows={5} />
            <Button onClick={() => submitPhase("examen", { transcription: transcript }, "Examen analyse et croise avec l'anamnese")} disabled={!transcript.trim() || submitting} className="w-full">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Croisement IA...</> : "Croiser anamnese + examen ->"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recap examen */}
      {phaseIdx > 1 && workflowState?.examenIA && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader><CardTitle className="text-purple-800 text-base flex items-center gap-2"><Check className="h-4 w-4" />Examen analyse</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{workflowState.examenIA.resume_examen}</p>
            <p className="text-sm font-medium">Diagnostic probable : <strong>{workflowState.examenIA.diagnostic_probable}</strong></p>
          </CardContent>
        </Card>
      )}

      {/* PHASE 3 - SYNTHESE */}
      {phase === "SYNTHESE" && workflowState?.examenIA && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-orange-500" />Phase 3 — Examens complementaires</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">Selectionnez les examens a realiser (cochees = a facturer) :</p>
            <div className="space-y-2">
              {(workflowState.examenIA.examens_proposes || []).map((ex, i) => (
                <label key={i} className="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={examensValides.includes(ex.examen)}
                    onChange={e => setExamensValides(prev => e.target.checked ? [...prev, ex.examen] : prev.filter(x => x !== ex.examen))} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ex.examen}</span>
                      <Badge variant={ex.priorite === "urgent" ? "destructive" : ex.priorite === "recommande" ? "default" : "outline"} className="text-xs">{ex.priorite}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{ex.justification}</p>
                  </div>
                </label>
              ))}
            </div>
            <Button onClick={() => submitPhase("valider-examens", { examensValides }, "Synthese finale generee")} disabled={submitting} className="w-full">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generation synthese...</> : "Generer la synthese finale ->"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* PHASE TERMINEE */}
      {phase === "TERMINEE" && workflowState?.syntheseIA && (
        <Card className="border-green-300">
          <CardHeader><CardTitle className="flex items-center gap-2 text-green-700"><FileCheck className="h-5 w-5" />Consultation terminee</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Diagnostic final</p>
              <p className="text-xl font-bold">{workflowState.syntheseIA.diagnostic_final}</p>
            </div>
            {workflowState.syntheseIA.compte_rendu && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Compte rendu medical</p>
                <Textarea value={workflowState.syntheseIA.compte_rendu} rows={12} className="font-mono text-sm bg-gray-50" readOnly />
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              <Link href={"/consultations/" + consultationId}>
                <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Voir la consultation</Button>
              </Link>
              {ordonnanceInfo && (
                <Link href={"/ordonnances/" + ordonnanceInfo.id}>
                  <Button variant="outline" className="border-green-500 text-green-700 hover:bg-green-50">
                    <FileCheck className="h-4 w-4 mr-2" />Voir l'ordonnance ({ordonnanceInfo.numero})
                  </Button>
                </Link>
              )}
              <Link href={"/consultations/" + consultationId + "/facture"}>
                <Button>Creer la facture</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
