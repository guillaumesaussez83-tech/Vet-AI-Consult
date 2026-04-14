import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetFacture, useUpdateFactureStatut, getGetFactureQueryKey, getListFacturesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Check, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const handleStatutChange = async () => {
    if (!newStatut) return;
    try {
      await updateStatut.mutateAsync({ id, data: { statut: newStatut } });
      queryClient.invalidateQueries({ queryKey: getGetFactureQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListFacturesQueryKey() });
      toast({ title: "Statut mis à jour" });
    } catch {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (!facture) return <div className="text-center py-16">Facture non trouvée</div>;

  const statutLabels: Record<string, string> = { en_attente: "En attente", payee: "Payée", annulee: "Annulée" };
  const patient = facture.consultation?.patient;

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
            {facture.lignes?.map((ligne, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-3 text-sm py-1">
                <span className="col-span-2">{ligne.description}</span>
                <span className="text-right text-muted-foreground">{ligne.quantite} × {ligne.prixUnitaire?.toFixed(2)} €</span>
                <span className="text-right font-medium">{ligne.montantHT?.toFixed(2)} €</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Total HT</span>
              <span>{facture.montantHT?.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TVA</span>
              <span>{facture.montantTVA?.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-1">
              <span>Total TTC</span>
              <span>{facture.montantTTC?.toFixed(2)} €</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {facture.statut !== "payee" && (
        <Card>
          <CardHeader><CardTitle>Mettre à jour le statut</CardTitle></CardHeader>
          <CardContent className="flex gap-3">
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
              Mettre à jour
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
