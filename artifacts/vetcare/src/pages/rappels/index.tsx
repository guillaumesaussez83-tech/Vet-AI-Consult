import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Bell, Plus, Trash2, AlertTriangle, Phone, Mail, Dog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { unwrapResponse as __unwrapResponse } from "../../lib/queryClient";

const API_BASE = "/api";

interface RappelModele {
  id: number;
  nom: string;
  description: string | null;
  periodiciteJours: number;
  actif: boolean;
  createdAt: string;
}

interface RappelDu {
  modele: RappelModele;
  patient: any;
  owner: any;
  derniereConsultation: string;
  joursEcoules: number;
  joursRetard: number;
  urgent: boolean;
}

async function fetchModeles(): Promise<RappelModele[]> {
  const r = await fetch(`${API_BASE}/rappels/modeles`);
  if (!r.ok) throw new Error("Erreur serveur");
  return __unwrapResponse(r);
}

async function fetchDus(): Promise<RappelDu[]> {
  const r = await fetch(`${API_BASE}/rappels/dus`);
  if (!r.ok) throw new Error("Erreur serveur");
  return __unwrapResponse(r);
}

async function createModele(data: { nom: string; description: string; periodiciteJours: number }): Promise<RappelModele> {
  const r = await fetch(`${API_BASE}/rappels/modeles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Erreur serveur");
  return __unwrapResponse(r);
}

async function deleteModele(id: number): Promise<void> {
  const r = await fetch(`${API_BASE}/rappels/modeles/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Erreur serveur");
}

function periodiciteLabel(jours: number): string {
  if (jours === 365) return "1 an";
  if (jours === 180) return "6 mois";
  if (jours === 90) return "3 mois";
  if (jours === 30) return "1 mois";
  if (jours % 365 === 0) return `${jours / 365} ans`;
  if (jours % 30 === 0) return `${jours / 30} mois`;
  return `${jours} jours`;
}

function NouveauModeleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [periodiciteJours, setPeriodiciteJours] = useState("365");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: createModele,
    onSuccess: () => {
      toast({ title: "Modèle créé", description: "Le modèle de rappel a été créé." });
      qc.invalidateQueries({ queryKey: ["rappels-modeles"] });
      setNom(""); setDescription(""); setPeriodiciteJours("365");
      onClose();
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer le modèle.", variant: "destructive" }),
  });

  function handleSubmit() {
    if (!nom.trim() || !periodiciteJours) return;
    mutate({ nom: nom.trim(), description: description.trim(), periodiciteJours: parseInt(periodiciteJours) });
  }

  const PERIODICITES = [
    { label: "1 mois", value: "30" },
    { label: "3 mois", value: "90" },
    { label: "6 mois", value: "180" },
    { label: "1 an", value: "365" },
    { label: "2 ans", value: "730" },
  ];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau modèle de rappel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nom du rappel</label>
            <Input
              placeholder="Ex: Vaccination annuelle, Vermifugation..."
              value={nom}
              onChange={e => setNom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description (optionnel)</label>
            <Textarea
              placeholder="Instructions ou notes pour ce rappel..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Periodicite</label>
            <div className="grid grid-cols-3 gap-2">
              {PERIODICITES.map(p => (
                <Button
                  key={p.value}
                  type="button"
                  variant={periodiciteJours === p.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriodiciteJours(p.value)}
                >
                  {p.label}
                </Button>
              ))}
              <Input
                type="number"
                placeholder="Autre (jours)"
                value={!PERIODICITES.some(p => p.value === periodiciteJours) ? periodiciteJours : ""}
                onChange={e => setPeriodiciteJours(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!nom.trim() || !periodiciteJours || isPending}>
            {isPending ? "Création..." : "Créer le modèle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RappelsPage() {
  const [showNew, setShowNew] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: modeles, isLoading: loadingModeles } = useQuery({
    queryKey: ["rappels-modeles"],
    queryFn: fetchModeles,
  });

  const { data: dus, isLoading: loadingDus } = useQuery({
    queryKey: ["rappels-dus"],
    queryFn: fetchDus,
  });

  const { mutate: supprimerModele } = useMutation({
    mutationFn: deleteModele,
    onSuccess: () => {
      toast({ title: "Modèle supprimé" });
      qc.invalidateQueries({ queryKey: ["rappels-modeles"] });
      qc.invalidateQueries({ queryKey: ["rappels-dus"] });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" }),
  });

  const seeded = useRef(false);
  useEffect(() => {
    if (!loadingModeles && modeles !== undefined && modeles.length === 0 && !seeded.current) {
      seeded.current = true;
      const defaults = [
        { nom: "Vaccin annuel", description: "Rappel annuel des vaccinations obligatoires", periodiciteJours: 365 },
        { nom: "Bilan annuel", description: "Examen clinique complet de routine", periodiciteJours: 365 },
        { nom: "Détartrage", description: "Contrôle et nettoyage dentaire", periodiciteJours: 180 },
        { nom: "Suivi post-chirurgie", description: "Contrôle cicatrisation et rétablissement", periodiciteJours: 30 },
      ];
      Promise.all(defaults.map(d => createModele(d))).then(() => {
        qc.invalidateQueries({ queryKey: ["rappels-modeles"] });
      });
    }
  }, [modeles, loadingModeles, qc]);

  const urgents = (dus ?? []).filter((d: RappelDu) => d.urgent);
  const normaux = (dus ?? []).filter((d: RappelDu) => !d.urgent);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rappels</h1>
          <p className="text-muted-foreground">Gestion des rappels preventifs et suivis</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau modele
        </Button>
      </div>

      {(urgents.length > 0 || (!loadingDus && (dus ?? []).length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={urgents.length > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${urgents.length > 0 ? "bg-red-100" : "bg-muted"}`}>
                  <AlertTriangle className={`h-5 w-5 ${urgents.length > 0 ? "text-red-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rappels urgents</p>
                  <p className={`text-2xl font-bold ${urgents.length > 0 ? "text-red-600" : ""}`}>{urgents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2.5 rounded-lg">
                  <Bell className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total rappels dus</p>
                  <p className="text-2xl font-bold">{(dus ?? []).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2.5 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Modeles actifs</p>
                  <p className="text-2xl font-bold">{(modeles ?? []).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Modeles de rappel</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingModeles ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
              ) : (modeles ?? []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun modele de rappel</p>
                  <Button variant="link" size="sm" className="mt-2" onClick={() => setShowNew(true)}>
                    Créer le premier modele
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(modeles ?? []).map((m: RappelModele) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{m.nom}</div>
                        <div className="text-xs text-muted-foreground">Tous les {periodiciteLabel(m.periodiciteJours)}</div>
                        {m.description && <div className="text-xs text-muted-foreground truncate mt-0.5">{m.description}</div>}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 ml-2 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce modele ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Le modele "{m.nom}" sera supprimé. Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => supprimerModele(m.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Rappels dus
                {(dus ?? []).length > 0 && (
                  <Badge variant="secondary">{(dus ?? []).length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDus ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
              ) : (dus ?? []).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Aucun rappel en retard</p>
                  <p className="text-sm mt-1">
                    {(modeles ?? []).length === 0
                      ? "Créez des modèles de rappel pour commencer"
                      : "Tous vos patients sont à jour"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...urgents, ...normaux].map((d: RappelDu, i) => (
                    <div key={i} className={`p-4 rounded-lg border ${d.urgent ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full mt-0.5 ${d.urgent ? "bg-red-100" : "bg-amber-100"}`}>
                            <Dog className={`h-4 w-4 ${d.urgent ? "text-red-600" : "text-amber-600"}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{d.patient?.nom}</span>
                              <span className="text-xs text-muted-foreground">{d.patient?.espece} {d.patient?.race && `· ${d.patient.race}`}</span>
                              {d.urgent && <Badge variant="destructive" className="text-xs">Urgent</Badge>}
                            </div>
                            <div className="text-sm font-medium mt-0.5">{d.modele.nom}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Derniere visite : {d.derniereConsultation} ({d.joursEcoules} jours)
                              · En retard de {d.joursRetard} jours
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {d.owner?.telephone && (
                            <a href={`tel:${d.owner.telephone}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Phone className="h-3 w-3" />{d.owner.telephone}
                            </a>
                          )}
                          {d.owner?.email && (
                            <a href={`mailto:${d.owner.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Mail className="h-3 w-3" />{d.owner.prenom} {d.owner.nom}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <NouveauModeleDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
