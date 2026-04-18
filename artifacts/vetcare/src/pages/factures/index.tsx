import { useState } from "react";
import { Link } from "wouter";
import { useListFactures, useListConsultations, useUpdateFactureStatut } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ArrowRight, Euro, AlertCircle, CheckCircle, Clock, CreditCard, Smartphone, Banknote, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateFR } from "@/lib/utils";

const MODES_PAIEMENT = [
  { value: "carte_bancaire", label: "Carte bancaire", icon: CreditCard },
  { value: "carte_sans_contact", label: "Sans contact (NFC)", icon: Smartphone },
  { value: "especes", label: "Espèces", icon: Banknote },
  { value: "cheque", label: "Chèque", icon: FileText },
  { value: "virement", label: "Virement", icon: Building2 },
  { value: "autre", label: "Autre", icon: Euro },
];

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }: { icon: any; message: string; sub: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium">{message}</p>
      <p className="text-sm mt-1">{sub}</p>
    </div>
  );
}

function FactureCard({ f }: { f: any }) {
  const config: Record<string, { label: string; className: string }> = {
    en_attente: { label: "En attente", className: "text-amber-600 bg-amber-50 border-amber-200" },
    payee: { label: "Payée", className: "text-green-600 bg-green-50 border-green-200" },
    annulee: { label: "Annulée", className: "text-red-600 bg-red-50 border-red-200" },
  };
  const s = config[f.statut] ?? { label: f.statut, className: "" };
  return (
    <Link href={`/factures/${f.id}`}>
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
                  {formatDateFR(f.dateEmission)}
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
              {f.modePaiement && (
                <span className="text-xs text-muted-foreground border rounded px-2 py-0.5">{f.modePaiement}</span>
              )}
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${s.className}`}>{s.label}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ConsultationSansFactureCard({ c }: { c: any }) {
  return (
    <Link href={`/consultations/${c.id}`}>
      <Card className="hover-elevate cursor-pointer transition-all border-amber-200">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-amber-100 rounded-full p-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="font-semibold">{c.patient?.nom ?? "Patient"}</div>
                <div className="text-sm text-muted-foreground">
                  {formatDateFR(c.date)} — {c.motif || "Consultation"}
                  {c.patient?.owner && ` (${c.patient.owner.prenom} ${c.patient.owner.nom})`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full border text-amber-600 bg-amber-50 border-amber-200">
                A facturer
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EncaisserDialog({ facture, open, onClose }: { facture: any; open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState("");
  const [montantRecu, setMontantRecu] = useState("");
  const { mutate: patchFacture, isPending } = useUpdateFactureStatut();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isEspeces = mode === "especes";
  const montantTTC = facture?.montantTTC ?? 0;
  const renduMonnaie = isEspeces && montantRecu ? Math.max(0, parseFloat(montantRecu) - montantTTC) : null;

  function handleEncaisser() {
    if (!mode) { toast({ title: "Sélectionnez un mode de paiement", variant: "destructive" }); return; }
    if (isEspeces && (!montantRecu || parseFloat(montantRecu) < montantTTC)) {
      toast({ title: "Montant reçu insuffisant", variant: "destructive" });
      return;
    }
    const payload: any = { statut: "payee", datePaiement: new Date().toISOString().slice(0, 10), modePaiement: mode };
    if (isEspeces && montantRecu) payload.montantEspecesRecu = parseFloat(montantRecu);
    patchFacture({ id: facture.id, data: payload }, {
      onSuccess: () => {
        const modeLabel = MODES_PAIEMENT.find(m => m.value === mode)?.label ?? mode;
        const renduStr = renduMonnaie != null && renduMonnaie > 0 ? ` — Rendu : ${renduMonnaie.toFixed(2)} €` : "";
        toast({ title: "Facture encaissée", description: `${modeLabel}${renduStr}` });
        qc.invalidateQueries({ queryKey: ["factures"] });
        onClose();
      },
      onError: (err: any) => {
        const msg = err?.message ?? "Impossible d'enregistrer le paiement.";
        toast({ title: "Erreur encaissement", description: msg, variant: "destructive" });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encaisser la facture {facture?.numero}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Montant TTC à encaisser</p>
            <p className="text-3xl font-bold text-primary">{montantTTC.toFixed(2)} €</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mode de paiement</label>
            <div className="grid grid-cols-2 gap-2">
              {MODES_PAIEMENT.map(m => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                      mode === m.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {isEspeces && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant reçu (€)</label>
              <input
                type="number"
                step="0.01"
                min={montantTTC}
                value={montantRecu}
                onChange={e => setMontantRecu(e.target.value)}
                placeholder={`Min. ${montantTTC.toFixed(2)}`}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {renduMonnaie != null && renduMonnaie >= 0 && montantRecu && (
                <div className={`flex items-center justify-between rounded-lg p-3 font-semibold ${renduMonnaie === 0 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  <span>Rendu monnaie</span>
                  <span>{renduMonnaie.toFixed(2)} €</span>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleEncaisser} disabled={!mode || isPending} className="min-w-[140px]">
            <CheckCircle className="h-4 w-4 mr-2" />
            {isPending ? "Enregistrement..." : "Valider l'encaissement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FacturesPage() {
  const { data: factures, isLoading: loadingFactures } = useListFactures();
  const { data: consultations, isLoading: loadingConsultations } = useListConsultations();
  const [encaisserFacture, setEncaisserFacture] = useState<any>(null);

  const isLoading = loadingFactures || loadingConsultations;

  const factureConsultationIds = new Set((factures ?? []).map((f: any) => f.consultationId));

  const aFacturer = (consultations ?? []).filter(
    (c: any) => c.statut === "terminee" && !factureConsultationIds.has(c.id)
  );
  const aRegler = (factures ?? []).filter((f: any) => f.statut === "en_attente");
  const historique = (factures ?? []).filter((f: any) => f.statut === "payee" || f.statut === "annulee");

  const totalARegler = aRegler.reduce((s: number, f: any) => s + (f.montantTTC ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturation</h1>
          <p className="text-muted-foreground">Gestion des factures, devis et règlements</p>
        </div>
        {aRegler.length > 0 && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">A encaisser</div>
            <div className="text-2xl font-bold text-amber-600">{totalARegler.toFixed(2)} €</div>
          </div>
        )}
      </div>

      <Tabs defaultValue="a-regler">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="a-facturer" className="relative">
            A facturer
            {aFacturer.length > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {aFacturer.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="a-regler" className="relative">
            A regler
            {aRegler.length > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 leading-none">
                {aRegler.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
          <TabsTrigger value="devis">Devis</TabsTrigger>
        </TabsList>

        <TabsContent value="a-facturer" className="mt-4">
          {isLoading ? <SkeletonList /> : aFacturer.length === 0 ? (
            <EmptyState icon={CheckCircle} message="Tout est facture" sub="Toutes les consultations terminées ont une facture" />
          ) : (
            <div className="space-y-3">
              {aFacturer.map((c: any) => <ConsultationSansFactureCard key={c.id} c={c} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="a-regler" className="mt-4">
          {isLoading ? <SkeletonList /> : aRegler.length === 0 ? (
            <EmptyState icon={Euro} message="Aucune facture en attente" sub="Toutes les factures ont ete reglees" />
          ) : (
            <div className="space-y-3">
              {aRegler.map((f: any) => (
                <div key={f.id} className="relative group">
                  <FactureCard f={f} />
                  <Button
                    size="sm"
                    className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEncaisserFacture(f); }}
                  >
                    <CreditCard className="h-4 w-4 mr-1.5" />
                    Encaisser
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historique" className="mt-4">
          {isLoading ? <SkeletonList /> : historique.length === 0 ? (
            <EmptyState icon={FileText} message="Aucune facture dans l'historique" sub="Les factures payees apparaissent ici" />
          ) : (
            <div className="space-y-3">
              {historique.map((f: any) => <FactureCard key={f.id} f={f} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="devis" className="mt-4">
          <EmptyState icon={FileText} message="Module devis bientot disponible" sub="La gestion des devis sera disponible dans une prochaine version" />
        </TabsContent>
      </Tabs>

      {encaisserFacture && (
        <EncaisserDialog
          facture={encaisserFacture}
          open={!!encaisserFacture}
          onClose={() => setEncaisserFacture(null)}
        />
      )}
    </div>
  );
}
