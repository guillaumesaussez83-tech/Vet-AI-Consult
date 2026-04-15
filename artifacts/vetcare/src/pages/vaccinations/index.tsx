import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Syringe, AlertTriangle, Clock, CheckCircle, FileText, Loader2 } from "lucide-react";

const API_BASE = "/api";

type Vaccination = {
  id: number; patientId: number; nomVaccin: string; dateInjection: string;
  dateRappel?: string; lotNumero?: string; fabricant?: string; voieInjection?: string;
  veterinaire?: string; notes?: string;
};

type Patient = { id: number; nom: string; espece: string; race?: string; dateNaissance?: string; ownerId: number };
type Owner = { id: number; nom: string; prenom?: string; email?: string };

const EMPTY_FORM = {
  nomVaccin: "", dateInjection: new Date().toISOString().split("T")[0], dateRappel: "",
  lotNumero: "", fabricant: "", voieInjection: "SC", veterinaire: "", notes: "",
};

function getRappelStatut(dateRappel?: string): "retard" | "bientot" | "ok" | "none" {
  if (!dateRappel) return "none";
  const today = new Date();
  const rappel = new Date(dateRappel);
  const diffJours = (rappel.getTime() - today.getTime()) / 86400000;
  if (diffJours < 0) return "retard";
  if (diffJours <= 30) return "bientot";
  return "ok";
}

export default function VaccinationsPage() {
  const { id } = useParams<{ id: string }>();
  const patientId = parseInt(id ?? "0");
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [carnetText, setCarnetText] = useState("");
  const [generatingCarnet, setGeneratingCarnet] = useState(false);
  const [carnetOpen, setCarnetOpen] = useState(false);

  const { data: patient } = useQuery<Patient>({
    queryKey: ["patient", patientId],
    queryFn: () => fetch(`${API_BASE}/patients/${patientId}`).then(r => r.json()),
    enabled: !!patientId,
  });

  const { data: vaccinations = [], isLoading } = useQuery<Vaccination[]>({
    queryKey: ["vaccinations", patientId],
    queryFn: () => fetch(`${API_BASE}/vaccinations/patient/${patientId}`).then(r => r.json()),
    enabled: !!patientId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/vaccinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, patientId }),
      });
      if (!r.ok) throw new Error("Erreur");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vaccinations", patientId] }); toast({ title: "Vaccination enregistree" }); setDialogOpen(false); setForm({ ...EMPTY_FORM }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/vaccinations/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vaccinations", patientId] }); toast({ title: "Supprime" }); },
  });

  const genererCarnet = async () => {
    setGeneratingCarnet(true);
    try {
      const r = await fetch(`${API_BASE}/ai/carnet-vaccinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient, vaccinations }),
      });
      const data = await r.json();
      setCarnetText(data.carnet ?? "");
      setCarnetOpen(true);
    } catch {
      toast({ title: "Erreur lors de la generation", variant: "destructive" });
    } finally {
      setGeneratingCarnet(false);
    }
  };

  const rappelsEnRetard = vaccinations.filter(v => getRappelStatut(v.dateRappel) === "retard").length;
  const rappelsBientot = vaccinations.filter(v => getRappelStatut(v.dateRappel) === "bientot").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link href={`/patients/${patientId}`}><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Carnet de vaccination</h1>
          {patient && <p className="text-muted-foreground text-sm">{patient.nom} — {patient.espece} {patient.race ? `(${patient.race})` : ""}</p>}
        </div>
        <Button variant="outline" onClick={genererCarnet} disabled={generatingCarnet}>
          {generatingCarnet ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
          Bilan IA
        </Button>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
      </div>

      {(rappelsEnRetard > 0 || rappelsBientot > 0) && (
        <div className="flex gap-3 flex-wrap">
          {rappelsEnRetard > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />{rappelsEnRetard} rappel{rappelsEnRetard > 1 ? "s" : ""} en retard
            </div>
          )}
          {rappelsBientot > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-700">
              <Clock className="h-4 w-4" />{rappelsBientot} rappel{rappelsBientot > 1 ? "s" : ""} dans les 30 jours
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : vaccinations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Syringe className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Aucune vaccination enregistree</p>
          <p className="text-sm mt-1">Ajoutez la premiere vaccination</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4 pl-10">
            {vaccinations.map((v) => {
              const statut = getRappelStatut(v.dateRappel);
              return (
                <div key={v.id} className="relative">
                  <div className={`absolute -left-6 top-4 h-3 w-3 rounded-full border-2 ${statut === "retard" ? "bg-red-500 border-red-300" : statut === "bientot" ? "bg-orange-400 border-orange-200" : "bg-primary border-primary/30"}`} />
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-base">{v.nomVaccin}</span>
                            {statut === "retard" && <Badge variant="destructive" className="text-xs">Rappel en retard</Badge>}
                            {statut === "bientot" && <Badge className="text-xs bg-orange-500 text-white">Rappel dans 30j</Badge>}
                            {statut === "ok" && <Badge variant="secondary" className="text-xs text-green-600"><CheckCircle className="h-3 w-3 mr-1" />A jour</Badge>}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>Injection : <strong className="text-foreground">{new Date(v.dateInjection).toLocaleDateString("fr-FR")}</strong></span>
                            {v.dateRappel && <span>Rappel : <strong className={statut === "retard" ? "text-red-600" : statut === "bientot" ? "text-orange-500" : "text-foreground"}>{new Date(v.dateRappel).toLocaleDateString("fr-FR")}</strong></span>}
                            {v.voieInjection && <span>Voie : <strong className="text-foreground">{v.voieInjection}</strong></span>}
                            {v.fabricant && <span>Fabricant : {v.fabricant}</span>}
                            {v.lotNumero && <span>Lot : {v.lotNumero}</span>}
                            {v.veterinaire && <span>Dr. {v.veterinaire}</span>}
                          </div>
                          {v.notes && <p className="text-sm text-muted-foreground mt-2 italic">{v.notes}</p>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(v.id)}>
                          <span className="text-xs">X</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle vaccination</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1">
              <Label>Vaccin *</Label>
              <Input value={form.nomVaccin} onChange={e => setForm(f => ({ ...f, nomVaccin: e.target.value }))} placeholder="Rage, Leptospirose, CHPPi..." />
            </div>
            <div className="space-y-1">
              <Label>Date injection *</Label>
              <Input type="date" value={form.dateInjection} onChange={e => setForm(f => ({ ...f, dateInjection: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Date rappel</Label>
              <Input type="date" value={form.dateRappel} onChange={e => setForm(f => ({ ...f, dateRappel: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Fabricant</Label>
              <Input value={form.fabricant} onChange={e => setForm(f => ({ ...f, fabricant: e.target.value }))} placeholder="Merial, Zoetis..." />
            </div>
            <div className="space-y-1">
              <Label>N° de lot</Label>
              <Input value={form.lotNumero} onChange={e => setForm(f => ({ ...f, lotNumero: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Voie d'injection</Label>
              <Input value={form.voieInjection} onChange={e => setForm(f => ({ ...f, voieInjection: e.target.value }))} placeholder="SC, IM, IN..." />
            </div>
            <div className="space-y-1">
              <Label>Veterinaire</Label>
              <Input value={form.veterinaire} onChange={e => setForm(f => ({ ...f, veterinaire: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!form.nomVaccin || !form.dateInjection || addMutation.isPending}>
              {addMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={carnetOpen} onOpenChange={setCarnetOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>Bilan vaccinal — {patient?.nom}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed bg-muted/30 rounded-lg p-4">{carnetText}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>Imprimer</Button>
            <Button onClick={() => setCarnetOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
