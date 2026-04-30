import { useState } from "react";
import { Link } from "wouter";
import { useListPatients, useDeletePatient, getListPatientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Dog, Cat, Rabbit, Bird, Trash2, Eye, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const especeIcon: Record<string, React.ElementType> = {
  chien: Dog,
  chat: Cat,
  lapin: Rabbit,
  oiseau: Bird,
};

const especeLabel: Record<string, string> = {
  chien: "Chien",
  chat: "Chat",
  lapin: "Lapin",
  oiseau: "Oiseau",
  autre: "Autre",
};

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nom: string } | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const { data: patients, isLoading } = useListPatients(search ? { search } : {});
  const deletePatient = useDeletePatient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePatient.mutateAsync({ id: deleteTarget.id });
      queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      toast({ title: "Patient supprimé avec succès" });
      setDeleteTarget(null);
      setConfirmName("");
    } catch (err) {
      const msg = (err as Error)?.message ?? "Erreur lors de la suppression";
      toast({ title: msg, variant: "destructive" })
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patients</h1>
          <p className="text-muted-foreground">Gérez le dossier de vos patients</p>
        </div>
        <Link href="/patients/nouveau">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau patient
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un patient, propriétaire..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : patients && patients.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patients.map((patient) => {
            const Icon = especeIcon[patient.espece] ?? Dog;
            return (
              <Card key={patient.id} className={`hover-elevate transition-all group ${(patient as any).agressif ? "border-red-400 bg-red-50" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${(patient as any).agressif ? "bg-red-100" : "bg-primary/10"}`}>
                        <Icon className={`h-5 w-5 ${(patient as any).agressif ? "text-red-600" : "text-primary"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{patient.nom}</h3>
                          {(patient as any).agressif && (
                            <span className="inline-flex items-center bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded tracking-wide">
                              AGRESSIF
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {patient.race || especeLabel[patient.espece] || patient.espece}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/patients/${patient.id}`}>
                        <Button size="icon" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { setDeleteTarget({ id: patient.id, nom: patient.nom }); setConfirmName(""); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Propriétaire :</span>
                      <span className="font-medium">
                        {patient.owner ? `${patient.owner.prenom} ${patient.owner.nom}` : "—"}
                      </span>
                      {patient.owner && !(patient.owner as any).rgpdAccepted && (
                        <span
                          title="Consentement RGPD non recueilli"
                          className="inline-flex items-center text-amber-600"
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Sexe :</span>
                      <span>{patient.sexe === "mâle" ? "Mâle" : "Femelle"}</span>
                      {patient.sterilise && <Badge variant="secondary" className="text-xs">Stérilisé(e)</Badge>}
                    </div>
                    {patient.poids && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Poids :</span>
                        <span>{patient.poids} kg</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Dog className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Aucun patient trouvé</p>
          <p className="text-sm mt-1">Créez votre premier patient pour commencer</p>
          <Link href="/patients/nouveau">
            <Button className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un patient
            </Button>
          </Link>
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setConfirmName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer {deleteTarget?.nom} ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Toutes les données de ce patient seront définitivement supprimées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm">
              Tapez <strong>{deleteTarget?.nom}</strong> pour confirmer la suppression
            </Label>
            <Input
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={deleteTarget?.nom ?? ""}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setConfirmName(""); }}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={confirmName !== deleteTarget?.nom}
              onClick={handleDelete}
            >
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
