import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import {
  useCreateConsultation,
  useUpdateConsultation,
  useListPatients,
  getListConsultationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle,
  Loader2,
  FileText,
  X,
  Upload,
  AlertTriangle,
  Mic,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDateFR } from "@/lib/utils";
import { PatientBarre } from "@/components/PatientBarre";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import DicteeOrdonnanceDialog, { PrescriptionConfirmee } from "@/components/DicteeOrdonnanceDialog";

/** Fetch authentifiÃ© : injecte le Bearer token Clerk sur toutes les requÃªtes /api/* */
async function authFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = await (window as any).Clerk?.session?.getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

const ETAPES = [
  { id: 1, label: "Patient & Contexte" },
  { id: 2, label: "AnamnÃ¨se" },
  { id: 3, label: "Examen clinique" },
  { id: 4, label: "Diagnostic IA" },
  { id: 5, label: "Ordonnance & RÃ©cap" },
];

type DiagnosticItem = { nom: string; probabilite: string; description: string };

export default function NouvelleConsultationPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();
  const createConsultation = useCreateConsultation();
  const updateConsultation = useUpdateConsultation();
  const { data: patients } = useListPatients();
  const [isDiagnosticLoading, setIsDiagnosticLoading] = useState(false);

  const preSelectedPatientId = new URLSearchParams(search).get("patientId") ?? "";
  const [etape, setEtape] = useState(1);

  const [step1, setStep1] = useState({
    patientId: "",
    veterinaire: "",
    date: new Date().toISOString().split("T")[0],
    motif: "",
  });

  useEffect(() => {
    if (patients?.length && preSelectedPatientId) {
      setStep1(s => ({ ...s, patientId: preSelectedPatientId }));
    }
  }, [patients, preSelectedPatientId]);

  const [step2, setStep2] = useState({ anamnese: "" });
  const [step3, setStep3] = useState({
    poids: "",
    temperature: "",
    examenClinique: "",
    examensComplementaires: "",
  });
  const [step4, setStep4] = useState({
    diagnostic: "",
    diagnosticIA: "",
  });
  const [step4Result, setStep4Result] = useState<{
    diagnostics: DiagnosticItem[];
    urgence: string;
    recommandations: string;
  } | null>(null);
  const [step5, setStep5] = useState({ ordonnance: "", notes: "" });
  const [uploadedFiles, setUploadedFiles] = useState<
    { name: string; objectPath: string; type: string; previewUrl?: string }[]
  >([]);
  const [dicteeOpen, setDicteeOpen] = useState(false);
  const [pendingPrescriptions, setPendingPrescriptions] = useState<PrescriptionConfirmee[]>([]);

  useEffect(() => {
    if (user && !step1.veterinaire) {
      setStep1(f => ({ ...f, veterinaire: user.fullName || user.firstName || "" }));
    }
  }, [user]);

  const selectedPatient = patients?.find(p => String(p.id) === step1.patientId);

  const handleDiagnosticIA = async () => {
    if (!selectedPatient) {
      toast({ title: "Aucun patient sÃ©lectionnÃ©", variant: "destructive" });
      return;
    }
    setIsDiagnosticLoading(true);
    try {
      const endpoint =
        uploadedFiles.length > 0 ? "/api/ai/diagnostic-enrichi" : "/api/ai/diagnostic";
      const body = {
        espece: selectedPatient.espece,
        race: selectedPatient.race ?? null,
        age: null,
        poids: step3.poids ? parseFloat(step3.poids) : (selectedPatient.poids ?? null),
        sexe: selectedPatient.sexe,
        sterilise: selectedPatient.sterilise ?? false,
        anamnese: step2.anamnese,
        examenClinique: step3.examenClinique,
        examensComplementaires: step3.examensComplementaires || null,
        antecedents: selectedPatient.antecedents ?? null,
        allergies: selectedPatient.allergies ?? null,
        objectPaths: uploadedFiles.map(f => f.objectPath),
      };
      const response = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      const json = await response.json();
      const res = json.data ?? json;
      setStep4Result({
        diagnostics: res.diagnostics as DiagnosticItem[],
        urgence: res.urgence,
        recommandations: res.recommandations,
      });
      setStep4(f => ({ ...f, diagnosticIA: res.texteComplet }));
    } catch {
      toast({ title: "Erreur lors de la gÃ©nÃ©ration du diagnostic IA", variant: "destructive" });
    } finally {
      setIsDiagnosticLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!step1.patientId) {
      toast({ title: "Veuillez sÃ©lectionner un patient", variant: "destructive" });
      setEtape(1);
      return;
    }
    try {
      const consultation = await createConsultation.mutateAsync({
        data: {
          patientId: parseInt(step1.patientId),
          veterinaire: step1.veterinaire,
          date: step1.date,
          motif: step1.motif || null,
          statut: "en_cours",
        },
      });
      await updateConsultation.mutateAsync({
        id: consultation.id,
        data: {
          anamnese: step2.anamnese || null,
          poids: step3.poids ? parseFloat(step3.poids) : null,
          temperature: step3.temperature ? parseFloat(step3.temperature) : null,
          examenClinique: step3.examenClinique || null,
          examensComplementaires: step3.examensComplementaires || null,
          diagnostic: step4.diagnostic || null,
          diagnosticIA: step4.diagnosticIA || null,
          ordonnance: step5.ordonnance || null,
          notes: step5.notes || null,
          statut: "en_cours",
        } as any,
      });
      if (pendingPrescriptions.length > 0) {
        await authFetch("/api/ai/confirmer-dictee-ordonnance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultationId: consultation.id,
            patientId: parseInt(step1.patientId),
            veterinaire: step1.veterinaire,
            prescriptions: pendingPrescriptions,
          }),
        });
      }
      queryClient.invalidateQueries({ queryKey: getListConsultationsQueryKey() });
      toast({ title: "Consultation crÃ©Ã©e avec succÃ¨s" });
      navigate(`/consultations/${consultation.id}`);
    } catch {
      toast({ title: "Erreur lors de la crÃ©ation de la consultation", variant: "destructive" });
    }
  };

  const canNext = () => {
    if (etape === 1) return !!step1.patientId && !!step1.veterinaire && !!step1.date;
    if (etape === 2) return !!step2.anamnese.trim();
    if (etape === 3) return !!step3.examenClinique.trim();
    return true;
  };

  const isSubmitting = createConsultation.isPending || updateConsultation.isPending;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/consultations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nouvelle Consultation</h1>
          <p className="text-muted-foreground">Renseignez les informations Ã©tape par Ã©tape</p>
        </div>
      </div>

      {selectedPatient && (
        <PatientBarre patient={selectedPatient as any} />
      )}

      {/* Barre de progression */}
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          {ETAPES.map((e, idx) => (
            <div key={e.id} className="flex items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => etape > e.id && setEtape(e.id)}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold border-2 transition-all flex-shrink-0 ${
                  etape === e.id
                    ? "bg-primary border-primary text-primary-foreground"
                    : etape > e.id
                    ? "bg-primary/20 border-primary text-primary cursor-pointer hover:bg-primary/30"
                    : "bg-muted border-muted-foreground/30 text-muted-foreground cursor-default"
                }`}
              >
                {etape > e.id ? <CheckCircle className="h-4 w-4" /> : e.id}
              </button>
              {idx < ETAPES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 transition-all ${etape > e.id ? "bg-primary" : "bg-muted"}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          {ETAPES.map(e => (
            <span
              key={e.id}
              className={`text-center ${etape === e.id ? "text-primary font-medium" : ""}`}
              style={{ width: `${100 / ETAPES.length}%` }}
            >
              {e.label}
            </span>
          ))}
        </div>
      </div>

      {/* Ãtape 1 â Patient & Contexte */}
      {etape === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Patient &amp; Contexte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Patient *</Label>
              {/* Native select â Ã©vite le bug Radix Portal removeChild */}
              <select
                value={step1.patientId}
                onChange={e => setStep1(f => ({ ...f, patientId: e.target.value }))}
                className="mt-1 w-full border border-input bg-background px-3 py-2 text-sm rounded-md ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">SÃ©lectionner un patient...</option>
                {patients?.map(p => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nom} ({p.espece}) â {p.owner?.prenom} {p.owner?.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>VÃ©tÃ©rinaire *</Label>
                <Input
                  className="mt-1"
                  value={step1.veterinaire}
                  onChange={e => setStep1(f => ({ ...f, veterinaire: e.target.value }))}
                  placeholder="Dr. Martin"
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={step1.date}
                  onChange={e => setStep1(f => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Motif de consultation</Label>
              <Input
                className="mt-1"
                value={step1.motif}
                onChange={e => setStep1(f => ({ ...f, motif: e.target.value }))}
                placeholder="Ex: Vaccination annuelle, Boiterie, Abattement..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ãtape 2 â AnamnÃ¨se */}
      {etape === 2 && (
        <Step2Anamnese
          anamnese={step2.anamnese}
          setAnamnese={(v) => setStep2({ anamnese: v })}
        />
      )}

      {/* Ãtape 3 â Examen clinique */}
      {etape === 3 && (
        <Step3ExamenClinique
          step3={step3}
          setStep3={setStep3}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
        />
      )}

      {/* Ãtape 4 â Diagnostic IA */}
      {etape === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Diagnostic diffÃ©rentiel</CardTitle>
            <p className="text-sm text-muted-foreground">
              L'IA analyse les donnÃ©es cliniques pour proposer des hypothÃ¨ses diagnostiques
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button
              type="button"
              size="lg"
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleDiagnosticIA}
              disabled={isDiagnosticLoading}
            >
              {isDiagnosticLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyse en cours par Claude...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  GÃ©nÃ©rer le diagnostic diffÃ©rentiel avec l'IA
                </>
              )}
            </Button>

            {step4Result && (
              <div className="space-y-3">
                {step4Result.urgence && (
                  <div
                    className={`text-sm font-medium px-3 py-2 rounded-md border ${
                      step4Result.urgence === "Ã©levÃ©e"
                        ? "bg-red-50 border-red-200 text-red-700"
                        : step4Result.urgence === "modÃ©rÃ©e"
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-green-50 border-green-200 text-green-700"
                    }`}
                  >
                    Niveau d'urgence : {step4Result.urgence}
                  </div>
                )}
                <div className="space-y-2">
                  {step4Result.diagnostics.map((d, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-violet-50 border-violet-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-violet-900">{d.nom}</span>
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                          {d.probabilite}
                        </span>
                      </div>
                      <p className="text-sm text-violet-800">{d.description}</p>
                    </div>
                  ))}
                </div>
                {step4Result.recommandations && (
                  <div className="text-sm bg-muted/40 rounded-lg p-3 border">
                    <span className="font-medium">Recommandations :</span>{" "}
                    {step4Result.recommandations}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Diagnostic retenu par le vÃ©tÃ©rinaire</Label>
              <Textarea
                className="mt-1"
                rows={4}
                value={step4.diagnostic}
                onChange={e => setStep4(f => ({ ...f, diagnostic: e.target.value }))}
                placeholder="Diagnostic final retenu aprÃ¨s analyse des rÃ©sultats..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ãtape 5 â Ordonnance & RÃ©cap */}
      {etape === 5 && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Ordonnance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Prescription</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 text-primary border-primary/40 hover:bg-primary/5"
                    onClick={() => setDicteeOpen(true)}
                  >
                    <Mic className="h-4 w-4" />
                    Dicter l'ordonnance
                  </Button>
                </div>
                {pendingPrescriptions.length > 0 && (
                  <Alert className="mb-2 border-green-300 bg-green-50 text-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      {pendingPrescriptions.length} mÃ©dicament
                      {pendingPrescriptions.length > 1 ? "s" : ""} issu
                      {pendingPrescriptions.length > 1 ? "s" : ""} de la dictÃ©e â stock sera
                      dÃ©crÃ©mentÃ© Ã  la sauvegarde.
                    </AlertDescription>
                  </Alert>
                )}
                {step3.poids && parseFloat(step3.poids) > 0 && (
                  <Alert className="mt-2 border-amber-300 bg-amber-50 text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      Poids relevÃ© : <strong>{step3.poids} kg</strong> â Pensez Ã  adapter les
                      posologies par kg (ex : 0.1 mL/kg, 10 mg/kgâ¦)
                    </AlertDescription>
                  </Alert>
                )}
                <Textarea
                  className="mt-2 font-mono text-sm"
                  rows={8}
                  value={step5.ordonnance}
                  onChange={e => setStep5(f => ({ ...f, ordonnance: e.target.value }))}
                  placeholder={
                    "Amoxicilline 500mg : 1 cp matin et soir pendant 7 jours\nMeloxicam 1mg/mL : 0.1 mL/kg/j SID pendant 5 jours\n..."
                  }
                />
              </div>
              <div>
                <Label>Notes internes</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={step5.notes}
                  onChange={e => setStep5(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes pour l'Ã©quipe soignante, suivi recommandÃ©..."
                />
              </div>
            </CardContent>
          </Card>

          <ResumeClientBlock
            diagnostic={step4.diagnostic}
            ordonnance={step5.ordonnance}
            notes={step5.notes}
            espece={selectedPatient?.espece}
            nomAnimal={selectedPatient?.nom}
            nomProprietaire={
              selectedPatient?.owner
                ? `${selectedPatient.owner.prenom} ${selectedPatient.owner.nom}`
                : undefined
            }
          />

          <div className="bg-muted/40 border rounded-xl p-5 space-y-3 text-sm">
            <p className="font-semibold text-base">RÃ©capitulatif</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <span className="text-muted-foreground">Patient</span>
              <span className="font-medium">
                {selectedPatient ? `${selectedPatient.nom} (${selectedPatient.espece})` : "â"}
              </span>
              <span className="text-muted-foreground">PropriÃ©taire</span>
              <span>
                {selectedPatient?.owner
                  ? `${selectedPatient.owner.prenom} ${selectedPatient.owner.nom}`
                  : "â"}
              </span>
              <span className="text-muted-foreground">VÃ©tÃ©rinaire</span>
              <span>{step1.veterinaire || "â"}</span>
              <span className="text-muted-foreground">Date</span>
              <span>{formatDateFR(step1.date)}</span>
              {step1.motif && (
                <>
                  <span className="text-muted-foreground">Motif</span>
                  <span>{step1.motif}</span>
                </>
              )}
              {step3.poids && (
                <>
                  <span className="text-muted-foreground">Poids</span>
                  <span>{step3.poids} kg</span>
                </>
              )}
              {step3.temperature && (
                <>
                  <span className="text-muted-foreground">TempÃ©rature</span>
                  <span>{step3.temperature} Â°C</span>
                </>
              )}
              {step4.diagnostic && (
                <>
                  <span className="text-muted-foreground">Diagnostic</span>
                  <span className="line-clamp-2">{step4.diagnostic}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation PrÃ©cÃ©dent / Suivant */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setEtape(e => e - 1)}
          disabled={etape === 1}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          PrÃ©cÃ©dent
        </Button>
        {etape < 5 ? (
          <Button type="button" onClick={() => setEtape(e => e + 1)} disabled={!canNext()}>
            Suivant
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                CrÃ©ation...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                CrÃ©er la consultation
              </>
            )}
          </Button>
        )}
      </div>

      <DicteeOrdonnanceDialog
        open={dicteeOpen}
        onClose={() => setDicteeOpen(false)}
        onConfirmed={(prescriptions, texte) => {
          setPendingPrescriptions(prescriptions);
          setStep5(f => ({ ...f, ordonnance: texte }));
        }}
      />
    </div>
  );
}

function Step2Anamnese({
  anamnese,
  setAnamnese,
}: {
  anamnese: string;
  setAnamnese: (v: string) => void;
}) {
  const { toast } = useToast();

  const handleReformuler = async (transcript: string) => {
    const res = await authFetch("/api/ai/reformuler-anamnese", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) throw new Error("Erreur lors de la reformulation");
    const json = await res.json();
    setAnamnese((json.data ?? json).anamnese);
    toast({ title: "AnamnÃ¨se reformulÃ©e par Claude" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AnamnÃ¨se</CardTitle>
        <p className="text-sm text-muted-foreground">
          Histoire clinique rapportÃ©e par le propriÃ©taire
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <VoiceRecorder onAction={handleReformuler} actionLabel="Reformuler avec l'IA" />
        <div>
          <Label>AnamnÃ¨se (ou saisie manuelle)</Label>
          <Textarea
            className="mt-1"
            rows={10}
            value={anamnese}
            onChange={e => setAnamnese(e.target.value)}
            placeholder="DÃ©crivez l'histoire clinique : dÃ©but des symptÃ´mes, Ã©volution, contexte, traitements en cours, comportement alimentaire, hydratation, vaccination, environnement..."
          />
        </div>
      </CardContent>
    </Card>
  );
}

type UploadedFile = { name: string; objectPath: string; type: string; previewUrl?: string };

function Step3ExamenClinique({
  step3,
  setStep3,
  uploadedFiles,
  setUploadedFiles,
}: {
  step3: {
    poids: string;
    temperature: string;
    examenClinique: string;
    examensComplementaires: string;
  };
  setStep3: (fn: (prev: typeof step3) => typeof step3) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: (fn: (prev: UploadedFile[]) => UploadedFile[]) => void;
}) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleStructurer = async (transcript: string) => {
    const res = await authFetch("/api/ai/structurer-examen-clinique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) throw new Error("Erreur lors de la structuration");
    const json = await res.json();
    setStep3(f => ({ ...f, examenClinique: (json.data ?? json).examenClinique }));
    toast({ title: "Examen clinique structurÃ© par Claude" });
  };

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        const urlRes = await authFetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        if (!urlRes.ok) throw new Error("Impossible d'obtenir l'URL d'upload");
        const { uploadURL, objectPath } = await urlRes.json();
        await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        let previewUrl: string | undefined;
        if (file.type.startsWith("image/")) {
          previewUrl = URL.createObjectURL(file);
        }
        setUploadedFiles(prev => [
          ...prev,
          { name: file.name, objectPath, type: file.type, previewUrl },
        ]);
      }
      toast({ title: `${files.length} fichier(s) ajoutÃ©(s)` });
    } catch (err: any) {
      toast({ title: err?.message || "Erreur lors de l'upload", variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removeFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Examen clinique</CardTitle>
          <p className="text-sm text-muted-foreground">
            Constantes vitales et observations par systÃ¨mes
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Poids (kg)</Label>
              <Input
                className="mt-1"
                type="number"
                step="0.1"
                value={step3.poids}
                onChange={e => setStep3(f => ({ ...f, poids: e.target.value }))}
                placeholder="Ex: 28.5"
              />
            </div>
            <div>
              <Label>TempÃ©rature (Â°C)</Label>
              <Input
                className="mt-1"
                type="number"
                step="0.1"
                value={step3.temperature}
                onChange={e => setStep3(f => ({ ...f, temperature: e.target.value }))}
                placeholder="Ex: 38.5"
              />
            </div>
          </div>
          <VoiceRecorder onAction={handleStructurer} actionLabel="Structurer avec l'IA" />
          <div>
            <Label>Examen clinique *</Label>
            <Textarea
              className="mt-1"
              rows={7}
              value={step3.examenClinique}
              onChange={e => setStep3(f => ({ ...f, examenClinique: e.target.value }))}
              placeholder="Ãtat gÃ©nÃ©ral, muqueuses, frÃ©quence cardiaque, respiratoire, auscultation, palpation abdominale, examen locomoteur, ganglions, peau et phanÃ¨res..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Examens complÃ©mentaires</CardTitle>
          <p className="text-sm text-muted-foreground">RÃ©sultats biologiques, imagerie, analyses</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>RÃ©sultats (texte)</Label>
            <Textarea
              className="mt-1"
              rows={4}
              value={step3.examensComplementaires}
              onChange={e =>
                setStep3(f => ({ ...f, examensComplementaires: e.target.value }))
              }
              placeholder="NFS, biochimie, urines, rÃ©sultats d'imagerie... (laisser vide si aucun)"
            />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Ajouter bilans sanguins, Ã©cho, radio
            </Label>
            <div className="mt-2">
              <label
                className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${
                  isUploading
                    ? "border-violet-400 bg-violet-50"
                    : "border-border hover:border-violet-300 hover:bg-violet-50/30"
                }`}
              >
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  multiple
                  className="hidden"
                  onChange={handleFilesChange}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-violet-600 mb-2" />
                    <span className="text-sm text-violet-600">Upload en cours...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium">Cliquer pour ajouter des fichiers</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      JPG, PNG, PDF acceptÃ©s â max 10 Mo par fichier
                    </span>
                  </>
                )}
              </label>
            </div>
            {uploadedFiles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {uploadedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="relative group border rounded-lg p-2 flex items-center gap-2 bg-muted/30 max-w-[200px]"
                  >
                    {file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center bg-red-50 rounded border">
                        <FileText className="h-5 w-5 text-red-500" />
                      </div>
                    )}
                    <span className="text-xs truncate flex-1" title={file.name}>
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-muted-foreground hover:text-destructive ml-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResumeClientBlock({
  diagnostic,
  ordonnance,
  notes,
  espece,
  nomAnimal,
  nomProprietaire,
}: {
  diagnostic?: string;
  ordonnance?: string;
  notes?: string;
  espece?: string;
  nomAnimal?: string;
  nomProprietaire?: string;
}) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [resume, setResume] = useState("");

  const handleGenerer = async () => {
    if (!diagnostic && !ordonnance) {
      toast({ title: "Veuillez saisir un diagnostic ou une ordonnance", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const res = await authFetch("/api/ai/resume-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnostic,
          ordonnance,
          notes,
          espece,
          nomAnimal,
          nomProprietaire,
        }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setResume((json.data ?? json).resume);
    } catch {
      toast({ title: "Erreur lors de la gÃ©nÃ©ration du rÃ©sumÃ©", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImprimer = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<!DOCTYPE html><html><head><title>RÃ©sumÃ© consultation â ${nomAnimal ?? "Patient"}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;line-height:1.7;color:#222}h1{font-size:22px;margin-bottom:4px}p{white-space:pre-wrap}@media print{button{display:none}}</style></head><body><h1>RÃ©sumÃ© de consultation</h1>${
        nomAnimal
          ? `<p><strong>Patient :</strong> ${nomAnimal}${espece ? ` (${espece})` : ""}</p>`
          : ""
      }${
        nomProprietaire
          ? `<p><strong>PropriÃ©taire :</strong> ${nomProprietaire}</p>`
          : ""
      }<hr style="margin:16px 0"><p>${resume.replace(
        /\n/g,
        "<br>"
      )}</p><hr style="margin:16px 0"><button onclick="window.print()">Imprimer</button></body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>RÃ©sumÃ© client</CardTitle>
        <p className="text-sm text-muted-foreground">
          Texte vulgarisÃ© Ã  remettre au propriÃ©taire
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          onClick={handleGenerer}
          disabled={isGenerating}
          variant="outline"
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              GÃ©nÃ©ration en cours...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              GÃ©nÃ©rer le rÃ©sumÃ© client
            </>
          )}
        </Button>
        {resume && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">{resume}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleImprimer}
              className="w-full"
            >
              <FileText className="mr-2 h-4 w-4" />
              Imprimer / Envoyer par email
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
