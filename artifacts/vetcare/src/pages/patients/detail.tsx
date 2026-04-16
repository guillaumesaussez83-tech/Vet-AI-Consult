import { useRoute, Link } from "wouter";
import { useGetPatient, useListPatientConsultations, getGetPatientQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Calendar, Dog, Cat, Rabbit, Bird, Syringe } from "lucide-react";

const especeIcon: Record<string, React.ElementType> = {
  chien: Dog, chat: Cat, lapin: Rabbit, oiseau: Bird,
};

const statutBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  en_attente: { label: "En attente", variant: "secondary" },
  en_cours: { label: "En cours", variant: "default" },
  terminee: { label: "Terminée", variant: "outline" },
};

export default function PatientDetailPage() {
  const [, params] = useRoute("/patients/:id");
  const id = parseInt(params?.id ?? "0");
  
  const { data: patient, isLoading } = useGetPatient(id, {
    query: { enabled: !!id, queryKey: getGetPatientQueryKey(id) }
  });
  const { data: consultations } = useListPatientConsultations(id, {
    query: { enabled: !!id, queryKey: ["patient-consultations", id] }
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48" />
    </div>
  );

  if (!patient) return <div className="text-center py-16 text-muted-foreground">Patient non trouvé</div>;

  const Icon = especeIcon[patient.espece] ?? Dog;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/patients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${(patient as any).agressif ? "bg-red-100" : "bg-primary/10"}`}>
              <Icon className={`h-6 w-6 ${(patient as any).agressif ? "text-red-600" : "text-primary"}`} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{patient.nom}</h1>
                {(patient as any).agressif && (
                  <span className="inline-flex items-center bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-lg tracking-wide shadow">
                    AGRESSIF
                  </span>
                )}
              </div>
              <p className="text-muted-foreground">{patient.race || patient.espece} • {patient.sexe}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/patients/${patient.id}/vaccinations`}>
            <Button variant="outline">
              <Syringe className="mr-2 h-4 w-4" />
              Vaccinations
            </Button>
          </Link>
          <Link href={`/consultations/nouvelle?patientId=${patient.id}`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle consultation
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations du patient</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Espèce</span>
              <span className="capitalize">{patient.espece}</span>
              <span className="text-muted-foreground">Sexe</span>
              <span>{patient.sexe} {patient.sterilise && <Badge variant="secondary" className="ml-1 text-xs">Stérilisé(e)</Badge>}</span>
              {patient.dateNaissance && <>
                <span className="text-muted-foreground">Naissance</span>
                <span>{patient.dateNaissance}</span>
              </>}
              {patient.poids && <>
                <span className="text-muted-foreground">Poids</span>
                <span>{patient.poids} kg</span>
              </>}
              {patient.couleur && <>
                <span className="text-muted-foreground">Couleur</span>
                <span>{patient.couleur}</span>
              </>}
            </div>
            {patient.antecedents && (
              <div className="border-t pt-3">
                <p className="text-muted-foreground mb-1">Antécédents</p>
                <p className="bg-muted/50 rounded p-2">{patient.antecedents}</p>
              </div>
            )}
            {patient.allergies && (
              <div className="border-t pt-3">
                <p className="text-muted-foreground mb-1">Allergies</p>
                <p className="bg-destructive/10 text-destructive rounded p-2">{patient.allergies}</p>
              </div>
            )}
            {((patient as any).puce || (patient as any).passeport || (patient as any).assurance) && (
              <div className="border-t pt-3 space-y-1">
                {(patient as any).puce && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Puce :</span>
                    <span className="font-mono text-xs">{(patient as any).puce}</span>
                  </div>
                )}
                {(patient as any).passeport && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Passeport :</span>
                    <span className="font-mono text-xs">{(patient as any).passeport}</span>
                  </div>
                )}
                {(patient as any).assurance && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Assurance :</span>
                    <span className="text-green-700 font-medium">{(patient as any).assuranceNom || "Oui"}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Propriétaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {patient.owner ? (
              <>
                <div className="text-xl font-semibold">{patient.owner.prenom} {patient.owner.nom}</div>
                <div className="text-muted-foreground">{patient.owner.telephone}</div>
                {patient.owner.email && <div className="text-muted-foreground">{patient.owner.email}</div>}
                {patient.owner.adresse && <div className="text-muted-foreground">{patient.owner.adresse}</div>}
              </>
            ) : (
              <p className="text-muted-foreground">Aucun propriétaire</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Historique des consultations</CardTitle>
            <Badge variant="secondary">{consultations?.length ?? 0} consultation(s)</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {consultations && consultations.length > 0 ? (
            <div className="space-y-3">
              {consultations.map((c) => {
                const badge = statutBadge[c.statut] ?? { label: c.statut, variant: "outline" as const };
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{c.date} — Dr. {c.veterinaire}</div>
                        {c.motif && <div className="text-sm text-muted-foreground">{c.motif}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <Link href={`/consultations/${c.id}`}>
                        <Button variant="ghost" size="sm">Voir</Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Aucune consultation enregistrée</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
