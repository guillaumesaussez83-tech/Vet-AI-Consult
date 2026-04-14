import { useState } from "react";
import { useListActes, useCreateActe, useDeleteActe, getListActesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const CATEGORIES = ["consultation", "chirurgie", "vaccination", "analyse", "radiologie", "médicament", "autre"];

const categorieColor: Record<string, string> = {
  consultation: "text-blue-600 bg-blue-50 border-blue-200",
  chirurgie: "text-red-600 bg-red-50 border-red-200",
  vaccination: "text-green-600 bg-green-50 border-green-200",
  analyse: "text-purple-600 bg-purple-50 border-purple-200",
  radiologie: "text-amber-600 bg-amber-50 border-amber-200",
  médicament: "text-teal-600 bg-teal-50 border-teal-200",
  autre: "text-gray-600 bg-gray-50 border-gray-200",
};

export default function ActesPage() {
  const { data: actes, isLoading } = useListActes();
  const createActe = useCreateActe();
  const deleteActe = useDeleteActe();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nom: "", categorie: "consultation", prixDefaut: "", tvaRate: "20", description: "", unite: ""
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createActe.mutateAsync({
        data: {
          nom: form.nom,
          categorie: form.categorie,
          prixDefaut: parseFloat(form.prixDefaut),
          tvaRate: parseFloat(form.tvaRate),
          description: form.description || null,
          unite: form.unite || null,
        }
      });
      queryClient.invalidateQueries({ queryKey: getListActesQueryKey() });
      setOpen(false);
      setForm({ nom: "", categorie: "consultation", prixDefaut: "", tvaRate: "20", description: "", unite: "" });
      toast({ title: "Acte créé" });
    } catch {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteActe.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListActesQueryKey() });
      toast({ title: "Acte supprimé" });
    } catch {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  };

  const grouped = actes?.reduce((acc, a) => {
    const cat = a.categorie || "autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {} as Record<string, typeof actes[number][]>) ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Actes & Produits</h1>
          <p className="text-muted-foreground">Gérez votre nomenclature d'actes et médicaments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nouvel acte</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un acte</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Nom *</Label>
                <Input className="mt-1" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} required placeholder="Ex: Consultation standard" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Catégorie *</Label>
                  <Select value={form.categorie} onValueChange={v => setForm(f => ({ ...f, categorie: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prix HT (€) *</Label>
                  <Input className="mt-1" type="number" step="0.01" value={form.prixDefaut} onChange={e => setForm(f => ({ ...f, prixDefaut: e.target.value }))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>TVA (%)</Label>
                  <Input className="mt-1" type="number" step="0.1" value={form.tvaRate} onChange={e => setForm(f => ({ ...f, tvaRate: e.target.value }))} />
                </div>
                <div>
                  <Label>Unité</Label>
                  <Input className="mt-1" value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} placeholder="Ex: cp, mL, unité" />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <Button type="submit" disabled={createActe.isPending} className="w-full">
                {createActe.isPending ? "Création..." : "Créer l'acte"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([categorie, items]) => (
            <Card key={categorie}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${categorieColor[categorie] ?? ""}`}>
                    {categorie}
                  </span>
                  <span className="text-sm text-muted-foreground">{items.length} acte(s)</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.map(acte => (
                    <div key={acte.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                      <div>
                        <span className="font-medium">{acte.nom}</span>
                        {acte.description && <span className="text-sm text-muted-foreground ml-2">— {acte.description}</span>}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="font-semibold">{acte.prixDefaut?.toFixed(2)} €</span>
                          <span className="text-xs text-muted-foreground ml-1">HT</span>
                        </div>
                        <span className="text-xs text-muted-foreground">TVA {acte.tvaRate}%</span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer "{acte.nom}" ?</AlertDialogTitle>
                              <AlertDialogDescription>Cet acte sera définitivement supprimé.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(acte.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
