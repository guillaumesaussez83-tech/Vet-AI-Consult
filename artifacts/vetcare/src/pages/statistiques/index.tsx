import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Euro, FileText, Stethoscope, Percent } from "lucide-react";

const API_BASE = "/api";

function fetchStats() {
  return fetch(`${API_BASE}/statistiques`).then(r => r.json());
}

const MONTHS_FR: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr",
  "05": "Mai", "06": "Juin", "07": "Juil", "08": "Août",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  return `${MONTHS_FR[mo] ?? mo} ${y}`;
}

function KpiCard({ title, value, sub, icon: Icon, trend }: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number | null;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {(sub || trend !== undefined) && (
          <div className="flex items-center gap-2 mt-1">
            {trend !== null && trend !== undefined && (
              <Badge variant={trend >= 0 ? "default" : "destructive"} className="text-xs gap-1">
                {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend)}%
              </Badge>
            )}
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StatistiquesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["statistiques"], queryFn: fetchStats });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Statistiques</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const kpis = data?.kpis ?? {};
  const monthly = (data?.monthly ?? []).map((m: any) => ({ ...m, label: formatMonth(m.month) }));
  const topActes = data?.topActes ?? [];
  const parVet = data?.parVeterinaire ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statistiques</h1>
        <p className="text-sm text-muted-foreground">Aujourd'hui : {new Date().toLocaleDateString("fr-FR")}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="CA aujourd'hui"
          value={`${(kpis.caAujourdhui ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          icon={Euro}
          sub="TTC"
        />
        <KpiCard
          title="Consultations aujourd'hui"
          value={`${kpis.consultationsAujourdhui ?? 0}`}
          icon={Stethoscope}
          sub="ce jour"
        />
        <KpiCard
          title="CA ce mois"
          value={`${(kpis.caThisMonth ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          icon={FileText}
          trend={kpis.evolutionMensuelle}
          sub="vs mois précédent"
        />
        <KpiCard
          title="Taux d'encaissement"
          value={`${kpis.tauxEncaissement ?? 0} %`}
          icon={Percent}
          sub={`${kpis.facturesEmisesAujourdhui ?? 0} factures émises`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chiffre d'affaires mensuel (12 mois)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthly}>
              <defs>
                <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`} />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, "CA TTC"]}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="ca" stroke="hsl(var(--primary))" fill="url(#gradCA)" strokeWidth={2} name="CA TTC" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 actes & produits</CardTitle>
          </CardHeader>
          <CardContent>
            {topActes.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">Aucune donnée</p>
            ) : (
              <div className="space-y-2">
                {topActes.map((a: any, i: number) => (
                  <div key={a.acteId ?? i} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-b-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                      <span className="text-sm font-medium truncate max-w-[180px]">{a.nomActe ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="secondary" className="text-xs">{a.totalQuantite ?? 0} fois</Badge>
                      <span className="text-sm font-semibold text-right">{(a.totalValeur ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance par vétérinaire</CardTitle>
          </CardHeader>
          <CardContent>
            {parVet.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">Aucune donnée</p>
            ) : (
              <div className="space-y-3">
                {parVet.map((v: any) => (
                  <div key={v.veterinaire} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Dr. {v.veterinaire}</span>
                      <span className="text-sm font-semibold">{(v.ca ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{v.nbConsultations} consultations</span>
                      <span>•</span>
                      <span>Panier moy. {(v.panierMoyen ?? 0).toFixed(2)} €</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {monthly.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultations par mois</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelStyle={{ fontWeight: 600 }} />
                <Bar dataKey="nbConsultations" fill="hsl(var(--primary))" name="Consultations" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
