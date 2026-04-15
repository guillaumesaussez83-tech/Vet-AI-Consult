import { useMemo } from "react";
import { Link } from "wouter";
import { useListFactures } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Euro, CreditCard, Banknote, Building2, FileCheck } from "lucide-react";

const modeIcons: Record<string, any> = {
  "Carte bancaire": CreditCard,
  "Espèces": Banknote,
  "Virement": Building2,
  "Chèque": FileCheck,
};

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export default function EncaissementsPage() {
  const { data: factures, isLoading } = useListFactures();

  const payees = useMemo(() => (factures ?? []).filter((f: any) => f.statut === "payee"), [factures]);

  const totalEncaisse = payees.reduce((s: number, f: any) => s + (f.montantTTC ?? 0), 0);
  const totalHT = payees.reduce((s: number, f: any) => s + (f.montantHT ?? 0), 0);
  const totalTVA = totalEncaisse - totalHT;

  const parMode = useMemo(() => groupBy(payees, (f: any) => f.modePaiement ?? "Non renseigné"), [payees]);
  const parMois = useMemo(() => {
    const grouped = groupBy(payees, (f: any) => {
      const d = new Date(f.datePaiement ?? f.dateEmission);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [payees]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Encaissements</h1>
          <p className="text-muted-foreground">Suivi des paiements reçus</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Encaissements</h1>
        <p className="text-muted-foreground">Suivi des paiements reçus</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2.5 rounded-lg">
                <Euro className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total encaissé TTC</p>
                <p className="text-2xl font-bold text-green-600">{totalEncaisse.toFixed(2)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2.5 rounded-lg">
                <FileCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Factures reglees</p>
                <p className="text-2xl font-bold">{payees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2.5 rounded-lg">
                <Euro className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">TVA collectée</p>
                <p className="text-2xl font-bold">{totalTVA.toFixed(2)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Par mode de paiement</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(parMode).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement enregistré</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(parMode).map(([mode, items]) => {
                  const Icon = modeIcons[mode] ?? CreditCard;
                  const total = (items as any[]).reduce((s, f) => s + (f.montantTTC ?? 0), 0);
                  const pct = totalEncaisse > 0 ? (total / totalEncaisse * 100).toFixed(0) : 0;
                  return (
                    <div key={mode} className="flex items-center gap-3">
                      <div className="bg-muted rounded-lg p-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{mode}</span>
                          <span className="text-muted-foreground">{total.toFixed(2)} € ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Encaissements par mois</CardTitle>
          </CardHeader>
          <CardContent>
            {parMois.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement enregistré</p>
            ) : (
              <div className="space-y-3">
                {parMois.slice(0, 6).map(([mois, items]) => {
                  const total = (items as any[]).reduce((s, f) => s + (f.montantTTC ?? 0), 0);
                  const [annee, moisNum] = mois.split("-");
                  const nom = new Date(parseInt(annee), parseInt(moisNum) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
                  return (
                    <div key={mois} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <div className="font-medium text-sm capitalize">{nom}</div>
                        <div className="text-xs text-muted-foreground">{(items as any[]).length} paiement(s)</div>
                      </div>
                      <div className="text-sm font-semibold">{total.toFixed(2)} €</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {payees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail des encaissements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...payees].sort((a: any, b: any) => (b.datePaiement ?? b.dateEmission).localeCompare(a.datePaiement ?? a.dateEmission)).map((f: any) => (
                <Link key={f.id} href={`/factures/${f.id}`}>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{f.numero}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.datePaiement ?? f.dateEmission}
                          {f.consultation?.patient && ` — ${f.consultation.patient.nom}`}
                          {f.modePaiement && ` · ${f.modePaiement}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-green-600">+{f.montantTTC?.toFixed(2)} €</div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CheckCircleIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
