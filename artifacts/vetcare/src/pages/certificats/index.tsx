import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Award, Loader2, Printer, CheckCircle, FileText, Heart, Shield, ClipboardList, Pill } from "lucide-react";
import { useListPatients } from "@workspace/api-client-react";

const API_BASE = "/api";

type TypeCertificat = {
  id: string; label: string; description: string; icon: React.ComponentType<{ className?: string }>;
  color: string;
};

const TYPES: TypeCertificat[] = [
  { id: "bonne_sante", label: "Bonne sante", description: "Pour voyage UE, importation ou exposition. Atteste le bon etat de sante de l'animal.", icon: Heart, color: "bg-green-50 border-green-200 text-green-700" },
  { id: "cession", label: "Cession / Vente", description: "Pour la vente ou cession d'un animal. Confirme l'etat de sante et les vaccinations.", icon: Shield, color: "bg-blue-50 border-blue-200 text-blue-700" },
  { id: "aptitude", label: "Aptitude", description: "Pour concours, reproduction ou elevage. Examen approfondi de tous les systemes.", icon: CheckCircle, color: "bg-purple-50 border-purple-200 text-purple-700" },
  { id: "soins", label: "Attestation de soins", description: "Pour remboursement assurance. Detaille les actes realises et le diagnostic.", icon: ClipboardList, color: "bg-orange-50 border-orange-200 text-orange-700" },
  { id: "ordonnance", label: "Ordonnance", description: "Ordonnance veterinaire securisee avec posologie et mentions legales.", icon: Pill, color: "bg-red-50 border-red-200 text-red-700" },
];

export default function CertificatsPage() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<TypeCertificat | null>(null);
  const [patientId, setPatientId] = useState("");
  const [veterinaire, setVeterinaire] = useState("");
  const [clinique, setClinique] = useState("");
  const [generating, setGenerating] = useState(false);
  const [certificatText, setCertificatText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: patientsData } = useListPatients({ limit: 200 });
  const patients = patientsData?.patients ?? [];

  const selectedPatient = patients.find(p => p.id.toString() === patientId);

  const { data: vaccinations = [] } = useQuery({
    queryKey: ["vaccinations", patientId],
    queryFn: () => fetch(`${API_BASE}/vaccinations/patient/${patientId}`).then(r => r.json()),
    enabled: !!patientId,
  });

  const { data: consultations = [] } = useQuery({
    queryKey: ["consultations-patient", patientId],
    queryFn: () => fetch(`${API_BASE}/consultations?patientId=${patientId}`).then(r => r.json()),
    enabled: !!patientId,
  });

  const generer = async () => {
    if (!selectedType || !selectedPatient) return;
    setGenerating(true);
    try {
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
        }),
      });
      const data = await r.json();
      setCertificatText(data.certificat ?? "Erreur de generation");
      setPreviewOpen(true);
    } catch {
      toast({ title: "Erreur lors de la generation", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const imprimer = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Award className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Certificats veterinaires</h1>
          <p className="text-sm text-muted-foreground">Generez vos certificats et ordonnances grace a l'IA</p>
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
                        {isSelected && <Badge className="text-xs">Selectionne</Badge>}
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
                    <SelectValue placeholder="Selectionner un patient..." />
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
                  <p><strong>Espece :</strong> {selectedPatient.espece} {selectedPatient.race ? `— ${selectedPatient.race}` : ""}</p>
                  {(vaccinations as any[]).length > 0 && <p><strong>Vaccinations :</strong> {(vaccinations as any[]).length} enregistree(s)</p>}
                </div>
              )}

              <div className="space-y-1">
                <Label>Veterinaire signataire</Label>
                <Input value={veterinaire} onChange={e => setVeterinaire(e.target.value)} placeholder="Dupont" />
              </div>

              <div className="space-y-1">
                <Label>Nom de la clinique</Label>
                <Input value={clinique} onChange={e => setClinique(e.target.value)} placeholder="Clinique Veterinaire du Centre" />
              </div>

              <Button
                className="w-full"
                disabled={!selectedType || !patientId || generating}
                onClick={generer}
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generation en cours...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-2" />Generer le certificat</>
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
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed bg-white p-6 border rounded-lg min-h-[400px]">{certificatText}</pre>
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
