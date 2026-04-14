import { useState, useCallback } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetConsultation, useUpdateConsultation, useGetDiagnosticIA,
  useGenerateOrdonnance, useGenerateFacture, useListActes,
  getGetConsultationQueryKey, getListFacturesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Brain, FileText, Sparkles, Check, ChevronRight, Plus, Trash2, Receipt } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ETAPES = [
  { id: 1, label: "Anamnèse", icon: "📋" },
  { id: 2, label: "Examen clinique", icon: "🩺" },
  { id: 3, label: "Examens compl.", icon: "🔬" },
  { id: 4, label: "Diagnostic IA", icon: "🧠" },
  { id: 5, label: "Ordonnance & Actes", icon: "💊" },
];

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

  const [etapeActive, setEtapeActive] = useState(1);
  const [iaSaving, setIaSaving] = useState(false);

  const { data: consultation, isLoading } = useGetConsultation(id, {
    query: { enabled: !!id, queryKey: getGetConsultationQueryKey(id) }
  });
  const { data: actesList } = useListActes();

  const updateConsultation = useUpdateConsultation();
  const getDiagnosticIA = useGetDiagnosticIA();
  const generateOrdonnance = useGenerateOrdonnance();
  const generateFacture = useGenerateFacture();

  const [actes, setActes] = useState<ActeLine[]>([]);
  const [actesInit, setActesInit] = useState(false);

  if (consultation && !actesInit) {
    setActesInit(true);
    setActes(consultation.actes?.map(a => ({
      acteId: a.acteId,
      quantite: a.quantite,
      prixUnitaire: a.prixUnitaire,
      description: a.description ?? "",
    })) ?? []);
  }

  const handleSaveStep = useCallback(async (data: Record<string, unknown>) => {
    try {
      await updateConsultation.mutateAsync({ id, data: data as any });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
      toast({ title: "Sauvegardé" });
    } catch {
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" });
    }
  }, [id, updateConsultation, queryClient, toast]);

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
      await generateFacture.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListFacturesQueryKey() });
      toast({ title: "Facture générée" });
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
      } as any
    });
    queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
  };

  const addActe = () => {
    const firstActe = actesList?.[0];
    if (firstActe) {
      setActes(prev => [...prev, {
        acteId: firstActe.id,
        quantite: 1,
        prixUnitaire: firstActe.prixDefaut,
        description: "",
      }]);
    }
  };

  const removeActe = (idx: number) => setActes(prev => prev.filter((_, i) => i !== idx));

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
          <h1 className="text-2xl font-bold tracking-tight">
            Consultation — {patient?.nom ?? "Patient"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Dr. {consultation.veterinaire} • {consultation.date}
            {patient?.owner && ` • ${patient.owner.prenom} ${patient.owner.nom}`}
          </p>
        </div>
        <Badge variant={consultation.statut === "terminee" ? "outline" : consultation.statut === "en_cours" ? "default" : "secondary"}>
          {consultation.statut === "en_attente" ? "En attente" : consultation.statut === "en_cours" ? "En cours" : "Terminée"}
        </Badge>
      </div>

      {/* Navigation étapes */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {ETAPES.map((etape, idx) => (
          <div key={etape.id} className="flex items-center gap-2">
            <button
              onClick={() => setEtapeActive(etape.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                etapeActive === etape.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span>{etape.label}</span>
              {etapeActive > etape.id && <Check className="h-3 w-3" />}
            </button>
            {idx < ETAPES.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Étape 1 — Anamnèse */}
      {etapeActive === 1 && (
        <EtapeAnamnese
          consultation={consultation}
          onSave={handleSaveStep}
          onNext={() => setEtapeActive(2)}
        />
      )}

      {/* Étape 2 — Examen clinique */}
      {etapeActive === 2 && (
        <EtapeExamenClinique
          consultation={consultation}
          onSave={handleSaveStep}
          onNext={() => setEtapeActive(3)}
        />
      )}

      {/* Étape 3 — Examens complémentaires */}
      {etapeActive === 3 && (
        <EtapeExamensCompl
          consultation={consultation}
          onSave={handleSaveStep}
          onNext={() => setEtapeActive(4)}
        />
      )}

      {/* Étape 4 — Diagnostic IA */}
      {etapeActive === 4 && (
        <EtapeDiagnosticIA
          consultation={consultation}
          onSave={handleSaveStep}
          onGenerateIA={handleDiagnosticIA}
          isGenerating={iaSaving || getDiagnosticIA.isPending}
          onNext={() => setEtapeActive(5)}
        />
      )}

      {/* Étape 5 — Ordonnance & Actes */}
      {etapeActive === 5 && (
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
          totalHT={totalHT}
          totalTTC={totalTTC}
          isGeneratingOrdonnance={generateOrdonnance.isPending}
          isGeneratingFacture={generateFacture.isPending}
        />
      )}
    </div>
  );
}

function EtapeAnamnese({ consultation, onSave, onNext }: any) {
  const [anamnese, setAnamnese] = useState(consultation.anamnese ?? "");
  const [motif, setMotif] = useState(consultation.motif ?? "");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Étape 1 — Anamnèse</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Motif de consultation et historique rapporté par le propriétaire</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Motif de consultation</Label>
          <Input className="mt-1" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Boiterie membre antérieur droit depuis 3 jours..." />
        </div>
        <div>
          <Label>Anamnèse (dictée ou saisie)</Label>
          <Textarea className="mt-1" rows={8} value={anamnese} onChange={e => setAnamnese(e.target.value)}
            placeholder="Décrivez l'histoire clinique du patient : début des symptômes, évolution, contexte, traitements en cours, comportement alimentaire, hydratation, etc." />
        </div>
        <div className="flex gap-3">
          <Button onClick={() => onSave({ motif, anamnese, statut: "en_cours" })}>
            Sauvegarder
          </Button>
          <Button variant="outline" onClick={onNext}>
            Étape suivante <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EtapeExamenClinique({ consultation, onSave, onNext }: any) {
  const [examenClinique, setExamenClinique] = useState(consultation.examenClinique ?? "");
  const [poids, setPoids] = useState(consultation.poids?.toString() ?? "");
  const [temperature, setTemperature] = useState(consultation.temperature?.toString() ?? "");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 2 — Examen clinique</CardTitle>
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
          <Label>Examen clinique (dictée ou saisie)</Label>
          <Textarea className="mt-1" rows={10} value={examenClinique} onChange={e => setExamenClinique(e.target.value)}
            placeholder="État général, muqueuses, fréquence cardiaque, respiratoire, palpation abdominale, auscultation cardiopulmonaire, examen locomoteur, ganglions, peau et phanères..." />
        </div>
        <div className="flex gap-3">
          <Button onClick={() => onSave({
            examenClinique,
            poids: poids ? parseFloat(poids) : null,
            temperature: temperature ? parseFloat(temperature) : null,
          })}>Sauvegarder</Button>
          <Button variant="outline" onClick={onNext}>
            Étape suivante <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EtapeExamensCompl({ consultation, onSave, onNext }: any) {
  const [examens, setExamens] = useState(consultation.examensComplementaires ?? "");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 3 — Examens complémentaires</CardTitle>
        <p className="text-sm text-muted-foreground">Résultats biologiques, imagerie et autres examens</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Résultats des examens complémentaires</Label>
          <Textarea className="mt-1" rows={10} value={examens} onChange={e => setExamens(e.target.value)}
            placeholder="NFS, biochimie, urines, résultats radiographiques, échographiques, etc. Laissez vide si aucun examen complémentaire." />
        </div>
        <div className="flex gap-3">
          <Button onClick={() => onSave({ examensComplementaires: examens })}>Sauvegarder</Button>
          <Button variant="outline" onClick={onNext}>
            Analyser avec l'IA <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EtapeDiagnosticIA({ consultation, onSave, onGenerateIA, isGenerating, onNext }: any) {
  const [diagnostic, setDiagnostic] = useState(consultation.diagnostic ?? "");
  const [diagnosticIA] = useState(consultation.diagnosticIA ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Étape 4 — Diagnostic différentiel IA
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
            <pre className="whitespace-pre-wrap text-sm font-sans">{consultation.diagnosticIA}</pre>
          </div>
        )}

        <div>
          <Label>Diagnostic retenu (à compléter par le vétérinaire)</Label>
          <Textarea className="mt-1" rows={4} value={diagnostic} onChange={e => setDiagnostic(e.target.value)}
            placeholder="Diagnostic final retenu après analyse..." />
        </div>
        <div className="flex gap-3">
          <Button onClick={() => onSave({ diagnostic })}>Sauvegarder le diagnostic</Button>
          <Button variant="outline" onClick={onNext}>
            Ordonnance & Actes <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EtapeOrdonnanceActes({
  consultation, actes, actesList, onActesChange, onAddActe, onRemoveActe,
  onSaveActes, onGenerateOrdonnance, onGenerateFacture, totalHT, totalTTC,
  isGeneratingOrdonnance, isGeneratingFacture
}: any) {
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Étape 5 — Actes réalisés</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Saisissez les actes et médicaments de cette consultation</p>
            </div>
            <Button onClick={onAddActe} variant="outline" size="sm">
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
                  <Label className="text-xs">Acte</Label>
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
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ordonnance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {consultation.ordonnance ? (
            <div className="bg-muted/30 border rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm font-sans">{consultation.ordonnance}</pre>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Aucune ordonnance générée</p>
          )}
          <Button onClick={onGenerateOrdonnance} disabled={isGeneratingOrdonnance} className="w-full">
            <Sparkles className="mr-2 h-4 w-4" />
            {isGeneratingOrdonnance ? "Génération en cours..." : "Générer l'ordonnance avec Claude"}
          </Button>
        </CardContent>
      </Card>

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
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-green-700">{consultation.facture.numero}</div>
                  <div className="text-sm text-green-600">Montant TTC : {consultation.facture.montantTTC?.toFixed(2)} €</div>
                </div>
                <Link href={`/factures/${consultation.facture.id}`}>
                  <Button variant="outline" size="sm">Voir la facture</Button>
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Aucune facture générée</p>
          )}
          {!consultation.facture && (
            <Button onClick={onGenerateFacture} disabled={isGeneratingFacture} variant="outline" className="w-full">
              <Receipt className="mr-2 h-4 w-4" />
              {isGeneratingFacture ? "Génération en cours..." : "Générer la facture automatiquement"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
