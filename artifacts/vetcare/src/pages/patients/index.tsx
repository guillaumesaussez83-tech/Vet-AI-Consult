import { useState } from "react";
import { Link } from "wouter";
import { useListPatients, useDeletePatient, getListPatientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Dog, Cat, Rabbit, Bird, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const { data: patients, isLoading } = useListPatients(search ? { search } : {});
  const deletePatient = useDeletePatient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    try {
      await deletePatient.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      toast({ title: "Patient supprimé avec succès" });
    } catch {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
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
              <Card key={patient.id} className={`hover-elevate transition-all ${(patient as any).agressif ? "border-red-400 bg-red-50" : ""}`}>
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer {patient.nom} ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. Toutes les données de ce patient seront supprimées.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(patient.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Propriétaire :</span>
                      <span className="font-medium">
                        {patient.owner ? `${patient.owner.prenom} ${patient.owner.nom}` : "—"}
                      </span>
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
    </div>
  );
}
