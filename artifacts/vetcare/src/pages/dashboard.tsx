import { Link } from "wouter";
import { useGetDashboardStats, useGetConsultationsRecentes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, CreditCard, Stethoscope, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetDashboardStats();
  const { data: consultations, isLoading: isConsultationsLoading } = useGetConsultationsRecentes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Bienvenue dans votre espace de travail VetCare Pro.</p>
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
            <CardTitle className="text-sm font-medium">Chiffre d'Affaires (Mois)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold transition-opacity ${isStatsLoading ? "opacity-30" : ""}`}>
              {isStatsLoading ? "—" : stats?.chiffreAffaireMois ? `${stats.chiffreAffaireMois.toFixed(2)} €` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total généré ce mois</p>
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