import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Loader2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  FileText,
  Pill,
  ClipboardList,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnamneseIA {
  resume?: string;
  signes_rapportes?: string[];
  duree_evolution?: string;
  contexte?: string;
  hypotheses_initiales?: { diagnostic: string; probabilite: string; justification: string }[];
  points_cles_examen?: string[];
  urgence?: "normale" | "moderee" | "elevee";
}

interface ExamenIA {
  resume_examen?: string;
  parametres?: { temperature?: string; fc?: string; fr?: string; muqueuses?: string; autres?: string };
  concordance_anamnesee?: string;
  hypotheses_affinees?: { diagnostic: string; probabilite: string; pour: string[]; contre: string[] }[];
  examens_proposes?: { examen: string; priorite: string; justification: string }[];
  diagnostic_probable?: string;
  traitement_initial?: string;
}

interface OrdonnanceLigne {
  molecule: string;
  specialite: string;
  dose_mg: number;
  forme: string;
  posologie: string;
  frequence_jour: number;
  duree_jours: number;
  voie: string;
  prix_estime: number;
}

interface SyntheseIA {
  diagnostic_final?: string;
  diagnostics_differentiels?: string[];
  ordonnance_suggeree?: OrdonnanceLigne[];
  examens_a_facturer?: { acte: string; quantite: number; prix_estime: number }[];
  suivi?: string;
  pronostic?: "favorable" | "reserve" | "defavorable";
  alerte_antibiotique?: boolean;
}

interface WorkflowState {
  phase: "ANAMNESE" | "EXAMEN" | "SYNTHESE" | "TERMINEE";
  anamneseIA: AnamneseIA | null;
  examenIA: ExamenIA | null;
  syntheseIA: SyntheseIA | null;
  examensComplementairesValides: { examen: string; priorite: string }[] | null;
  ordonnance: { id: number; numero: string; contenu: string } | null;
  devisActes: { id: number; description: string; prixUnitaire: number; quantite: number; tvaRate: number }[] | null;
  validation: { wasValidated: boolean; validatedBy: string | null } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const URGENCE_CONFIG = {
  elevee: { label: "⚠️ URGENCE ÉLEVÉE", cls: "bg-red-100 border-red-400 text-red-800" },
  moderee: { label: "🟠 URGENCE MODÉRÉE", cls: "bg-orange-100 border-orange-300 text-orange-800" },
  normale: { label: "✅ Urgence normale", cls: "bg-green-100 border-green-300 text-green-800" },
};

const PRONOSTIC_CONFIG = {
  defavorable: { label: "⚫ Pronostic défavorable", cls: "bg-gray-900 text-white border-gray-700" },
  reserve: { label: "🔴 Pronostic réservé", cls: "bg-red-100 text-red-900 border-red-400" },
  favorable: { label: "🟢 Pronostic favorable", cls: "bg-green-100 text-green-800 border-green-300" },
};

function UrgenceBanner({ urgence }: { urgence?: string }) {
  if (!urgence || urgence === "normale") return null;
  const cfg = URGENCE_CONFIG[urgence as keyof typeof URGENCE_CONFIG] ?? URGENCE_CONFIG.normale;
  return (
    <div className={`border-l-4 px-4 py-2 rounded mb-3 font-semibold text-sm ${cfg.cls}`}>
      {cfg.label}
    </div>
  );
}

function PronosticBanner({ pronostic }: { pronostic?: string }) {
  if (!pronostic) return null;
  const cfg = PRONOSTIC_CONFIG[pronostic as keyof typeof PRONOSTIC_CONFIG];
  if (!cfg) return null;
  return (
    <div className={`border px-4 py-2 rounded mb-3 font-semibold text-sm ${cfg.cls}`}>
      {cfg.label}
    </div>
  );
}

function AntibioAlert({ alerte }: { alerte?: boolean }) {
  if (!alerte) return null;
  return (
    <div className="border-l-4 border-yellow-500 bg-yellow-50 px-4 py-2 rounded mb-3 text-sm text-yellow-800 flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        <strong>Alerte antibiotique :</strong> Traitement antibiotique proposé — vérifier l'antibiogramme et respecter les bonnes pratiques AMR.
      </span>
    </div>
  );
}

function JsonPreviewCard({ title, icon, data }: { title: string; icon: React.ReactNode; data: object | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!data) return null;
  return (
    <Card className="mb-3">
      <CardHeader className="py-3 px-4 cursor-pointer flex flex-row items-center justify-between" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? "Réduire ▲" : "Développer ▼"}</span>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

function OrdonnanceEditor({
  lignes,
  onChange,
}: {
  lignes: OrdonnanceLigne[];
  onChange: (l: OrdonnanceLigne[]) => void;
}) {
  const update = (idx: number, field: keyof OrdonnanceLigne, value: string | number) => {
    const next = lignes.map((l, i) => (i === idx ? { ...l, [field]: value } : l));
    onChange(next);
  };
  const remove = (idx: number) => onChange(lignes.filter((_, i) => i !== idx));
  const add = () =>
    onChange([
      ...lignes,
      { molecule: "", specialite: "", dose_mg: 0, forme: "cp", posologie: "", frequence_jour: 1, duree_jours: 7, voie: "oral", prix_estime: 0 },
    ]);

  return (
    <div className="space-y-3">
      {lignes.map((l, i) => (
        <div key={i} className="border rounded p-3 bg-white space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Molécule"
              value={l.molecule}
              onChange={e => update(i, "molecule", e.target.value)}
              className="text-sm"
            />
            <Input
              placeholder="Spécialité commerciale"
              value={l.specialite}
              onChange={e => update(i, "specialite", e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Dose mg"
              type="number"
              value={l.dose_mg || ""}
              onChange={e => update(i, "dose_mg", Number(e.target.value))}
              className="text-sm w-24"
            />
            <Input
              placeholder="Forme (cp/inj…)"
              value={l.forme}
              onChange={e => update(i, "forme", e.target.value)}
              className="text-sm w-28"
            />
            <Input
              placeholder="x/jour"
              type="number"
              value={l.frequence_jour || ""}
              onChange={e => update(i, "frequence_jour", Number(e.target.value))}
              className="text-sm w-20"
            />
            <Input
              placeholder="Durée (jours)"
              type="number"
              value={l.duree_jours || ""}
              onChange={e => update(i, "duree_jours", Number(e.target.value))}
              className="text-sm w-24"
            />
            <Input
              placeholder="Voie"
              value={l.voie}
              onChange={e => update(i, "voie", e.target.value)}
              className="text-sm w-24"
            />
          </div>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Posologie complète"
              value={l.posologie}
              onChange={e => update(i, "posologie", e.target.value)}
              className="text-sm flex-1"
            />
            <Button size="sm" variant="ghost" onClick={() => remove(i)} className="text-red-500 px-2">
              ✕
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="w-full">
        + Ajouter un médicament
      </Button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function WorkflowPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { userId } = useAuth();

  const [state, setState] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Ordonnance editor state (editable copy)
  const [editedOrdonnance, setEditedOrdonnance] = useState<OrdonnanceLigne[]>([]);
  const [ordonnanceEdited, setOrdonnanceEdited] = useState(false);

  // Speech recognition for each phase
  const {
    transcript: anamneseTranscript,
    isListening: anamneseListening,
    startListening: startAnamnese,
    stopListening: stopAnamnese,
    setTranscript: setAnamneseTranscript,
  } = useSpeechRecognition();

  const {
    transcript: examenTranscript,
    isListening: examenListening,
    startListening: startExamen,
    stopListening: stopExamen,
    setTranscript: setExamenTranscript,
  } = useSpeechRecognition();

  const apiBase = `/api/consultations/${id}/workflow`;

  // ── Fetch state ──────────────────────────────────────────────────────────────

  const fetchState = useCallback(async () => {
    try {
      const resp = await fetch(`${apiBase}-state`, { credentials: "include" });
      if (!resp.ok) throw new Error("Erreur chargement");
      const data: WorkflowState = await resp.json();
      setState(data);

      // Init ordonnance editor from syntheseIA
      if (data.syntheseIA?.ordonnance_suggeree && !ordonnanceEdited) {
        setEditedOrdonnance(data.syntheseIA.ordonnance_suggeree);
      }
    } catch {
      toast.error("Impossible de charger l'état de la consultation");
    } finally {
      setLoading(false);
    }
  }, [id, ordonnanceEdited]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // ── Phase handlers ────────────────────────────────────────────────────────────

  const handleAnamnese = async () => {
    if (!anamneseTranscript.trim()) { toast.error("Dictez d'abord l'anamnèse"); return; }
    setProcessing(true);
    try {
      const resp = await fetch(`/api/consultations/${id}/workflow/anamnese`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ transcription: anamneseTranscript }),
      });
      if (!resp.ok) throw new Error("Erreur anamnèse");
      await fetchState();
      toast.success("Anamnèse analysée par l'IA ✓");
    } catch {
      toast.error("Erreur lors de l'analyse de l'anamnèse");
    } finally {
      setProcessing(false);
    }
  };

  const handleExamen = async (): Promise<void> => {
    if (!examenTranscript.trim()) return toast.error("Dictez d'abord l'examen clinique");
    setProcessing(true);
    try {
      const resp = await fetch(`/api/consultations/${id}/workflow/examen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ transcription: examenTranscript }),
      });
      if (!resp.ok) throw new Error("Erreur examen");
      await fetchState();
      toast.success("Examen clinique croisé ✓");
    } catch {
      toast.error("Erreur lors de l'analyse de l'examen");
    } finally {
      setProcessing(false);
    }
  };

  const handleValiderExamens = async (examensValides: { examen: string; priorite: string }[]) => {
    setProcessing(true);
    try {
      const resp = await fetch(`/api/consultations/${id}/workflow/valider-examens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ examensValides }),
      });
      if (!resp.ok) throw new Error("Erreur synthèse");
      const data = await resp.json();
      // Init editable ordonnance from new synthèse
      if (data.syntheseIA?.ordonnance_suggeree) {
        setEditedOrdonnance(data.syntheseIA.ordonnance_suggeree);
        setOrdonnanceEdited(false);
      }
      await fetchState();
      toast.success("Synthèse IA générée — en attente de validation vétérinaire ✓");
    } catch {
      toast.error("Erreur lors de la synthèse");
    } finally {
      setProcessing(false);
    }
  };

  const handleTerminer = async (): Promise<void> => {
    if (!userId) return toast.error("Identifiant vétérinaire introuvable (Clerk non connecté)");
    setProcessing(true);
    try {
      const validationChanges = ordonnanceEdited
        ? { ordonnance_modifiee: editedOrdonnance }
        : null;

      const resp = await fetch(`/api/consultations/${id}/workflow/terminer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          validated_by: userId,
          validation_changes: validationChanges,
        }),
      });
      if (!resp.ok) throw new Error("Erreur validation");
      await fetchState();
      toast.success("Consultation validée et terminée ✓");
      setTimeout(() => navigate(`/consultations/${id}`), 1500);
    } catch {
      toast.error("Erreur lors de la validation finale");
    } finally {
      setProcessing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!state) return <div className="p-6 text-red-500">Consultation introuvable</div>;

  const { phase, anamneseIA, examenIA, syntheseIA, examensComplementairesValides } = state;

  const urgence = anamneseIA?.urgence ?? examenIA?.hypotheses_affinees?.[0] as any;
  const pronostic = syntheseIA?.pronostic;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          Consultation #{id} — Workflow IA
        </h1>
        <Badge
          variant={phase === "TERMINEE" ? "default" : "secondary"}
          className={phase === "TERMINEE" ? "bg-green-600" : ""}
        >
          {phase}
        </Badge>
      </div>

      {/* ── Urgency & Pronostic banners (always visible once known) ── */}
      <UrgenceBanner urgence={anamneseIA?.urgence} />
      <PronosticBanner pronostic={pronostic} />
      <AntibioAlert alerte={syntheseIA?.alerte_antibiotique} />

      {/* ══════════════════════════════════════════════════════════════
          PHASE 1 — ANAMNÈSE
      ══════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              phase !== "ANAMNESE" ? "bg-green-500 text-white" : "bg-primary text-white"
            }`}>
              {phase !== "ANAMNESE" ? "✓" : "1"}
            </span>
            Anamnèse (dictée propriétaire)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {phase === "ANAMNESE" && (
            <>
              <Textarea
                placeholder="La transcription apparaîtra ici après la dictée..."
                value={anamneseTranscript}
                onChange={e => setAnamneseTranscript(e.target.value)}
                rows={4}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  variant={anamneseListening ? "destructive" : "outline"}
                  size="sm"
                  onClick={anamneseListening ? stopAnamnese : startAnamnese}
                >
                  {anamneseListening ? (
                    <><MicOff className="h-4 w-4 mr-1" /> Arrêter</>
                  ) : (
                    <><Mic className="h-4 w-4 mr-1" /> Dicter</>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={handleAnamnese}
                  disabled={processing || !anamneseTranscript.trim()}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                  Analyser par l'IA
                </Button>
              </div>
            </>
          )}

          {anamneseIA && (
            <>
              <div className="text-sm bg-blue-50 rounded p-3 border border-blue-200">
                <p className="font-medium text-blue-900 mb-1">Résumé IA</p>
                <p className="text-blue-800">{anamneseIA.resume || "—"}</p>
                {anamneseIA.urgence && anamneseIA.urgence !== "normale" && (
                  <UrgenceBanner urgence={anamneseIA.urgence} />
                )}
                {anamneseIA.points_cles_examen && anamneseIA.points_cles_examen.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Points clés à examiner :</p>
                    <ul className="list-disc list-inside text-xs text-blue-700">
                      {anamneseIA.points_cles_examen.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <JsonPreviewCard
                title="Données structurées — Anamnèse IA"
                icon={<FileText className="h-4 w-4" />}
                data={anamneseIA}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════
          PHASE 2 — EXAMEN CLINIQUE
      ══════════════════════════════════════════════════════════════ */}
      {(phase === "EXAMEN" || phase === "SYNTHESE" || phase === "TERMINEE") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                phase !== "EXAMEN" ? "bg-green-500 text-white" : "bg-primary text-white"
              }`}>
                {phase !== "EXAMEN" ? "✓" : "2"}
              </span>
              Examen clinique
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {phase === "EXAMEN" && (
              <>
                <Textarea
                  placeholder="Dictez l'examen clinique..."
                  value={examenTranscript}
                  onChange={e => setExamenTranscript(e.target.value)}
                  rows={4}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant={examenListening ? "destructive" : "outline"}
                    size="sm"
                    onClick={examenListening ? stopExamen : startExamen}
                  >
                    {examenListening ? (
                      <><MicOff className="h-4 w-4 mr-1" /> Arrêter</>
                    ) : (
                      <><Mic className="h-4 w-4 mr-1" /> Dicter</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleExamen}
                    disabled={processing || !examenTranscript.trim()}
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                    Croiser avec l'anamnèse
                  </Button>
                </div>
              </>
            )}

            {examenIA && (
              <>
                <div className="text-sm bg-purple-50 rounded p-3 border border-purple-200">
                  <p className="font-medium text-purple-900 mb-1">Diagnostic probable IA</p>
                  <p className="text-purple-800 font-semibold">{examenIA.diagnostic_probable || "—"}</p>
                  {examenIA.parametres && (
                    <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-purple-700">
                      {examenIA.parametres.temperature && <span>T° {examenIA.parametres.temperature}</span>}
                      {examenIA.parametres.fc && <span>FC {examenIA.parametres.fc}</span>}
                      {examenIA.parametres.fr && <span>FR {examenIA.parametres.fr}</span>}
                      {examenIA.parametres.muqueuses && <span className="col-span-2">Muq. {examenIA.parametres.muqueuses}</span>}
                    </div>
                  )}
                </div>

                {examenIA.examens_proposes && examenIA.examens_proposes.length > 0 && phase === "SYNTHESE" && (
                  <ExamensCheckbox
                    examens={examenIA.examens_proposes}
                    onValider={handleValiderExamens}
                    processing={processing}
                  />
                )}

                <JsonPreviewCard
                  title="Données structurées — Examen clinique IA"
                  icon={<ClipboardList className="h-4 w-4" />}
                  data={examenIA}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PHASE 3 — SYNTHÈSE + ORDONNANCE ÉDITABLE
      ══════════════════════════════════════════════════════════════ */}
      {(phase === "SYNTHESE" || phase === "TERMINEE") && syntheseIA && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                phase === "TERMINEE" ? "bg-green-500 text-white" : "bg-amber-500 text-white"
              }`}>
                {phase === "TERMINEE" ? "✓" : "3"}
              </span>
              Synthèse IA &amp; Ordonnance
              {phase === "SYNTHESE" && (
                <Badge variant="outline" className="text-amber-600 border-amber-400 ml-2 text-xs">
                  En attente de validation
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Diagnostic final */}
            <div className="text-sm bg-green-50 rounded p-3 border border-green-200">
              <p className="font-medium text-green-900 mb-1">Diagnostic final</p>
              <p className="text-green-800 font-semibold">{syntheseIA.diagnostic_final || "—"}</p>
              {syntheseIA.diagnostics_differentiels && syntheseIA.diagnostics_differentiels.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-green-700 font-semibold">Diagnostics différentiels :</p>
                  <ul className="list-disc list-inside text-xs text-green-700">
                    {syntheseIA.diagnostics_differentiels.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}
              {syntheseIA.suivi && (
                <p className="mt-2 text-xs text-green-700 italic">Suivi : {syntheseIA.suivi}</p>
              )}
            </div>

            {/* Ordonnance éditable */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Pill className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">
                  Ordonnance suggérée
                  {ordonnanceEdited && (
                    <span className="ml-2 text-xs text-amber-600 font-normal">(modifiée)</span>
                  )}
                </p>
              </div>
              {phase === "SYNTHESE" ? (
                <OrdonnanceEditor
                  lignes={editedOrdonnance}
                  onChange={l => { setEditedOrdonnance(l); setOrdonnanceEdited(true); }}
                />
              ) : (
                <div className="text-sm text-muted-foreground whitespace-pre-line bg-muted rounded p-3">
                  {state.ordonnance?.contenu || "—"}
                </div>
              )}
            </div>

            {/* Devis actes */}
            {state.devisActes && state.devisActes.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Actes à facturer
                </p>
                <div className="rounded border divide-y text-sm">
                  {state.devisActes.map((a, i) => (
                    <div key={i} className="flex justify-between px-3 py-2">
                      <span>{a.description}</span>
                      <span className="text-muted-foreground">
                        {a.quantite} × {a.prixUnitaire}€ HT
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <JsonPreviewCard
              title="Données structurées — Synthèse IA"
              icon={<ClipboardList className="h-4 w-4" />}
              data={syntheseIA}
            />

            {/* ── Validation checkpoint (SYNTHESE → TERMINEE) ── */}
            {phase === "SYNTHESE" && (
              <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 text-sm mb-1">
                      Validation vétérinaire requise
                    </p>
                    <p className="text-xs text-amber-700 mb-3">
                      Vérifiez et modifiez si nécessaire l'ordonnance ci-dessus, puis validez pour terminer la consultation. Votre identifiant Clerk sera enregistré comme validateur.
                    </p>
                    {!userId && (
                      <div className="flex items-center gap-1 text-xs text-red-600 mb-2">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Identifiant vétérinaire non disponible — assurez-vous d'être connecté.
                      </div>
                    )}
                    <Button
                      onClick={handleTerminer}
                      disabled={processing || !userId}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {processing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Valider et terminer la consultation
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Validation confirmée */}
            {phase === "TERMINEE" && state.validation?.wasValidated && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded p-3 border border-green-200">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  Consultation validée par le vétérinaire{" "}
                  {state.validation.validatedBy ? (
                    <code className="text-xs bg-green-100 px-1 rounded">{state.validation.validatedBy}</code>
                  ) : ""}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── ExamensCheckbox sub-component ─────────────────────────────────────────────

function ExamensCheckbox({
  examens,
  onValider,
  processing,
}: {
  examens: { examen: string; priorite: string; justification?: string }[];
  onValider: (selected: { examen: string; priorite: string }[]) => void;
  processing: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(examens.map((_, i) => i)) // all selected by default
  );

  const toggle = (i: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const handleSubmit = () => {
    const chosen = examens.filter((_, i) => selected.has(i));
    onValider(chosen);
  };

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-slate-50">
      <p className="text-sm font-semibold text-slate-700">
        Examens complémentaires proposés — sélectionnez ceux à retenir :
      </p>
      {examens.map((ex, i) => (
        <label key={i} className="flex items-start gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={selected.has(i)}
            onChange={() => toggle(i)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">{ex.examen}</span>
            <Badge
              variant="outline"
              className={`ml-2 text-xs ${
                ex.priorite === "urgent"
                  ? "border-red-400 text-red-700"
                  : ex.priorite === "recommande"
                  ? "border-blue-400 text-blue-700"
                  : "border-gray-300 text-gray-500"
              }`}
            >
              {ex.priorite}
            </Badge>
            {ex.justification && (
              <span className="block text-xs text-muted-foreground mt-0.5">{ex.justification}</span>
            )}
          </span>
        </label>
      ))}
      <Button size="sm" onClick={handleSubmit} disabled={processing} className="mt-2">
        {processing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
        Générer la synthèse IA (Claude Sonnet + ANMV)
      </Button>
    </div>
  );
}
