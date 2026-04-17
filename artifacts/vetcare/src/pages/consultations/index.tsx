import { useState } from "react";
import { Link } from "wouter";
import { useListConsultations, getListConsultationsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Stethoscope, Dog, Cat, Rabbit, Bird, ArrowRight } from "lucide-react";
import { formatDateFR } from "@/lib/utils";

const especeIcon: Record<string, React.ElementType> = {
  chien: Dog, chat: Cat, lapin: Rabbit, oiseau: Bird,
};

const statutConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  en_attente: { label: "En attente", variant: "secondary", className: "text-amber-600 bg-amber-50 border-amber-200" },
  en_cours: { label: "En cours", variant: "default", className: "text-blue-600 bg-blue-50 border-blue-200" },
  terminee: { label: "Terminée", variant: "outline", className: "text-green-600 bg-green-50 border-green-200" },
};

export default function ConsultationsPage() {
  const [statut, setStatut] = useState<string>("all");
  const { data: consultations, isLoading } = useListConsultations(
    statut !== "all" ? { statut } : {}
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consultations</h1>
          <p className="text-muted-foreground">Gérez le flux des consultations</p>
        </div>
        <Link href="/consultations/nouvelle">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle consultation
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="terminee">Terminée</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{consultations?.length ?? 0} consultation(s)</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : consultations && consultations.length > 0 ? (
        <div className="space-y-3">
          {consultations.map((c) => {
            const config = statutConfig[c.statut] ?? { label: c.statut, variant: "outline" as const, className: "" };
            const patient = c.patient;
            const Icon = patient ? (especeIcon[patient.espece] ?? Dog) : Stethoscope;
            return (
              <Link key={c.id} href={`/consultations/${c.id}`}>
                <Card className="hover-elevate cursor-pointer transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 rounded-full p-2">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">
                            {patient?.nom ?? "Patient inconnu"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Dr. {c.veterinaire} • {formatDateFR(c.date)}
                            {patient?.owner && ` • ${patient.owner.prenom} ${patient.owner.nom}`}
                          </div>
                          {c.motif && <div className="text-sm text-muted-foreground mt-0.5">{c.motif}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${config.className}`}>
                          {config.label}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Aucune consultation trouvée</p>
          <Link href="/consultations/nouvelle">
            <Button className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Créer une consultation
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
