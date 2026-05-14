import { useState, useCallback, useEffect, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetConsultation, useUpdateConsultation, useGetDiagnosticIA,
  useGenerateOrdonnance, useGenerateFacture, useListActes,
  getGetConsultationQueryKey, getListFacturesQueryKey
} from "@workspace/api-client-react";
import { formatDateFR, formatDateLong } from "@/lib/utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Brain, FileText, Sparkles, Check, ChevronRight, Plus, Trash2, Receipt, Loader2, Printer, ExternalLink, Mic, Package, CheckCircle2, XCircle } from "lucide-react";
import { AnesthesieSection } from "@/components/AnesthesieSection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PatientBarre } from "@/components/PatientBarre";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import DicteeOrdonnanceDialog, { PrescriptionConfirmee } from "@/components/DicteeOrdonnanceDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VoiceInput } from "@/components/VoiceInput";
import { DoseCalculator } from "@/components/DoseCalculator";

import { unwrapResponse as __unwrapEnvelope } from "../../lib/queryClient";

type ActeLine = {
  acteId: number;
  quantite: number;
  prixUnitaire: number;
  description: string;
};

export default function ConsultationDetailPage() {
  const [, params] = useRoute("/consultations/:id");
  const id = parseInt(params?.id ?? "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [iaSaving, setIaSaving] = useState(false);

  const { data: consultation, isLoading } = useGetConsultation(id, {
    query: { enabled: !!id, queryKey: getGetConsultationQueryKey(id) }
  });
  const { data: actesList } = useListActes();

  const { data: factureExistante } = useQuery<any>({
    queryKey: ["facture-by-consultation", id],
    queryFn: async () => {
      const res = await fetch(`/api/factures/by-consultation/${id}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data ?? null;
    },
    enabled: !!id,
    refetchInterval: false,
  });

  const updateConsultation = useUpdateConsultation();
  const getDiagnosticIA = useGetDiagnosticIA();
  const generateOrdonnance = useGenerateOrdonnance();
  const generateFacture = useGenerateFacture();

  const [actes, setActes] = useState<ActeLine[]>([]);
  const [actesInit, setActesInit] = useState(false);

  useEffect(() => {
    if (!consultation?.actes) return;
    setActes(prev: any => {
      if (!actesInit || (prev.length === 0 && consultation.actes!.length > 0)) {
        return consultation.actes!.map(a => ({
          acteId: a.acteId,
          quantite: a.quantite,
          prixUnitaire: a.prixUnitaire,
          description: a.description ?? "",
        }));
      }
      return prev;
    });
    setActesInit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultation?.id, consultation?.actes?.length]);

  const handleSaveStep = useCallback(async (data: Record<string, unknown>) => {
    try {
      await updateConsultation.mutateAsync({ id, data: data as any });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
      toast({ title: "Sauvegardé" });
    } catch {
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" });
    }
  }, [id, updateConsultation, queryClient, toast]);

  const handleAutoSave = useCallback(async (data: Record<string, unknown>) => {
    try {
      await updateConsultation.mutateAsync({ id, data: data as any });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
    } catch {
      // autosave silent — ne pas bloquer l'UX
    }
  }, [id, updateConsultation, queryClient]);

  const handleDiagnosticIA = async () => {
    if (!consultation) return;
    const patient = consultation.patient;
    if (!patient) return;

    setIaSaving(true);
    try {
      const result = await getDiagnosticIA.mutateAsync({
        data: {
          espece: patient.espece,
          race: patient.race ?? null,
          sexe: patient.sexe,
          sterilise: patient.sterilise,
          poids: patient.poids ?? null,
          antecedents: patient.antecedents ?? null,
          allergies: patient.allergies ?? null,
          anamnese: consultation.anamnese ?? "",
          examenClinique: consultation.examenClinique ?? "",
          examensComplementaires: consultation.examensComplementaires ?? null,
        }
      });

      const texte = result.texteComplet;
      await updateConsultation.mutateAsync({ id, data: { diagnosticIA: texte } as any });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
      toast({ title: "Diagnostic IA généré" });
    } catch {
      toast({ title: "Erreur lors de la génération du diagnostic", variant: "destructive" });
    } finally {
      setIaSaving(false);
    }
  };

  const handleGenerateOrdonnance = async () => {
    try {
      await handleSaveActes();
      const result = await generateOrdonnance.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
      toast({ title: "Ordonnance générée" });
    } catch {
      toast({ title: "Erreur lors de la génération de l'ordonnance", variant: "destructive" });
    }
  };

  const handleGenerateFacture = async () => {
    try {
      await handleSaveActes();
      const facture = await generateFacture.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListFacturesQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["facture-by-consultation", id] });
      toast({ title: "Facture créée", description: "Redirection vers la facture…" });
      if (facture?.id) navigate(`/factures/${facture.id}`);
    } catch {
      toast({ title: "Erreur lors de la génération de la facture", variant: "destructive" });
    }
  };

  const handleGenerateFactureFromActes = async (newActes: ActeLine[]) => {
    try {
      await updateConsultation.mutateAsync({
        id, data: {
          statut: "terminee",
          actes: newActes.map(a => ({
            acteId: a.acteId,
            quantite: a.quantite,
            prixUnitaire: a.prixUnitaire,
            description: a.description || null,
          }))
        } as any
      });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
      const facture = await generateFacture.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListFacturesQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["facture-by-consultation", id] });
      toast({ title: "Facture créée", description: "Redirection vers la facture…" });
      if (facture?.id) navigate(`/factures/${facture.id}`);
    } catch {
      toast({ title: "Erreur lors de la génération de la facture", variant: "destructive" });
    }
  };

  const handleSaveActes = async () => {
    await updateConsultation.mutateAsync({
      id, data: {
        statut: "terminee",
        actes: actes.map(a => ({
          acteId: a.acteId,
          quantite: a.quantite,
          prixUnitaire: a.prixUnitaire,
          description: a.description || null,
        }))
      }
    });
    queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListFacturesQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["facture-by-consultation", id] });
    // Invalider toutes les factures individuelles pour éviter le cache périmé
    queryClient.invalidateQueries({ queryKey: ["factures"] });
  };

  const addActe = () => {
    const firstActe = actesList?.[0];
    setActes(prev: any => [...prev, {
      acteId: firstActe?.id ?? 0,
      quantite: 1,
      prixUnitaire: firstActe?.prixDefaut ?? 0,
      description: "",
    }]);
  };

  const removeActe = (idx: number) => setActes(prev: any => prev.filter((_, i) => i !== idx));

  const totalHT = actes.reduce((sum, a) => sum + a.quantite * a.prixUnitaire, 0);
  const totalTTC = totalHT * 1.20;

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64" />
    </div>
  );

  if (!consultation) return <div className="text-center py-16">Consultation non trouvée</div>;

  const patient = consultation.patient;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/consultations">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/consultations" className="hover:text-foreground transition-colors">Consultations</Link>
            <span>/</span>
            {patient && (
              <Link href={`/patients/${patient.id}`} className="hover:text-primary transition-colors font-medium">
                ← {patient.nom}
              </Link>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Consultation — {patient?.nom ?? "Patient"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {consultation.veterinaire?.startsWith('Dr.') ? consultation.veterinaire : `Dr. ${consultation.veterinaire}`} • {formatDateLong(consultation.date)}
            {patient?.owner && ` • ${patient.owner.prenom} ${patient.owner.nom}`}
          </p>
        </div>
        <Badge variant={consultation.statut === "terminee" ? "outline" : consultation.statut === "en_cours" ? "default" : "secondary"}>
          {consultation.statut === "en_attente" ? "En attente" : consultation.statut === "en_cours" ? "En cours" : "Terminée"}
        </Badge>
      </div>

      {consultation.statut === "terminee" && !factureExistante && (
        <a
          href={"/factures/nouvelle?consultationId=" + consultation.id}
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
        >
          <span>💳</span>
          Créer la facture
        </a>
      )}

      {factureExistante?.id && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-green-600" />
            <div>
              <span className="font-semibold text-green-800">{factureExistante.numero}</span>
              <span className="text-sm text-green-600 ml-2">
                {factureExistante.montantTTC?.toFixed(2)} € TTC
                {factureExistante.statut === "payee" ? " — Payée" : " — En attente"}
              </span>
            </div>
          </div>
          <Link href={`/factures/${factureExistante.id}`}>
            <Button variant="outline" size="sm" className="border-green-300 text-green-700 hover:bg-green-100">
              <ExternalLink className="h-3 w-3 mr-1" />
              Voir la facture
            </Button>
          </Link>
        </div>
      )}

      {patient && (
        <PatientBarre patient={patient as any} />
      )}

      {patient?.allergies && (
        <div className="flex items-start gap-3 bg-red-50 border-l-4 border-red-600 px-4 py-3 rounded-r-lg">
          <span className="text-red-600 mt-0.5 flex-shrink-0">⚠️</span>
          <div>
            <span className="text-red-800 font-bold text-sm uppercase tracking-wide">ALLERGIES : </span>
            <span className="text-red-700 text-sm">{patient.allergies}</span>
          </div>
        </div>
      )}

      {patient?.antecedents && (
        <div className="flex items-start gap-3 bg-amber-50 border-l-4 border-amber-500 px-4 py-3 rounded-r-lg">
          <span className="text-amber-600 mt-0.5 flex-shrink-0">📋</span>
          <div>
            <span className="text-amber-800 font-bold text-sm">Antécédents : </span>
            <span className="text-amber-700 text-sm">{patient.antecedents}</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="anamnese" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="anamnese" className="text-sm">📋 Anamnèse</TabsTrigger>
          <TabsTrigger value="examen" className="text-sm">🩺 Examen clinique</TabsTrigger>
          <TabsTrigger value="examens-compl" className="text-sm">🔬 Examens compl.</TabsTrigger>
          <TabsTrigger value="diagnostic" className="text-sm">🧠 Diagnostic IA</TabsTrigger>
          <TabsTrigger value="actes" className="text-sm">💊 Ordonnance & Actes</TabsTrigger>
        </TabsList>

        <TabsContent value="anamnese">
          <EtapeAnamnese consultation={consultation} onAutoSave={handleAutoSave} />
        </TabsContent>

        <TabsContent value="examen">
          <EtapeExamenClinique consultation={consultation} onAutoSave={handleAutoSave} />
        </TabsContent>

        <TabsContent value="examens-compl">
          <EtapeExamensCompl consultation={consultation} onAutoSave={handleAutoSave} />
        </TabsContent>

        <TabsContent value="diagnostic">
          <EtapeDiagnosticIA
            consultation={consultation}
            onAutoSave={handleAutoSave}
            onGenerateIA={handleDiagnosticIA}
            isGenerating={iaSaving || getDiagnosticIA.isPending}
          />
        </TabsContent>

        <TabsContent value="actes">
          <EtapeOrdonnanceActes
            consultation={consultation}
            actes={actes}
            actesList={actesList ?? []}
            onActesChange={setActes}
            onAddActe={addActe}
            onRemoveActe={removeActe}
            onSaveActes={handleSaveActes}
            onGenerateOrdonnance={handleGenerateOrdonnance}
            onGenerateFacture={handleGenerateFacture}
            onGenerateFactureFromActes={handleGenerateFactureFromActes}
            totalHT={totalHT}
            totalTTC={totalTTC}
            isGeneratingOrdonnance={generateOrdonnance.isPending}
            isGeneratingFacture={generateFacture.isPending}
          />
        </TabsContent>
      </Tabs>

      <AnesthesieSection
        consultationId={consultation.id}
        espece={consultation.patient?.espece}
        race={consultation.patient?.race ?? undefined}
        poids={consultation.patient?.poids ?? undefined}
        diagnostic={consultation.diagnostic ?? undefined}
      />
    </div>
  );
}

function AutoSaveIndicator({ state }: { state: "idle" | "pending" | "saved" }) {
  if (state === "idle") return null;
  return (
    <span className={`text-xs font-normal ml-2 ${state === "pending" ? "text-muted-foreground" : "text-green-600"}`}>
      {state === "pending" ? "Enregistrement…" : "✓ Sauvegardé"}
    </span>
  );
}

function EtapeAnamnese({ consultation, onAutoSave }: any) {
  const [anamnese, setAnamnese] = useState(consultation.anamnese ?? "");
  const [motif, setMotif] = useState(consultation.motif ?? "");
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    setSaveState("pending");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await onAutoSave({ motif, anamnese, statut: "en_cours" });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    }, 1000);
  }, [anamnese, motif]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Anamnèse</span>
          <AutoSaveIndicator state={saveState} />
        </CardTitle>
        <p className="text-sm text-muted-foreground">Motif de consultation et historique rapporté par le propriétaire</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Motif de consultation</Label>
          <Input className="mt-1" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Boiterie membre antérieur droit depuis 3 jours..." />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Anamnèse (dictée ou saisie)</Label>
            <VoiceInput onTranscript={(t) => setAnamnese(prev: any => prev ? prev + " " + t : t)} />
          </div>
          <Textarea rows={8} value={anamnese} onChange={e => setAnamnese(e.target.value)}
            placeholder="Décrivez l'histoire clinique du patient : début des symptômes, évolution, contexte, traitements en cours, comportement alimentaire, hydratation, etc." />
        </div>
      </CardContent>
    </Card>
  );
}

function EtapeExamenClinique({ consultation, onAutoSave }: any) {
  const [examenClinique, setExamenClinique] = useState(consultation.examenClinique ?? "");
  const [poids, setPoids] = useState(consultation.poids?.toString() ?? "");
  const [temperature, setTemperature] = useState(consultation.temperature?.toString() ?? "");
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    setSaveState("pending");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await onAutoSave({
        examenClinique,
        poids: poids ? parseFloat(poids) : null,
        temperature: temperature ? parseFloat(temperature) : null,
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    }, 1000);
  }, [examenClinique, poids, temperature]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Examen clinique</span>
          <AutoSaveIndicator state={saveState} />
        </CardTitle>
        <p className="text-sm text-muted-foreground">Constantes vitales et observations systèmes</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Poids (kg)</Label>
            <Input className="mt-1" type="number" step="0.1" value={poids} onChange={e => setPoids(e.target.value)} placeholder="28.5" />
          </div>
          <div>
            <Label>Température (°C)</Label>
            <Input className="mt-1" type="number" step="0.1" value={temperature} onChange={e => setTemperature(e.target.value)} placeholder="38.5" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Examen clinique (dictée ou saisie)</Label>
            <VoiceInput onTranscript={(t) => setExamenClinique(prev: any => prev ? prev + " " + t : t)} />
          </div>
          <Textarea rows={10} value={examenClinique} onChange={e => setExamenClinique(e.target.value)}
            placeholder="État général, muqueuses, fréquence cardiaque, respiratoire, palpation abdominale, auscultation cardiopulmonaire, examen locomoteur, ganglions, peau et phanères..." />
        </div>
      </CardContent>
    </Card>
  );
}

function EtapeExamensCompl({ consultation, onAutoSave }: any) {
  const [examens, setExamens] = useState(consultation.examensComplementaires ?? "");
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    setSaveState("pending");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await onAutoSave({ examensComplementaires: examens });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    }, 1000);
  }, [examens]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Examens complémentaires</span>
          <AutoSaveIndicator state={saveState} />
        </CardTitle>
        <p className="text-sm text-muted-foreground">Résultats biologiques, imagerie et autres examens</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Résultats des examens complémentaires</Label>
            <VoiceInput onTranscript={(t) => setExamens(prev: any => prev ? prev + " " + t : t)} />
          </div>
          <Textarea rows={10} value={examens} onChange={e => setExamens(e.target.value)}
            placeholder="NFS, biochimie, urines, résultats radiographiques, échographiques, etc. Laissez vide si aucun examen complémentaire." />
        </div>
      </CardContent>
    </Card>
  );
}

function EtapeDiagnosticIA({ consultation, onAutoSave, onGenerateIA, isGenerating }: any) {
  const [diagnostic, setDiagnostic] = useState(consultation.diagnostic ?? "");
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    setSaveState("pending");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await onAutoSave({ diagnostic });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    }, 1000);
  }, [diagnostic]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <span>Diagnostic différentiel IA</span>
          <AutoSaveIndicator state={saveState} />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Claude analyse l'anamnèse et l'examen clinique pour proposer des diagnostics différentiels
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onGenerateIA} disabled={isGenerating} className="w-full" size="lg">
          <Sparkles className="mr-2 h-5 w-5" />
          {isGenerating ? "Analyse en cours par Claude..." : "Générer le diagnostic IA avec Claude"}
        </Button>

        {consultation.diagnosticIA && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-primary font-medium">
              <Brain className="h-4 w-4" />
              Diagnostic différentiel par Claude
            </div>
            <div className="text-sm leading-relaxed"><ReactMarkdown>{consultation.diagnosticIA}</ReactMarkdown></div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Diagnostic retenu (à compléter par le vétérinaire)</Label>
            <VoiceInput onTranscript={(t) => setDiagnostic(prev: any => prev ? prev + " " + t : t)} />
          </div>
          <Textarea rows={4} value={diagnostic} onChange={e => setDiagnostic(e.target.value)}
            placeholder="Diagnostic final retenu après analyse..." />
        </div>
      </CardContent>
    </Card>
  );
}

function EtapeOrdonnanceActes({
  consultation, actes, actesList, onActesChange, onRemoveActe,
  onSaveActes, onGenerateOrdonnance, onGenerateFacture, onGenerateFactureFromActes, totalHT, totalTTC,
  isGeneratingOrdonnance, isGeneratingFacture
}: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creatingOrdonnanceIA, setCreatingOrdonnanceIA] = useState(false);
  const [ordonnanceIAId, setOrdonnanceIAId] = useState<number | null>(null);
  const [dicteeOpen, setDicteeOpen] = useState(false);
  const [showAddActeDialog, setShowAddActeDialog] = useState(false);
  const [newActeForm, setNewActeForm] = useState({ description: "", quantite: 1, prixHT: "", tva: "20", acteId: "" });
  const [savingActe, setSavingActe] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [decrementeStockOpen, setDecrementeStockOpen] = useState(false);
  const [decrementeStockResult, setDecrementeStockResult] = useState<any>(null);
  const [decrementeStockLoading, setDecrementeStockLoading] = useState(false);

  const handleDecrementeOrdonnance = async () => {
    const ordonnanceText = consultation?.ordonnance;
    if (!ordonnanceText) {
      toast({ title: "Aucune ordonnance à analyser", variant: "destructive" });
      return;
    }
    setDecrementeStockLoading(true);
    setDecrementeStockResult(null);
    setDecrementeStockOpen(true);
    try {
      const res = await fetch("/api/stock/decremente-ordonnance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordonnanceText, consultationId: consultation.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setDecrementeStockResult(data);
    } catch (e: any) {
      toast({ title: e.message ?? "Erreur", variant: "destructive" });
      setDecrementeStockOpen(false);
    } finally {
      setDecrementeStockLoading(false);
    }
  };

  const handleDicteeConfirmed = async (prescriptions: PrescriptionConfirmee[], ordonnanceTexte: string) => {
    try {
      const res = await fetch("/api/ai/confirmer-dictee-ordonnance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId: consultation.id,
          patientId: consultation.patientId,
          veterinaire: consultation.veterinaire,
          prescriptions,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.ordonnance?.id) setOrdonnanceIAId(data.ordonnance.id);
      queryClient.invalidateQueries({ queryKey: ["consultation", consultation.id] });
      toast({
        title: `Ordonnance créée`,
        description: `${prescriptions.length} médicament${prescriptions.length > 1 ? "s" : ""} — mouvements de stock enregistrés`,
      });
    } catch (e) {
      toast({ title: "Erreur lors de la confirmation", description: String(e), variant: "destructive" });
    }
  };

  async function handleCreateOrdonnanceIA() {
    setCreatingOrdonnanceIA(true);
    try {
      const res = await fetch("/api/ordonnances/ia/generer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId: consultation.id }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      setOrdonnanceIAId(data.id);
      toast({ title: "Ordonnance créée", description: "L'ordonnance structurée a été générée par l'IA." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer l'ordonnance.", variant: "destructive" });
    } finally {
      setCreatingOrdonnanceIA(false);
    }
  }
  const [isDeletingFacture, setIsDeletingFacture] = useState(false);
  const [voixPreview, setVoixPreview] = useState<{
    lignes: { acteId: number | null; description: string; quantite: number; prixUnitaire: number; tvaRate: number; montantHT: number }[];
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    resume: string;
  } | null>(null);

  const handleGenererFactureVoix = async (transcript: string) => {
    setVoixPreview(null);
    const res = await fetch("/api/ai/generer-facture-voix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) throw new Error("Erreur lors de la génération vocale de facture");
    const data = await res.json();
    setVoixPreview(data.data ?? data);
  };

  const handleValiderVoix = async () => {
    if (!voixPreview) return;
    const newActes = voixPreview.lignes.map(l => ({
        acteId: l.acteId ?? null,
        quantite: l.quantite,
        prixUnitaire: typeof l.prixUnitaire === 'number' ? l.prixUnitaire : (Number(l.prixUnitaire) || 0),
        description: l.description,
      }));
    if (newActes.length === 0) {
      toast({ title: "Aucun acte d\u00e9tect\u00e9", description: "La dict\u00e9e vocale n'a reconnu aucun acte. Veuillez les ajouter manuellement.", variant: "destructive" });
      return;
    }
    onActesChange(newActes);
    setVoixPreview(null);
    await onGenerateFactureFromActes(newActes);
  };

  const handleDeleteFacture = async () => {
    if (!consultation.facture?.id) return;
    setIsDeletingFacture(true);
    try {
      const res = await fetch(`/api/factures/${consultation.facture.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(consultation.id) });
      queryClient.invalidateQueries({ queryKey: getListFacturesQueryKey() });
      toast({ title: "Facture annulée" });
    } catch {
      toast({ title: "Erreur lors de la suppression de la facture", variant: "destructive" });
    } finally {
      setIsDeletingFacture(false);
    }
  };

  const updateActe = (idx: number, field: string, value: unknown) => {
    const updated = [...actes];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "acteId") {
      const acte = actesList.find((a: any) => a.id === value);
      if (acte) updated[idx].prixUnitaire = acte.prixDefaut;
    }
    onActesChange(updated);
  };

  return (
    <div className="space-y-6">
      <DoseCalculator
        poids={consultation?.patient?.poids ?? consultation?.poids}
        espece={consultation?.patient?.espece}
      />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Actes réalisés</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Saisissez les actes et médicaments de cette consultation</p>
            </div>
            <Button onClick={() => {
              setNewActeForm({ description: "", quantite: 1, prixHT: "", tva: "20", acteId: "" });
              setShowAddActeDialog(true);
            }} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un acte
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {actes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>Aucun acte ajouté. Cliquez sur "Ajouter un acte" pour commencer.</p>
            </div>
          ) : (
            actes.map((acte: ActeLine, idx: number) => (
              <div key={idx} className="grid gap-3 p-3 bg-muted/30 rounded-lg" style={{ gridTemplateColumns: "3fr 1fr 1.5fr auto" }}>
                <div>
                  <Label className="text-xs">Acte / Description</Label>
                  {acte.acteId > 0 && actesList.length > 0 ? (
                    <Select value={String(acte.acteId)} onValueChange={v => updateActe(idx, "acteId", parseInt(v))}>
                      <SelectTrigger className="mt-1 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {actesList.map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.nom} ({a.categorie})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="mt-1 h-8"
                      value={acte.description}
                      onChange={e => updateActe(idx, "description", e.target.value)}
                      placeholder="Description de l'acte..."
                    />
                  )}
                </div>
                <div>
                  <Label className="text-xs">Qté</Label>
                  <Input className="mt-1 h-8" type="number" min="1" value={acte.quantite}
                    onChange={e => updateActe(idx, "quantite", parseInt(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Prix unitaire (€)</Label>
                  <Input className="mt-1 h-8" type="number" step="0.01" value={acte.prixUnitaire}
                    onChange={e => updateActe(idx, "prixUnitaire", parseFloat(e.target.value))} />
                </div>
                <div className="flex items-end pb-0.5">
                  <Button variant="ghost" size="icon" onClick={() => onRemoveActe(idx)} className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}

          {actes.length > 0 && (
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Sous-total HT</span>
                <span>{totalHT.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>TVA (20%)</span>
                <span>{(totalTTC - totalHT).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between font-semibold text-base border-t pt-1">
                <span>Total TTC</span>
                <span>{totalTTC.toFixed(2)} €</span>
              </div>
            </div>
          )}

          <Button onClick={onSaveActes} variant="outline" className="w-full">
            <Check className="mr-2 h-4 w-4" />
            Enregistrer les actes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ordonnance
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDicteeOpen(true)}
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Mic className="h-4 w-4" />
              Dictée ordonnance IA
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {consultation.ordonnance ? (
            <div className="bg-muted/30 border rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm font-sans">{consultation.ordonnance}</pre>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Aucune ordonnance générée</p>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={onGenerateOrdonnance} disabled={isGeneratingOrdonnance} className="flex-1 min-w-[160px]">
              <Sparkles className="mr-2 h-4 w-4" />
              {isGeneratingOrdonnance ? "Génération en cours..." : "Générer avec Claude"}
            </Button>
            {ordonnanceIAId ? (
              <a href={`/ordonnances/${ordonnanceIAId}/imprimer`} target="_blank" rel="noreferrer">
                <Button variant="outline">
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimer
                </Button>
              </a>
            ) : (
              <Button
                variant="outline"
                onClick={handleCreateOrdonnanceIA}
                disabled={creatingOrdonnanceIA}
              >
                {creatingOrdonnanceIA ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création...</>
                ) : (
                  <><FileText className="mr-2 h-4 w-4" />Créer ordonnance</>
                )}
              </Button>
            )}
            {consultation?.ordonnance && (
              <Button
                variant="outline"
                onClick={handleDecrementeOrdonnance}
                disabled={decrementeStockLoading}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Package className="mr-2 h-4 w-4" />
                {decrementeStockLoading ? "Analyse..." : "→ Décrémenter stock"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <DicteeOrdonnanceDialog
        open={dicteeOpen}
        onClose={() => setDicteeOpen(false)}
        onConfirmed={handleDicteeConfirmed}
      />

      {/* C1 — Rappels post-consultation */}
      <RappelsPostConsultation consultationId={consultation.id} patientId={consultation.patientId ?? null} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Facturation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {consultation.facture ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-semibold text-green-700">{consultation.facture.numero}</div>
                  <div className="text-sm text-green-600">Montant TTC : {consultation.facture.montantTTC?.toFixed(2)} €</div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/factures/${consultation.facture.id}/imprimer`}>
                    <Button variant="outline" size="sm">
                      <Printer className="mr-1.5 h-3.5 w-3.5" />
                      Imprimer
                    </Button>
                  </Link>
                  <Link href={`/factures/${consultation.facture.id}`}>
                    <Button variant="outline" size="sm">Voir la facture</Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={isDeletingFacture}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Annuler
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Annuler cette facture ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Êtes-vous sûr de vouloir annuler la facture {consultation.facture.numero} ? Cette action est irréversible. Vous pourrez en créer une nouvelle ensuite.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Non, garder la facture</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteFacture} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Oui, annuler la facture
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ) : (
            <>
              <VoiceRecorder
                onAction={handleGenererFactureVoix}
                actionLabel="Générer la facture"
                placeholder='Dictez les actes : "consultation, vaccin rage, amoxicilline 500mg pendant 7 jours"...'
              />

              {voixPreview && (
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-violet-50 border-b border-violet-200 px-4 py-3">
                    <div className="flex items-center gap-2 text-violet-800 font-medium text-sm">
                      <Sparkles className="h-4 w-4" />
                      Prévisualisation de la facture dictée
                    </div>
                    {voixPreview.resume && (
                      <p className="text-xs text-violet-600 mt-1">{voixPreview.resume}</p>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    {voixPreview.lignes.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <div>
                          <span className="font-medium">{l.description}</span>
                          <span className="text-muted-foreground ml-2">× {l.quantite}</span>
                          {l.acteId == null && (
                            <span className="text-xs text-amber-600 ml-2">(acte libre)</span>
                          )}
                        </div>
                        <span className="font-medium">{l.montantHT.toFixed(2)} € HT</span>
                      </div>
                    ))}
                    <div className="pt-2 space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total HT</span><span>{voixPreview.totalHT.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>TVA (20%)</span><span>{voixPreview.totalTVA.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1">
                        <span>Total TTC</span><span>{voixPreview.totalTTC.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4 flex gap-2">
                    <Button
                      type="button"
                      onClick={handleValiderVoix}
                      disabled={isGeneratingFacture}
                      className="flex-1"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {isGeneratingFacture ? "Création..." : "Valider et créer la facture"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setVoixPreview(null)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {!voixPreview && actes.length > 0 && (
                <Button onClick={onGenerateFacture} disabled={isGeneratingFacture} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  {isGeneratingFacture
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création en cours…</>
                    : <><Receipt className="mr-2 h-4 w-4" />Finaliser et facturer ({actes.length} acte{actes.length > 1 ? "s" : ""} — {totalTTC.toFixed(2)} € TTC)</>
                  }
                </Button>
              )}
              {!voixPreview && actes.length === 0 && (
                <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Ajoutez et enregistrez vos actes pour générer la facture.</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog — Résultat décrémentation stock depuis ordonnance */}
      <Dialog open={decrementeStockOpen} onOpenChange={setDecrementeStockOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Décrémentation stock — Ordonnance
            </DialogTitle>
          </DialogHeader>
          {decrementeStockLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-muted-foreground">Analyse de l'ordonnance par IA...</p>
            </div>
          ) : decrementeStockResult ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">{decrementeStockResult.message}</p>
              {decrementeStockResult.parsedMedicaments?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Médicaments détectés</p>
                  {decrementeStockResult.resultats?.map((r: any, i: number) => (
                    <div key={i} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${r.notFound ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                      <div className="flex items-center gap-2">
                        {r.notFound ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        <span className="font-medium">{r.nom}</span>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {r.notFound ? "Non trouvé dans le stock" : `${r.qtePrise} unité(s) sorties`}
                        {r.alerteCreee && <span className="ml-2 text-amber-600 font-semibold">⚠ Stock bas</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {decrementeStockResult.nonTrouvesDansStock?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>Produits non trouvés dans le stock :</strong> {decrementeStockResult.nonTrouvesDansStock.join(", ")}. Vérifiez les noms dans votre catalogue stock.
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setDecrementeStockOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Ajouter un acte manuellement */}
      <Dialog open={showAddActeDialog} onOpenChange={setShowAddActeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un acte / médicament</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {actesList.length > 0 && (
              <div className="space-y-1">
                <Label className="text-sm">Rechercher dans le catalogue</Label>
                <Popover open={catalogueOpen} onOpenChange={setCatalogueOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm">
                      {newActeForm.acteId
                        ? (actesList.find((a: any) => String(a.id) === newActeForm.acteId) as any)?.nom ?? "Sélectionner…"
                        : "Rechercher un acte ou médicament…"}
                      <span className="ml-2 opacity-40 text-xs">▼</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher un acte…" className="text-sm" />
                      <CommandList>
                        <CommandEmpty>Aucun acte trouvé.</CommandEmpty>
                        <CommandGroup>
                          {actesList.map((a: any) => (
                            <CommandItem
                              key={a.id}
                              value={`${a.nom} ${a.categorie ?? ""}`}
                              onSelect={() => {
                                setNewActeForm(f => ({
                                  ...f,
                                  acteId: String(a.id),
                                  description: a.nom,
                                  prixHT: a.prixDefaut != null ? String(a.prixDefaut) : f.prixHT,
                                  tva: a.tvaRate != null ? String(a.tvaRate) : f.tva,
                                }));
                                setCatalogueOpen(false);
                              }}
                            >
                              <div className="flex justify-between w-full">
                                <span>{a.nom}</span>
                                <span className="text-muted-foreground text-xs ml-4">{a.prixDefaut?.toFixed(2)} € HT</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-sm">Description *</Label>
              <Input
                value={newActeForm.description}
                onChange={e => setNewActeForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Consultation, Radiographie, Meloxicam 1mg/mL..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Quantité</Label>
                <Input
                  type="number" min="1"
                  value={newActeForm.quantite}
                  onChange={e => setNewActeForm(f => ({ ...f, quantite: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Prix unitaire HT (€) *</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={newActeForm.prixHT}
                  onChange={e => setNewActeForm(f => ({ ...f, prixHT: e.target.value }))}
                  placeholder="Ex: 35.00"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">TVA</Label>
              <Select value={newActeForm.tva} onValueChange={v => setNewActeForm(f => ({ ...f, tva: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 % (standard)</SelectItem>
                  <SelectItem value="10">10 % (réduit)</SelectItem>
                  <SelectItem value="5.5">5,5 %</SelectItem>
                  <SelectItem value="0">0 % (exonéré)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newActeForm.prixHT && (
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>HT ({newActeForm.quantite} × {parseFloat(newActeForm.prixHT || "0").toFixed(2)} €)</span>
                  <span>{(newActeForm.quantite * parseFloat(newActeForm.prixHT || "0")).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>TTC</span>
                  <span>{(newActeForm.quantite * parseFloat(newActeForm.prixHT || "0") * (1 + parseFloat(newActeForm.tva) / 100)).toFixed(2)} €</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddActeDialog(false)}>Annuler</Button>
            <Button
              disabled={savingActe}
              onClick={async () => {
                if (!newActeForm.description.trim()) {
                  toast({ title: "La description est obligatoire", variant: "destructive" });
                  return;
                }
                if (!newActeForm.prixHT || parseFloat(newActeForm.prixHT) < 0) {
                  toast({ title: "Le prix HT est obligatoire", variant: "destructive" });
                  return;
                }
                setSavingActe(true);
                try {
                  const consultationId = consultation?.id;
                  if (!consultationId) throw new Error("Consultation introuvable");
                  const res = await fetch(`/api/consultations/${consultationId}/actes`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      description: newActeForm.description.trim(),
                      quantite: newActeForm.quantite,
                      prixUnitaire: parseFloat(newActeForm.prixHT),
                      acteId: newActeForm.acteId ? parseInt(newActeForm.acteId) : null,
                    }),
                  });
                  if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error ?? "Erreur serveur");
                  }
                  await queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(consultationId) });
                  setShowAddActeDialog(false);
                  setNewActeForm({ description: "", quantite: 1, prixHT: "", tva: "20", acteId: "" });
                  toast({ title: "Acte ajouté avec succès" });
                } catch {
                  toast({ title: "Erreur lors de l'ajout de l'acte", variant: "destructive" });
                } finally {
                  setSavingActe(false);
                }
              }}
            >
              {savingActe ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</> : "Ajouter l'acte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── C1 : Rappels post-consultation ──────────────────────────────────────────

const RAPPELS_RAPIDES = [
  { label: "J+7 Contrôle", joursDelai: 7 },
  { label: "J+14 Suivi", joursDelai: 14 },
  { label: "1 mois Bilan", joursDelai: 30 },
  { label: "6 mois Check-up", joursDelai: 180 },
  { label: "1 an Vaccin", joursDelai: 365 },
];

function RappelsPostConsultation({ consultationId, patientId }: { consultationId: number; patientId: number | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState<string | null>(null);

  const { data: rappels = [], isLoading } = useQuery<any>({
    queryKey: ["rappels-consultation", consultationId],
    queryFn: () => fetch(`/api/rappels?consultationId=${consultationId}`).then(__unwrapEnvelope),
    enabled: !!consultationId,
  });

  const createRappel = async (label: string, joursDelai: number) => {
    setCreating(label);
    try {
      const res = await fetch("/api/rappels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId, patientId, label, joursDelai }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["rappels-consultation", consultationId] });
      const d = new Date(); d.setDate(d.getDate() + joursDelai);
      toast({ title: `Rappel créé`, description: `${label} — échéance le ${d.toLocaleDateString("fr-FR")}` });
    } catch {
      toast({ title: "Erreur lors de la création du rappel", variant: "destructive" });
    } finally {
      setCreating(null);
    }
  };

  const deleteRappel = async (id: number) => {
    await fetch(`/api/rappels/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["rappels-consultation", consultationId] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span>🔔</span> Rappels post-consultation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {RAPPELS_RAPIDES.map(r => (
            <Button
              key={r.label}
              variant="outline"
              size="sm"
              disabled={creating === r.label}
              onClick={() => createRappel(r.label, r.joursDelai)}
              className="text-xs"
            >
              {creating === r.label ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <span className="mr-1">+</span>}
              {r.label}
            </Button>
          ))}
        </div>
        {!isLoading && rappels.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {rappels.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔔</span>
                  <div>
                    <span className="font-medium">{r.label}</span>
                    {r.dateEcheance && (
                      <span className="text-xs text-muted-foreground ml-2">
                        — {new Date(r.dateEcheance + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="text-muted-foreground hover:text-destructive text-xs ml-3"
                  onClick={() => deleteRappel(r.id)}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
