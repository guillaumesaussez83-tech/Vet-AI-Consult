import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetFacture, useUpdateFactureStatut, getGetFactureQueryKey, getListFacturesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Printer, CreditCard, Smartphone, PawPrint, FileText, Building2, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MODES_PAIEMENT = [
  { value: "carte_bancaire", label: "Carte bancaire (puce)", icon: CreditCard },
  { value: "carte_sans_contact", label: "Carte sans contact (NFC)", icon: Smartphone },
  { value: "payvet", label: "PayVet (réseau vétérinaire)", icon: PawPrint },
  { value: "cheque", label: "Chèque", icon: FileText },
  { value: "virement", label: "Virement bancaire", icon: Building2 },
  { value: "especes", label: "Espèces", icon: Banknote },
];

export default function FactureDetailPage() {
  const [, params] = useRoute("/factures/:id");
  const id = parseInt(params?.id ?? "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: facture, isLoading } = useGetFacture(id, {
    query: { enabled: !!id, queryKey: getGetFactureQueryKey(id) }
  });
  const updateStatut = useUpdateFactureStatut();
  const [newStatut, setNewStatut] = useState("");
  const [modePaiement, setModePaiement] = useState("");
  const [montantEspecesRecu, setMontantEspecesRecu] = useState("");
  const [renduMonnaie, setRenduMonnaie] = useState<number | null>(null);

  const handleStatutChange = async () => {
    if (!newStatut) return;
    if (newStatut === "payee" && !modePaiement) {
      toast({ title: "Veuillez sélectionner un mode de paiement", variant: "destructive" });
      return;
    }
    if (newStatut === "payee" && modePaiement === "especes") {
      const recu = parseFloat(montantEspecesRecu);
      if (isNaN(recu) || recu <= 0) {
        toast({ title: "Veuillez saisir le montant reçu en espèces", variant: "destructive" });
        return;
      }
    }
    try {
      const payload: any = { statut: newStatut };
      if (modePaiement) payload.modePaiement = modePaiement;
      if (modePaiement === "especes" && montantEspecesRecu) payload.montantEspecesRecu = parseFloat(montantEspecesRecu);
      const result = await updateStatut.mutateAsync({ id, data: payload });
      const resultAny = result as any;
      if (resultAny?.renduMonnaie !== undefined && resultAny.renduMonnaie !== null) {
        setRenduMonnaie(resultAny.renduMonnaie);
      }
      queryClient.invalidateQueries({ queryKey: getGetFactureQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListFacturesQueryKey() });
      toast({ title: modePaiement === "especes" ? `Rendu monnaie : ${resultAny?.renduMonnaie?.toFixed(2)} €` : "Facture mise à jour" });
    } catch {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (!facture) return <div className="text-center py-16">Facture non trouvée</div>;

  const statutLabels: Record<string, string> = { en_attente: "En attente", payee: "Payée", annulee: "Annulée" };
  const patient = facture.consultation?.patient;
  const facAny = facture as any;
  const lignes: any[] = facAny.lignes ?? [];

  const totalHT = lignes.length > 0
    ? lignes.reduce((s: number, l: any) => s + Number(l.montantHT), 0)
    : (facture.montantHT ?? 0);
  const totalTVA = facAny.montantTVA != null
    ? facAny.montantTVA
    : totalHT * 0.2;
  const totalTTC = facAny.montantTTC != null
    ? facAny.montantTTC
    : totalHT + totalTVA;

  const modePaiementLabel = MODES_PAIEMENT.find(m => m.value === facture.modePaiement)?.label;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/factures">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{facture.numero}</h1>
          <p className="text-muted-foreground text-sm">Émise le {facture.dateEmission}</p>
        </div>
        <Badge variant={facture.statut === "payee" ? "outline" : facture.statut === "annulee" ? "destructive" : "secondary"}>
          {statutLabels[facture.statut] ?? facture.statut}
        </Badge>
        <Link href={`/factures/${id}/imprimer`}>
          <Button variant="outline" size="sm">
            <Printer className="mr-1.5 h-4 w-4" />
            Imprimer
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {patient && (
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Patient</span>
              <span className="font-medium">{patient.nom} ({patient.espece})</span>
              {patient.owner && <>
                <span className="text-muted-foreground">Propriétaire</span>
                <span>{patient.owner.prenom} {patient.owner.nom}</span>
                <span className="text-muted-foreground">Téléphone</span>
                <span>{patient.owner.telephone}</span>
              </>}
            </div>
          )}
          <div className="border-t pt-3">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Vétérinaire</span>
              <span>{facture.consultation?.veterinaire}</span>
              <span className="text-muted-foreground">Date consultation</span>
              <span>{facture.consultation?.date}</span>
              {modePaiementLabel && <>
                <span className="text-muted-foreground">Mode de paiement</span>
                <span className="font-medium">{modePaiementLabel}</span>
              </>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lignes de facturation</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-3 text-xs font-medium text-muted-foreground uppercase pb-2 border-b">
              <span className="col-span-2">Acte / Service</span>
              <span className="text-right">Qté × Prix</span>
              <span className="text-right">Total HT</span>
            </div>
            {lignes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune ligne de facturation enregistrée</p>
            ) : (
              lignes.map((ligne: any, idx: number) => (
                <div key={idx} className="grid grid-cols-4 gap-3 text-sm py-1">
                  <span className="col-span-2">{String(ligne.description || ligne.acte?.nom || "—")}</span>
                  <span className="text-right text-muted-foreground">{Number(ligne.quantite)} × {(Number(ligne.prixUnitaire)).toFixed(2)} €</span>
                  <span className="text-right font-medium">{(Number(ligne.montantHT)).toFixed(2)} €</span>
                </div>
              ))
            )}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Total HT</span>
              <span>{totalHT.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TVA (20 %)</span>
              <span>{totalTVA.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-1">
              <span>Total TTC</span>
              <span>{totalTTC.toFixed(2)} €</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {facture.statut !== "payee" && facture.statut !== "annulee" && (
        <Card>
          <CardHeader><CardTitle>Encaissement</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mode de paiement {newStatut === "payee" && <span className="text-destructive">*</span>}</label>
              <div className="grid grid-cols-2 gap-2">
                {MODES_PAIEMENT.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setModePaiement(value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                      modePaiement === value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            {modePaiement === "especes" && newStatut === "payee" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Montant reçu (espèces)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="ex : 50.00"
                  value={montantEspecesRecu}
                  onChange={e => setMontantEspecesRecu(e.target.value)}
                  className="w-full"
                />
                {montantEspecesRecu && parseFloat(montantEspecesRecu) >= totalTTC && (
                  <div className="flex justify-between items-center bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <span className="text-sm text-green-800 font-medium">Rendu monnaie</span>
                    <span className="text-2xl font-bold text-green-700">
                      {(parseFloat(montantEspecesRecu) - totalTTC).toFixed(2)} €
                    </span>
                  </div>
                )}
                {montantEspecesRecu && parseFloat(montantEspecesRecu) < totalTTC && parseFloat(montantEspecesRecu) > 0 && (
                  <p className="text-xs text-destructive">Montant insuffisant — il manque {(totalTTC - parseFloat(montantEspecesRecu)).toFixed(2)} €</p>
                )}
              </div>
            )}
            {renduMonnaie !== null && (
              <div className="flex justify-between items-center bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <span className="text-sm text-green-800 font-medium">Rendu monnaie (confirmé)</span>
                <span className="text-2xl font-bold text-green-700">{renduMonnaie.toFixed(2)} €</span>
              </div>
            )}
            <div className="flex gap-3">
              <Select value={newStatut} onValueChange={setNewStatut}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choisir un statut..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payee">Payée</SelectItem>
                  <SelectItem value="annulee">Annulée</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleStatutChange} disabled={!newStatut || updateStatut.isPending}>
                <Check className="mr-2 h-4 w-4" />
                Valider
              </Button>
            </div>
            {newStatut === "payee" && !modePaiement && (
              <p className="text-xs text-destructive">Le mode de paiement est requis pour valider l'encaissement.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
