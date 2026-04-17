import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Plus, ArrowUpCircle, ArrowDownCircle, AlertTriangle, Printer } from "lucide-react";
import { useUser } from "@clerk/react";

const API = "/api";

function formatDateFR(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function StupefiantsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [produitId, setProduitId] = useState<string>("all");
  const [entreeOpen, setEntreeOpen] = useState(false);
  const [sortieOpen, setSortieOpen] = useState(false);
  const [entreeForm, setEntreeForm] = useState({ stockMedicamentId: "", quantite: "", numeroLot: "", dateExpirationLot: "", motif: "" });
  const [sortieForm, setSortieForm] = useState({ stockMedicamentId: "", quantite: "", numeroLot: "", animalId: "", motif: "" });

  const { data, isLoading } = useQuery<{ stupefiants: any[]; lignes: any[] }>({
    queryKey: ["registre-stupefiants", produitId],
    queryFn: async () => {
      const url = (produitId && produitId !== "all") ? `${API}/stock/stupefiants/registre?produitId=${produitId}` : `${API}/stock/stupefiants/registre`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erreur chargement registre");
      return res.json();
    },
  });

  const veterinaire = user?.fullName || user?.firstName || "Vétérinaire";

  const entreeMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch(`${API}/stock/stupefiants/entree`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Entrée stupéfiant enregistrée" });
      queryClient.invalidateQueries({ queryKey: ["registre-stupefiants"] });
      setEntreeOpen(false);
      setEntreeForm({ stockMedicamentId: "", quantite: "", numeroLot: "", dateExpirationLot: "", motif: "" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const sortieMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch(`${API}/stock/stupefiants/sortie`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sortie stupéfiant enregistrée" });
      queryClient.invalidateQueries({ queryKey: ["registre-stupefiants"] });
      setSortieOpen(false);
      setSortieForm({ stockMedicamentId: "", quantite: "", numeroLot: "", animalId: "", motif: "" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleEntree = () => {
    if (!entreeForm.stockMedicamentId || !entreeForm.quantite || !entreeForm.numeroLot) {
      toast({ title: "Produit, quantité et numéro de lot sont obligatoires", variant: "destructive" });
      return;
    }
    entreeMutation.mutate({ ...entreeForm, stockMedicamentId: Number(entreeForm.stockMedicamentId), quantite: parseFloat(entreeForm.quantite), veterinaire });
  };

  const handleSortie = () => {
    if (!sortieForm.stockMedicamentId || !sortieForm.quantite || !sortieForm.numeroLot || !sortieForm.animalId) {
      toast({ title: "Produit, quantité, numéro de lot et animal sont obligatoires", variant: "destructive" });
      return;
    }
    sortieMutation.mutate({ ...sortieForm, stockMedicamentId: Number(sortieForm.stockMedicamentId), quantite: parseFloat(sortieForm.quantite), animalId: Number(sortieForm.animalId), veterinaire });
  };

  const stupefiants = data?.stupefiants ?? [];
  const lignes = data?.lignes ?? [];
  const selectedStup = stupefiants.find(s => String(s.id) === produitId);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FlaskConical className="h-8 w-8 text-primary" />
            Registre des Stupéfiants
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registre légalement obligatoire — Conservation 10 ans minimum (Décret n°2007-157)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEntreeOpen(true)} className="gap-2">
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
            Entrée
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSortieOpen(true)} className="gap-2">
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
            Sortie
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
        </div>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Obligation légale :</strong> Toute entrée ou sortie d'un stupéfiant vétérinaire doit être enregistrée immédiatement avec numéro de lot, nom de l'animal et du vétérinaire responsable. Le solde courant doit toujours correspondre au stock physique.
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <div className="w-72">
          <Select value={produitId} onValueChange={setProduitId}>
            <SelectTrigger>
              <SelectValue placeholder="Tous les stupéfiants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les produits</SelectItem>
              {stupefiants.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.nom} (stock: {s.quantiteStock} {s.unite})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedStup && (
          <div className="text-sm text-muted-foreground">
            Stock actuel : <strong className="text-foreground">{selectedStup.quantiteStock} {selectedStup.unite}</strong>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selectedStup ? `Registre — ${selectedStup.nom}` : "Tous les stupéfiants"}
            {lignes.length > 0 && <span className="text-muted-foreground font-normal ml-2">({lignes.length} ligne{lignes.length > 1 ? "s" : ""})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : lignes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune entrée dans le registre.</p>
              <p className="text-xs mt-1">Utilisez les boutons Entrée/Sortie pour enregistrer les mouvements.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-left py-2 pr-4">Produit</th>
                    <th className="text-center py-2 pr-4">Entrée</th>
                    <th className="text-center py-2 pr-4">Sortie</th>
                    <th className="text-left py-2 pr-4">N° Lot</th>
                    <th className="text-left py-2 pr-4">Animal</th>
                    <th className="text-left py-2 pr-4">Vétérinaire</th>
                    <th className="text-right py-2">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne: any) => (
                    <tr key={ligne.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{formatDateFR(ligne.dateMouvement)}</td>
                      <td className="py-2 pr-4 font-medium">{ligne.nomProduit}</td>
                      <td className="py-2 pr-4 text-center">
                        {ligne.typeMouvement === "entree" ? (
                          <span className="text-green-700 font-semibold">+{ligne.quantite} {ligne.unite}</span>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-center">
                        {ligne.typeMouvement === "sortie" ? (
                          <span className="text-red-700 font-semibold">-{ligne.quantite} {ligne.unite}</span>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">{ligne.numeroLot ?? "—"}</Badge>
                      </td>
                      <td className="py-2 pr-4">{ligne.nomAnimal ? `${ligne.nomAnimal}${ligne.espece ? ` (${ligne.espece})` : ""}` : "—"}</td>
                      <td className="py-2 pr-4">{ligne.veterinaire}</td>
                      <td className="py-2 text-right font-mono font-semibold">
                        {ligne.soldeApres} {ligne.unite}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={entreeOpen} onOpenChange={setEntreeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-green-600" />
              Entrée stupéfiant (livraison)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produit</Label>
              <Select value={entreeForm.stockMedicamentId} onValueChange={v => setEntreeForm(f => ({ ...f, stockMedicamentId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner un stupéfiant" />
                </SelectTrigger>
                <SelectContent>
                  {stupefiants.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantité</Label>
                <Input className="mt-1" type="number" min="0" step="0.001" value={entreeForm.quantite} onChange={e => setEntreeForm(f => ({ ...f, quantite: e.target.value }))} placeholder="ex : 50" />
              </div>
              <div>
                <Label>N° Lot <span className="text-destructive">*</span></Label>
                <Input className="mt-1" value={entreeForm.numeroLot} onChange={e => setEntreeForm(f => ({ ...f, numeroLot: e.target.value }))} placeholder="ex : LOT-2025-001" />
              </div>
            </div>
            <div>
              <Label>Date expiration lot</Label>
              <Input className="mt-1" type="date" value={entreeForm.dateExpirationLot} onChange={e => setEntreeForm(f => ({ ...f, dateExpirationLot: e.target.value }))} />
            </div>
            <div>
              <Label>Motif</Label>
              <Input className="mt-1" value={entreeForm.motif} onChange={e => setEntreeForm(f => ({ ...f, motif: e.target.value }))} placeholder="ex : Livraison fournisseur CENTRAVET" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEntreeOpen(false)}>Annuler</Button>
              <Button onClick={handleEntree} disabled={entreeMutation.isPending}>
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Enregistrer l'entrée
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sortieOpen} onOpenChange={setSortieOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-red-600" />
              Sortie stupéfiant (utilisation)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produit</Label>
              <Select value={sortieForm.stockMedicamentId} onValueChange={v => setSortieForm(f => ({ ...f, stockMedicamentId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner un stupéfiant" />
                </SelectTrigger>
                <SelectContent>
                  {stupefiants.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantité utilisée</Label>
                <Input className="mt-1" type="number" min="0" step="0.001" value={sortieForm.quantite} onChange={e => setSortieForm(f => ({ ...f, quantite: e.target.value }))} placeholder="ex : 2.5" />
              </div>
              <div>
                <Label>N° Lot <span className="text-destructive">*</span></Label>
                <Input className="mt-1" value={sortieForm.numeroLot} onChange={e => setSortieForm(f => ({ ...f, numeroLot: e.target.value }))} placeholder="ex : LOT-2025-001" />
              </div>
            </div>
            <div>
              <Label>ID Animal <span className="text-destructive">*</span></Label>
              <Input className="mt-1" type="number" value={sortieForm.animalId} onChange={e => setSortieForm(f => ({ ...f, animalId: e.target.value }))} placeholder="ID de l'animal dans le système" />
            </div>
            <div>
              <Label>Motif / Acte</Label>
              <Input className="mt-1" value={sortieForm.motif} onChange={e => setSortieForm(f => ({ ...f, motif: e.target.value }))} placeholder="ex : Anesthésie chirurgie orthopédique" />
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 border border-amber-200">
              L'animal, le numéro de lot et le vétérinaire sont obligatoires pour toute sortie de stupéfiant.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setSortieOpen(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleSortie} disabled={sortieMutation.isPending}>
                <ArrowDownCircle className="h-4 w-4 mr-2" />
                Enregistrer la sortie
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
