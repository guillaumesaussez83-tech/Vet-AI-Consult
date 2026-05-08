import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Award, Loader2, Printer, CheckCircle, FileText, Heart, Shield, ClipboardList, Pill } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Skeleton } from "@/components/ui/skeleton";
import { useListPatients } from "@workspace/api-client-react";

import { unwrapResponse as __unwrapEnvelope } from "../../lib/queryClient";

const API_BASE = "/api";

type TypeCertificat = {
  id: string; label: string; description: string; icon: React.ComponentType<{ className?: string }>;
  color: string;
};

const TYPES: TypeCertificat[] = [
  { id: "bonne_sante", label: "Bonne santé", description: "Pour voyage UE, importation ou exposition. Atteste le bon état de santé de l'animal.", icon: Heart, color: "bg-green-50 border-green-200 text-green-700" },
  { id: "cession", label: "Cession / Vente", description: "Pour la vente ou cession d'un animal. Confirme l'état de santé et les vaccinations.", icon: Shield, color: "bg-blue-50 border-blue-200 text-blue-700" },
  { id: "aptitude", label: "Aptitude", description: "Pour concours, reproduction ou élevage. Examen approfondi de tous les systèmes.", icon: CheckCircle, color: "bg-purple-50 border-purple-200 text-purple-700" },
  { id: "soins", label: "Attestation de soins", description: "Pour remboursement assurance. Détaille les actes réalisés et le diagnostic.", icon: ClipboardList, color: "bg-orange-50 border-orange-200 text-orange-700" },
  { id: "ordonnance", label: "Ordonnance vétérinaire", description: "Ordonnance vétérinaire sécurisée avec posologie et mentions légales.", icon: Pill, color: "bg-red-50 border-red-200 text-red-700" },
];

export default function CertificatsPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const [selectedType, setSelectedType] = useState<TypeCertificat | null>(null);
  const [patientId, setPatientId] = useState("");
  const [veterinaire, setVeterinaire] = useState("");
  const [clinique, setClinique] = useState("");
  const [generating, setGenerating] = useState(false);
  const [certificatText, setCertificatText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: patients = [], isLoading: patientsLoading } = useListPatients();

  const { data: parametresClinique } = useQuery({
    queryKey: ["parametres-clinique"],
    queryFn: () => fetch(`${API_BASE}/parametres-clinique`).then(__unwrapEnvelope),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (user && !veterinaire) {
      const nom = user.fullName ?? [user.firstName, user.lastName].filter(Boolean).join(" ");
      if (nom) setVeterinaire(`Dr. ${nom}`);
    }
  }, [user]);

  useEffect(() => {
    if (parametresClinique?.nomClinique && !clinique) {
      setClinique(parametresClinique.nomClinique);
    }
  }, [parametresClinique]);

  const selectedPatient = patients.find(p => p.id.toString() === patientId);

  const { data: vaccinations = [] } = useQuery({
    queryKey: ["vaccinations", patientId],
    queryFn: () => fetch(`${API_BASE}/vaccinations/patient/${patientId}`).then(__unwrapEnvelope),
    enabled: !!patientId,
  });

  const { data: consultations = [] } = useQuery({
    queryKey: ["consultations-patient", patientId],
    queryFn: () => fetch(`${API_BASE}/consultations?patientId=${patientId}`).then(__unwrapEnvelope),
    enabled: !!patientId,
  });

  const generer = async () => {
    if (!selectedType || !selectedPatient) return;
    setGenerating(true);
    try {
      const cliniqueInfo = {
        nom: clinique || parametresClinique?.nomClinique || "",
        adresse: parametresClinique?.adresse || "",
        codePostal: parametresClinique?.codePostal || "",
        ville: parametresClinique?.ville || "",
        telephone: parametresClinique?.telephone || "",
        email: parametresClinique?.email || "",
        numeroOrdre: parametresClinique?.numeroOrdre || "",
        siret: parametresClinique?.siret || "",
      };
      const r = await fetch(`${API_BASE}/ai/certificat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType.id,
          patient: selectedPatient,
          vaccinations,
          consultations: Array.isArray(consultations) ? consultations : (consultations as any)?.consultations ?? [],
          veterinaire,
          clinique,
          cliniqueInfo,
        }),
      });
      const data = await r.json();
      setCertificatText(data?.data?.certificat ?? data?.certificat ?? "Erreur de génération");
      setPreviewOpen(true);
    } catch {
      toast({ title: "Erreur lors de la génération", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const imprimer = () => window.print();

  if (patientsLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Award className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Certificats vétérinaires</h1>
          <p className="text-sm text-muted-foreground">Générez vos certificats et ordonnances grâce à l'IA</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-base font-semibold">1. Choisissez le type de document</h2>
          <div className="space-y-3">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const isSelected = selectedType?.id === t.id;
              return (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                  onClick={() => setSelectedType(t)}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${t.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{t.label}</p>
                        {isSelected && <Badge className="text-xs">Sélectionné</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-semibold">2. Informations</h2>
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1">
                <Label>Patient *</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un patient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.nom} — {p.espece} {p.race ? `(${p.race})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPatient && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                  <p><strong>Animal :</strong> {selectedPatient.nom}</p>
                  <p><strong>Espèce :</strong> {selectedPatient.espece} {selectedPatient.race ? `— ${selectedPatient.race}` : ""}</p>
                  {(vaccinations as any[]).length > 0 && <p><strong>Vaccinations :</strong> {(vaccinations as any[]).length} enregistrée(s)</p>}
                </div>
              )}

              <div className="space-y-1">
                <Label>Vétérinaire signataire</Label>
                <Input value={veterinaire} onChange={e => setVeterinaire(e.target.value)} placeholder="Dr. Dupont" />
              </div>

              <div className="space-y-1">
                <Label>Nom de la clinique</Label>
                <Input value={clinique} onChange={e => setClinique(e.target.value)} placeholder="Clinique Vétérinaire du Centre" />
              </div>

              <Button
                className="w-full"
                disabled={!selectedType || !patientId || generating}
                onClick={generer}
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Génération en cours...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-2" />Générer le certificat</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {selectedType?.label} — {selectedPatient?.nom}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="print:block">
              <div className="text-sm leading-relaxed bg-white p-6 border rounded-lg min-h-[400px] prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-li:my-0.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{certificatText}</ReactMarkdown>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fermer</Button>
            <Button variant="outline" onClick={imprimer}><Printer className="h-4 w-4 mr-2" />Imprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
