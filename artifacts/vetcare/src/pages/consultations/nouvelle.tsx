import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import {
  useCreateConsultation,
  useUpdateConsultation,
  useListPatients,
  useGetDiagnosticIA,
  getListConsultationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle, Loader2 } from "lucide-react";

const ETAPES = [
  { id: 1, label: "Patient & Contexte" },
  { id: 2, label: "Anamnèse" },
  { id: 3, label: "Examen clinique" },
  { id: 4, label: "Diagnostic IA" },
  { id: 5, label: "Ordonnance & Récap" },
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
  const getDiagnosticIA = useGetDiagnosticIA();
  const { data: patients } = useListPatients();

  const preSelectedPatientId = new URLSearchParams(search).get("patientId") ?? "";

  const [etape, setEtape] = useState(1);

  const [step1, setStep1] = useState({
    patientId: preSelectedPatientId,
    veterinaire: "",
    date: new Date().toISOString().split("T")[0],
    motif: "",
  });
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

  useEffect(() => {
    if (user && !step1.veterinaire) {
      setStep1(f => ({ ...f, veterinaire: user.fullName || user.firstName || "" }));
    }
  }, [user]);

  const selectedPatient = patients?.find(p => String(p.id) === step1.patientId);

  const handleDiagnosticIA = async () => {
    if (!selectedPatient) {
      toast({ title: "Aucun patient sélectionné", variant: "destructive" });
      return;
    }
    try {
      const res = await getDiagnosticIA.mutateAsync({
        data: {
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
        },
      });
      setStep4Result({
        diagnostics: res.diagnostics as DiagnosticItem[],
        urgence: res.urgence,
        recommandations: res.recommandations,
      });
      setStep4(f => ({ ...f, diagnosticIA: res.texteComplet }));
    } catch {
      toast({ title: "Erreur lors de la génération du diagnostic IA", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!step1.patientId) {
      toast({ title: "Veuillez sélectionner un patient", variant: "destructive" });
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

      queryClient.invalidateQueries({ queryKey: getListConsultationsQueryKey() });
      toast({ title: "Consultation créée avec succès" });
      navigate(`/consultations/${consultation.id}`);
    } catch {
      toast({ title: "Erreur lors de la création de la consultation", variant: "destructive" });
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
          <p className="text-muted-foreground">Renseignez les informations étape par étape</p>
        </div>
      </div>

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
                <div className={`h-0.5 flex-1 transition-all ${etape > e.id ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          {ETAPES.map(e => (
            <span key={e.id} className={`text-center ${etape === e.id ? "text-primary font-medium" : ""}`}
              style={{ width: `${100 / ETAPES.length}%` }}>
              {e.label}
            </span>
          ))}
        </div>
      </div>

      {/* Étape 1 — Patient & Contexte */}
      {etape === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Patient &amp; Contexte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Patient *</Label>
              <Select value={step1.patientId} onValueChange={v => setStep1(f => ({ ...f, patientId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner un patient..." />
                </SelectTrigger>
                <SelectContent>
                  {patients?.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nom} ({p.espece}) — {p.owner?.prenom} {p.owner?.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vétérinaire *</Label>
                <Input className="mt-1" value={step1.veterinaire}
                  onChange={e => setStep1(f => ({ ...f, veterinaire: e.target.value }))}
                  placeholder="Dr. Martin" />
              </div>
              <div>
                <Label>Date *</Label>
                <Input className="mt-1" type="date" value={step1.date}
                  onChange={e => setStep1(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Motif de consultation</Label>
              <Input className="mt-1" value={step1.motif}
                onChange={e => setStep1(f => ({ ...f, motif: e.target.value }))}
                placeholder="Ex: Vaccination annuelle, Boiterie, Abattement..." />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Étape 2 — Anamnèse */}
      {etape === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Anamnèse</CardTitle>
            <p className="text-sm text-muted-foreground">
              Histoire clinique rapportée par le propriétaire
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={12}
              value={step2.anamnese}
              onChange={e => setStep2({ anamnese: e.target.value })}
              placeholder="Décrivez l'histoire clinique : début des symptômes, évolution, contexte, traitements en cours, comportement alimentaire, hydratation, vaccination, environnement..."
            />
          </CardContent>
        </Card>
      )}

      {/* Étape 3 — Examen clinique */}
      {etape === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Examen clinique</CardTitle>
            <p className="text-sm text-muted-foreground">Constantes vitales et observations par systèmes</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Poids (kg)</Label>
                <Input className="mt-1" type="number" step="0.1" value={step3.poids}
                  onChange={e => setStep3(f => ({ ...f, poids: e.target.value }))}
                  placeholder="Ex: 28.5" />
              </div>
              <div>
                <Label>Température (°C)</Label>
                <Input className="mt-1" type="number" step="0.1" value={step3.temperature}
                  onChange={e => setStep3(f => ({ ...f, temperature: e.target.value }))}
                  placeholder="Ex: 38.5" />
              </div>
            </div>
            <div>
              <Label>Examen clinique *</Label>
              <Textarea className="mt-1" rows={7} value={step3.examenClinique}
                onChange={e => setStep3(f => ({ ...f, examenClinique: e.target.value }))}
                placeholder="État général, muqueuses, fréquence cardiaque, respiratoire, auscultation, palpation abdominale, examen locomoteur, ganglions, peau et phanères..." />
            </div>
            <div>
              <Label>Examens complémentaires</Label>
              <Textarea className="mt-1" rows={4} value={step3.examensComplementaires}
                onChange={e => setStep3(f => ({ ...f, examensComplementaires: e.target.value }))}
                placeholder="NFS, biochimie, urines, résultats d'imagerie... (laisser vide si aucun)" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Étape 4 — Diagnostic IA */}
      {etape === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Diagnostic différentiel</CardTitle>
            <p className="text-sm text-muted-foreground">
              L'IA analyse les données cliniques pour proposer des hypothèses diagnostiques
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button
              type="button"
              size="lg"
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleDiagnosticIA}
              disabled={getDiagnosticIA.isPending}
            >
              {getDiagnosticIA.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyse en cours par Claude...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Générer le diagnostic différentiel avec l'IA
                </>
              )}
            </Button>

            {step4Result && (
              <div className="space-y-3">
                {step4Result.urgence && (
                  <div className={`text-sm font-medium px-3 py-2 rounded-md border ${
                    step4Result.urgence === "élevée"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : step4Result.urgence === "modérée"
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-green-50 border-green-200 text-green-700"
                  }`}>
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
              <Label>Diagnostic retenu par le vétérinaire</Label>
              <Textarea
                className="mt-1"
                rows={4}
                value={step4.diagnostic}
                onChange={e => setStep4(f => ({ ...f, diagnostic: e.target.value }))}
                placeholder="Diagnostic final retenu après analyse des résultats..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Étape 5 — Ordonnance & Récap */}
      {etape === 5 && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Ordonnance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Prescription</Label>
                <Textarea
                  className="mt-1 font-mono text-sm"
                  rows={8}
                  value={step5.ordonnance}
                  onChange={e => setStep5(f => ({ ...f, ordonnance: e.target.value }))}
                  placeholder="Amoxicilline 500mg : 1 cp matin et soir pendant 7 jours&#10;Meloxicam 1mg/mL : 0.1 mL/kg/j SID pendant 5 jours&#10;..."
                />
              </div>
              <div>
                <Label>Notes internes</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={step5.notes}
                  onChange={e => setStep5(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes pour l'équipe soignante, suivi recommandé..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="bg-muted/40 border rounded-xl p-5 space-y-3 text-sm">
            <p className="font-semibold text-base">Récapitulatif</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <span className="text-muted-foreground">Patient</span>
              <span className="font-medium">
                {selectedPatient
                  ? `${selectedPatient.nom} (${selectedPatient.espece})`
                  : "—"}
              </span>
              <span className="text-muted-foreground">Propriétaire</span>
              <span>
                {selectedPatient?.owner
                  ? `${selectedPatient.owner.prenom} ${selectedPatient.owner.nom}`
                  : "—"}
              </span>
              <span className="text-muted-foreground">Vétérinaire</span>
              <span>{step1.veterinaire || "—"}</span>
              <span className="text-muted-foreground">Date</span>
              <span>{step1.date}</span>
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
                  <span className="text-muted-foreground">Température</span>
                  <span>{step3.temperature} °C</span>
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

      {/* Navigation Précédent / Suivant */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setEtape(e => e - 1)}
          disabled={etape === 1}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Précédent
        </Button>

        {etape < 5 ? (
          <Button
            type="button"
            onClick={() => setEtape(e => e + 1)}
            disabled={!canNext()}
          >
            Suivant
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Créer la consultation
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
