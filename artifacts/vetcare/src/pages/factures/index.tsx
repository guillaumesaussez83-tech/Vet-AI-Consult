import { Link } from "wouter";
import { useListFactures } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ArrowRight } from "lucide-react";

const statutConfig: Record<string, { label: string; className: string }> = {
  en_attente: { label: "En attente", className: "text-amber-600 bg-amber-50 border-amber-200" },
  payee: { label: "Payée", className: "text-green-600 bg-green-50 border-green-200" },
  annulee: { label: "Annulée", className: "text-red-600 bg-red-50 border-red-200" },
};

export default function FacturesPage() {
  const { data: factures, isLoading } = useListFactures();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Factures</h1>
        <p className="text-muted-foreground">Suivi des factures et règlements</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : factures && factures.length > 0 ? (
        <div className="space-y-3">
          {factures.map((f) => {
            const config = statutConfig[f.statut] ?? { label: f.statut, className: "" };
            return (
              <Link key={f.id} href={`/factures/${f.id}`}>
                <Card className="hover-elevate cursor-pointer transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 rounded-full p-2">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold">{f.numero}</div>
                          <div className="text-sm text-muted-foreground">
                            {f.dateEmission}
                            {f.consultation?.patient && ` — ${f.consultation.patient.nom}`}
                            {f.consultation?.patient?.owner && ` (${f.consultation.patient.owner.prenom} ${f.consultation.patient.owner.nom})`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold">{f.montantTTC?.toFixed(2)} €</div>
                          <div className="text-xs text-muted-foreground">TTC</div>
                        </div>
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
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Aucune facture</p>
          <p className="text-sm mt-1">Les factures sont générées automatiquement à la fin des consultations</p>
        </div>
      )}
    </div>
  );
}
