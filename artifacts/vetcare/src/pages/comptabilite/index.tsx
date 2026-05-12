import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Euro, AlertCircle, FileText, Download, Calendar,
  BarChart3, Receipt, Clock
} from "lucide-react";
import { Link } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function fmt(n: number | string) {
  return Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function ComptabilitePage() {
  const now = new Date();
  const firstOfYear = `${now.getFullYear()}-01-01`;
  const today = now.toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState({ from: firstOfYear, to: today });

  const { data, isLoading } = useQuery({
    queryKey: ["compta-dashboard", applied.from, applied.to],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/comptabilite/dashboard?from=${applied.from}&to=${applied.to}`);
      if (!r.ok) throw new Error("Erreur dashboard");
      return r.json();
    },
  });

  const kpis = data?.data?.kpis ?? {};
  const monthly: any[] = data?.data?.monthly ?? [];
  const byMethod: any[] = data?.data?.byPaymentMethod ?? [];

  // Couleurs barChart
  const maxCA = Math.max(...monthly.map((m) => Number(m.ca_ht)), 1);

  const handleExportFEC = () => {
    window.open(`${API_BASE}/api/comptabilite/export-fec?from=${applied.from}&to=${applied.to}`, "_blank");
  };

  const handleJournalCaisse = () => {
    window.open(`${API_BASE}/api/comptabilite/journal-caisse?date=${today}`, "_blank");
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ComptabilitÃ©</h1>
          <p className="text-muted-foreground text-sm mt-1">Dashboard financier et exports lÃ©gaux</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleJournalCaisse}>
            <Receipt className="h-4 w-4 mr-2" />
            Journal du jour
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportFEC}>
            <Download className="h-4 w-4 mr-2" />
            Export FEC
          </Button>
          <Link href="/comptabilite/impayes">
            <Button variant={Number(kpis.nb_impayes) > 0 ? "destructive" : "outline"} size="sm">
              <AlertCircle className="h-4 w-4 mr-2" />
              ImpayÃ©s
              {Number(kpis.nb_impayes) > 0 && (
                <Badge variant="secondary" className="ml-2 bg-white text-red-600 text-xs">
                  {kpis.nb_impayes}
                </Badge>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtre pÃ©riode */}
      <div className="flex items-center gap-3 bg-muted/40 rounded-lg p-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">PÃ©riode :</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
        <span className="text-muted-foreground">â</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 h-8 text-sm" />
        <Button size="sm" onClick={() => setApplied({ from, to })}>Appliquer</Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">CA HT</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? "â¦" : fmt(kpis.ca_ht ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              TTC : {isLoading ? "â¦" : fmt(kpis.ca_ttc ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Euro className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">TVA collectÃ©e</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {isLoading ? "â¦" : fmt(kpis.tva_collectee ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">sur {kpis.nb_factures ?? 0} factures</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Factures</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {isLoading ? "â¦" : kpis.nb_factures ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Ã©mises sur la pÃ©riode</div>
          </CardContent>
        </Card>

        <Card className={Number(kpis.impayes_ttc) > 0 ? "border-red-300" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className={`h-4 w-4 ${Number(kpis.impayes_ttc) > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">ImpayÃ©s</span>
            </div>
            <div className={`text-2xl font-bold ${Number(kpis.impayes_ttc) > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              {isLoading ? "â¦" : fmt(kpis.impayes_ttc ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {kpis.nb_impayes ?? 0} facture{Number(kpis.nb_impayes) > 1 ? "s" : ""} en attente
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Courbe CA mensuel */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              CA HT mensuel (12 derniers mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthly.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">Aucune donnÃ©e</div>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {monthly.map((m) => {
                  const pct = (Number(m.ca_ht) / maxCA) * 100;
                  return (
                    <div key={m.mois} className="flex flex-col items-center flex-1 gap-1">
                      <div className="text-xs text-muted-foreground">
                        {fmt(m.ca_ht).replace("â¬", "").trim()}
                      </div>
                      <div
                        className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-default"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                        title={`${m.mois} : ${fmt(m.ca_ht)}`}
                      />
                      <div className="text-xs text-muted-foreground">{m.mois.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RÃ©partition modes de rÃ¨glement */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Modes de rÃ¨glement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byMethod.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">Aucun encaissement</div>
            ) : (
              <div className="space-y-2">
                {byMethod.map((m) => (
                  <div key={m.methode} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{m.methode}</Badge>
                      <span className="text-muted-foreground">{m.nb}Ã</span>
                    </div>
                    <span className="font-medium">{fmt(m.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Export section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exports comptables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border rounded-lg p-3 space-y-2">
              <div className="font-medium text-sm">Fichier FEC</div>
              <div className="text-xs text-muted-foreground">
                Format DGFiP â compatible Sage, EBP, Cegid. Requis en cas de contrÃ´le fiscal.
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={handleExportFEC}>
                <Download className="h-3 w-3 mr-2" />
                TÃ©lÃ©charger FEC ({applied.from} â {applied.to})
              </Button>
            </div>

            <div className="border rounded-lg p-3 space-y-2">
              <div className="font-medium text-sm">Journal de caisse</div>
              <div className="text-xs text-muted-foreground">
                RÃ©sumÃ© des encaissements du jour par mode de rÃ¨glement.
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={handleJournalCaisse}>
                <Clock className="h-3 w-3 mr-2" />
                Journal du {today}
              </Button>
            </div>

            <div className="border rounded-lg p-3 space-y-2">
              <div className="font-medium text-sm">Relances impayÃ©s</div>
              <div className="text-xs text-muted-foreground">
                Consulter et relancer les factures non rÃ©glÃ©es par anciennetÃ©.
              </div>
              <Link href="/comptabilite/impayes">
                <Button size="sm" variant="outline" className="w-full">
                  <AlertCircle className="h-3 w-3 mr-2" />
                  Voir les impayÃ©s ({kpis.nb_impayes ?? "â¦"})
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
