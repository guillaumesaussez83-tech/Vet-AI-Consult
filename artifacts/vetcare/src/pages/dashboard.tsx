import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetDashboardStats, useGetConsultationsRecentes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, CreditCard, Stethoscope, ArrowRight, Syringe, Phone, AlertTriangle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RappelVaccin {
  id: number;
  nomVaccin: string;
  dateRappel: string;
  patientId: number;
  nomPatient: string | null;
  espece: string | null;
  nomProprietaire: string | null;
  prenomProprietaire: string | null;
  telephoneProprietaire: string | null;
  enRetard: boolean;
}

function useRappelsVaccins() {
  return useQuery<RappelVaccin[]>({
    queryKey: ["dashboard-rappels-vaccins"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/rappels-vaccins");
      if (!res.ok) throw new Error("Erreur chargement rappels");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetDashboardStats();
  const { data: consultations, isLoading: isConsultationsLoading } = useGetConsultationsRecentes();
  const { data: rappelsVaccins, isLoading: isRappelsLoading } = useRappelsVaccins();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Bienvenue dans votre espace de travail VétoAI.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Patients Inscrits</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold transition-opacity ${isStatsLoading ? "opacity-30" : ""}`}>
              {isStatsLoading ? "—" : (stats?.totalPatients ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isStatsLoading ? "—" : `${stats?.totalProprietaires ?? 0} propriétaires`}
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consultations (Aujourd'hui)</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold transition-opacity ${isStatsLoading ? "opacity-30" : ""}`}>
              {isStatsLoading ? "—" : (stats?.consultationsAujourdhui ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isStatsLoading ? "—" : `${stats?.consultationsEnCours ?? 0} en cours`}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA facturé (mois)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold transition-opacity ${isStatsLoading ? "opacity-30" : ""}`}>
              {isStatsLoading ? "—" : stats?.chiffreAffaireMois != null ? `${stats.chiffreAffaireMois.toFixed(2)} €` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Toutes factures émises ce mois</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Factures Impayées</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold transition-opacity ${isStatsLoading ? "opacity-30" : (stats?.facturesImpayees ?? 0) > 0 ? "text-destructive" : ""}`}>
              {isStatsLoading ? "—" : (stats?.facturesImpayees ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">En attente de règlement</p>
          </CardContent>
        </Card>
      </div>

      {/* Widget Rappels Vaccins */}
      {(isRappelsLoading || (rappelsVaccins && rappelsVaccins.length > 0)) && (
        <Card className={`border-amber-200 ${rappelsVaccins?.some(r => r.enRetard) ? "bg-red-50/40 border-red-200" : "bg-amber-50/50"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Syringe className="h-5 w-5 text-amber-600" />
                <span className={rappelsVaccins?.some(r => r.enRetard) ? "text-red-700" : "text-amber-800"}>
                  Rappels de vaccination — 7 jours
                </span>
                {rappelsVaccins && rappelsVaccins.length > 0 && (
                  <Badge
                    variant={rappelsVaccins.some(r => r.enRetard) ? "destructive" : "outline"}
                    className={rappelsVaccins.some(r => r.enRetard) ? "" : "border-amber-400 text-amber-700 bg-amber-100"}
                  >
                    {rappelsVaccins.length} rappel{rappelsVaccins.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
              <Link href="/vaccinations">
                <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-100">
                  Gérer les vaccinations <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isRappelsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 w-full rounded-lg bg-amber-100/60 animate-pulse" />)}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rappelsVaccins?.map(r => {
                  const jours = differenceInDays(parseISO(r.dateRappel), new Date());
                  const label = r.enRetard
                    ? `En retard de ${Math.abs(jours)} j`
                    : jours === 0
                    ? "Aujourd'hui"
                    : `Dans ${jours} j`;
                  return (
                    <Link key={r.id} href={`/patients/${r.patientId}`}>
                      <div className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${r.enRetard ? "bg-red-50 border-red-200 hover:bg-red-100/60" : "bg-white border-amber-200 hover:bg-amber-50"}`}>
                        <div className={`mt-0.5 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${r.enRetard ? "bg-red-100" : "bg-amber-100"}`}>
                          {r.enRetard ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> : <Syringe className="h-3.5 w-3.5 text-amber-600" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{r.nomPatient ?? "—"} <span className="text-muted-foreground font-normal text-xs">({r.espece})</span></p>
                          <p className="text-xs text-muted-foreground truncate">{r.nomVaccin}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-medium ${r.enRetard ? "text-red-600" : "text-amber-700"}`}>{label}</span>
                            {r.telephoneProprietaire && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Phone className="h-2.5 w-2.5" />{r.telephoneProprietaire}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Consultations Récentes</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Aperçu des dernières consultations de la clinique.
              </p>
            </div>
            <Link href="/consultations">
              <Button variant="outline" size="sm">Voir tout</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isConsultationsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 w-full rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : consultations?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune consultation récente.
              </div>
            ) : (
              <div className="space-y-4">
                {consultations?.slice(0, 5).map((consultation) => (
                  <div key={consultation.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {consultation.patient?.nom?.charAt(0) || "P"}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{consultation.patient?.nom || "Inconnu"}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(consultation.date), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={
                        consultation.statut === 'terminee' ? 'default' : 
                        consultation.statut === 'en_cours' ? 'secondary' : 'outline'
                      }>
                        {consultation.statut === 'terminee' ? 'Terminée' : 
                         consultation.statut === 'en_cours' ? 'En cours' : 'En attente'}
                      </Badge>
                      <Link href={`/consultations/${consultation.id}`}>
                        <Button variant="ghost" size="icon">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Accès Rapide</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Link href="/consultations/nouvelle">
              <Button className="w-full justify-start h-12 text-base" variant="outline">
                <Stethoscope className="mr-2 h-5 w-5 text-primary" />
                Nouvelle Consultation
              </Button>
            </Link>
            <Link href="/patients/nouveau">
              <Button className="w-full justify-start h-12 text-base" variant="outline">
                <Users className="mr-2 h-5 w-5 text-primary" />
                Ajouter un Patient
              </Button>
            </Link>
            <Link href="/factures">
              <Button className="w-full justify-start h-12 text-base" variant="outline">
                <CreditCard className="mr-2 h-5 w-5 text-primary" />
                Gérer les Factures
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}