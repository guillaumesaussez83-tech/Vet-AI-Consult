import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Stethoscope, Syringe, User, Calendar, CheckCircle, AlertTriangle, Clock } from "lucide-react";

const API_BASE = "/api";

type PortailData = {
  owner: { nom: string; prenom?: string; email?: string; telephone?: string };
  patients: Array<{
    id: number; nom: string; espece: string; race?: string; dateNaissance?: string; poids?: number;
    lastConsultation?: { date: string; motif?: string; diagnostic?: string; veterinaire?: string } | null;
    vaccinations: Array<{ id: number; nomVaccin: string; dateInjection: string; dateRappel?: string }>;
  }>;
};

function getRappelStatut(dateRappel?: string): "retard" | "bientot" | "ok" {
  if (!dateRappel) return "ok";
  const today = new Date();
  const rappel = new Date(dateRappel);
  const diff = (rappel.getTime() - today.getTime()) / 86400000;
  if (diff < 0) return "retard";
  if (diff <= 60) return "bientot";
  return "ok";
}

function age(dateNaissance?: string): string {
  if (!dateNaissance) return "";
  const birth = new Date(dateNaissance);
  const today = new Date();
  const months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  return `${years} an${years > 1 ? "s" : ""}`;
}

export default function PortailPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery<PortailData>({
    queryKey: ["portail", token],
    queryFn: () => fetch(`${API_BASE}/portail/${token}`).then(async r => {
      if (!r.ok) throw new Error("Lien invalide");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Lien invalide ou expire</h1>
          <p className="text-gray-500">Ce lien d'acces n'est pas valide. Contactez votre veterinaire.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl">
            <Stethoscope className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-900">VetCare Pro — Portail client</h1>
            <p className="text-sm text-muted-foreground">Espace personnel de {data.owner.prenom} {data.owner.nom}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{data.owner.prenom} {data.owner.nom}</h2>
                <div className="flex flex-col gap-0.5 text-sm text-muted-foreground mt-1">
                  {data.owner.email && <span>{data.owner.email}</span>}
                  {data.owner.telephone && <span>{data.owner.telephone}</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-semibold mb-4">Mes animaux ({data.patients.length})</h2>
          <div className="space-y-5">
            {data.patients.map((patient) => {
              const rappelAlerts = patient.vaccinations.filter(v => getRappelStatut(v.dateRappel) !== "ok");
              return (
                <Card key={patient.id} className="border-0 shadow-md overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <span className="text-lg">{patient.espece === "Chien" ? "" : patient.espece === "Chat" ? "" : patient.espece === "Lapin" ? "" : ""}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-base">{patient.nom}</h3>
                        <p className="text-sm text-muted-foreground">{patient.espece}{patient.race ? ` — ${patient.race}` : ""}{patient.dateNaissance ? ` — ${age(patient.dateNaissance)}` : ""}</p>
                      </div>
                    </div>
                    {rappelAlerts.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />{rappelAlerts.length} rappel{rappelAlerts.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-5 space-y-5">
                    {patient.lastConsultation && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />Derniere consultation
                        </h4>
                        <div className="bg-muted/30 rounded-lg p-3 text-sm">
                          <p className="font-medium">{new Date(patient.lastConsultation.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                          {patient.lastConsultation.motif && <p className="text-muted-foreground">Motif : {patient.lastConsultation.motif}</p>}
                          {patient.lastConsultation.diagnostic && <p className="text-muted-foreground">Diagnostic : {patient.lastConsultation.diagnostic}</p>}
                          {patient.lastConsultation.veterinaire && <p className="text-muted-foreground">Dr. {patient.lastConsultation.veterinaire}</p>}
                        </div>
                      </div>
                    )}

                    {patient.vaccinations.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Syringe className="h-3.5 w-3.5" />Vaccinations
                        </h4>
                        <div className="space-y-2">
                          {patient.vaccinations.map((v) => {
                            const statut = getRappelStatut(v.dateRappel);
                            return (
                              <div key={v.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0">
                                <div>
                                  <p className="text-sm font-medium">{v.nomVaccin}</p>
                                  <p className="text-xs text-muted-foreground">Le {new Date(v.dateInjection).toLocaleDateString("fr-FR")}</p>
                                </div>
                                <div className="text-right">
                                  {v.dateRappel && (
                                    <div className={`flex items-center gap-1 text-xs ${statut === "retard" ? "text-red-600" : statut === "bientot" ? "text-orange-500" : "text-green-600"}`}>
                                      {statut === "ok" ? <CheckCircle className="h-3.5 w-3.5" /> : statut === "bientot" ? <Clock className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                      <span>
                                        {statut === "retard" ? "Rappel en retard" : statut === "bientot" ? "Rappel bientot" : "A jour"}
                                      </span>
                                    </div>
                                  )}
                                  {v.dateRappel && <p className="text-xs text-muted-foreground">Rappel : {new Date(v.dateRappel).toLocaleDateString("fr-FR")}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {patient.vaccinations.length === 0 && !patient.lastConsultation && (
                      <p className="text-sm text-muted-foreground text-center py-2">Aucune information disponible</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <footer className="text-center text-xs text-muted-foreground pt-4 border-t">
          <p>Portail patient VetCare Pro — Informations confidentielles</p>
          <p>Ne partagez pas ce lien avec des tiers</p>
        </footer>
      </main>
    </div>
  );
}
