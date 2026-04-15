import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, AlertTriangle, Search, Pencil, ArrowUpDown } from "lucide-react";

const API_BASE = "/api";

type Medicament = {
  id: number; nom: string; reference?: string; quantiteStock: number; quantiteMinimum: number;
  prixAchatHT?: number; prixVenteTTC?: number; fournisseur?: string; datePeremption?: string;
  emplacement?: string; unite?: string;
};

const EMPTY_FORM = {
  nom: "", reference: "", quantiteStock: 0, quantiteMinimum: 5,
  prixAchatHT: "", prixVenteTTC: "", fournisseur: "", datePeremption: "", emplacement: "", unite: "unité",
};

function getStatut(m: Medicament, today: Date): "rupture" | "critique" | "expiration" | "ok" {
  if (m.quantiteStock === 0) return "rupture";
  if (m.quantiteStock < m.quantiteMinimum) return "critique";
  if (m.datePeremption) {
    const d = new Date(m.datePeremption);
    const diff = (d.getTime() - today.getTime()) / 86400000;
    if (diff < 90) return "expiration";
  }
  return "ok";
}

export default function StockPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mvtDialogOpen, setMvtDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Medicament | null>(null);
  const [mvtTarget, setMvtTarget] = useState<Medicament | null>(null);
  const [mvtDelta, setMvtDelta] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: stock = [], isLoading } = useQuery<Medicament[]>({
    queryKey: ["stock"],
    queryFn: () => fetch(`${API_BASE}/stock`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { ...form, quantiteStock: Number(form.quantiteStock), quantiteMinimum: Number(form.quantiteMinimum),
        prixAchatHT: form.prixAchatHT ? Number(form.prixAchatHT) : undefined, prixVenteTTC: form.prixVenteTTC ? Number(form.prixVenteTTC) : undefined };
      if (editing) {
        const r = await fetch(`${API_BASE}/stock/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error("Erreur");
      } else {
        const r = await fetch(`${API_BASE}/stock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error("Erreur");
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock"] }); toast({ title: editing ? "Médicament mis à jour" : "Médicament ajouté" }); setDialogOpen(false); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const mvtMutation = useMutation({
    mutationFn: async ({ id, delta }: { id: number; delta: number }) => {
      const r = await fetch(`${API_BASE}/stock/${id}/mouvement`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta }) });
      if (!r.ok) throw new Error("Erreur");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock"] }); toast({ title: "Stock mis à jour" }); setMvtDialogOpen(false); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/stock/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock"] }); toast({ title: "Médicament supprimé" }); },
  });

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setDialogOpen(true); };
  const openEdit = (m: Medicament) => {
    setEditing(m);
    setForm({ nom: m.nom, reference: m.reference ?? "", quantiteStock: m.quantiteStock, quantiteMinimum: m.quantiteMinimum,
      prixAchatHT: m.prixAchatHT?.toString() ?? "", prixVenteTTC: m.prixVenteTTC?.toString() ?? "",
      fournisseur: m.fournisseur ?? "", datePeremption: m.datePeremption ?? "", emplacement: m.emplacement ?? "", unite: m.unite ?? "unité" });
    setDialogOpen(true);
  };

  const openMvt = (m: Medicament) => { setMvtTarget(m); setMvtDelta(""); setMvtDialogOpen(true); };

  const filtered = stock.filter(m => m.nom.toLowerCase().includes(search.toLowerCase()) || (m.reference?.toLowerCase().includes(search.toLowerCase())));
  const alerts = stock.filter(m => getStatut(m, today) !== "ok").length;

  const StatutBadge = ({ m }: { m: Medicament }) => {
    const s = getStatut(m, today);
    if (s === "rupture") return <Badge variant="destructive" className="text-xs">Rupture</Badge>;
    if (s === "critique") return <Badge variant="destructive" className="text-xs opacity-80">Stock critique</Badge>;
    if (s === "expiration") return <Badge className="text-xs bg-orange-500 text-white">Perime bientot</Badge>;
    return <Badge variant="secondary" className="text-xs text-green-600">OK</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock medicaments</h1>
          {alerts > 0 && (
            <div className="flex items-center gap-2 mt-1 text-sm text-orange-600">
              <AlertTriangle className="h-4 w-4" />
              {alerts} produit{alerts > 1 ? "s" : ""} necessitant une attention
            </div>
          )}
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher un medicament..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Aucun medicament en stock</p>
          <p className="text-sm mt-1">Ajoutez vos premiers medicaments</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium">Nom</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Reference</th>
                    <th className="text-right p-3 font-medium">Stock</th>
                    <th className="text-right p-3 font-medium hidden sm:table-cell">Min.</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">Expiration</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Emplacement</th>
                    <th className="text-center p-3 font-medium">Statut</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="p-3 font-medium">{m.nom}</td>
                      <td className="p-3 text-muted-foreground hidden md:table-cell">{m.reference || "—"}</td>
                      <td className="p-3 text-right font-semibold">{m.quantiteStock} {m.unite ?? ""}</td>
                      <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">{m.quantiteMinimum}</td>
                      <td className="p-3 hidden lg:table-cell text-muted-foreground">{m.datePeremption ? new Date(m.datePeremption).toLocaleDateString("fr-FR") : "—"}</td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">{m.emplacement || "—"}</td>
                      <td className="p-3 text-center"><StatutBadge m={m} /></td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openMvt(m)} title="Mouvement de stock"><ArrowUpDown className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(m)} title="Modifier"><Pencil className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier" : "Ajouter un medicament"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1">
              <Label>Nom *</Label>
              <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Amoxicilline..." />
            </div>
            <div className="space-y-1">
              <Label>Reference</Label>
              <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Unite</Label>
              <Input value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} placeholder="unité, comprime, ml..." />
            </div>
            <div className="space-y-1">
              <Label>Stock actuel</Label>
              <Input type="number" value={form.quantiteStock} onChange={e => setForm(f => ({ ...f, quantiteStock: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Stock minimum</Label>
              <Input type="number" value={form.quantiteMinimum} onChange={e => setForm(f => ({ ...f, quantiteMinimum: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Prix achat HT (€)</Label>
              <Input type="number" step="0.01" value={form.prixAchatHT} onChange={e => setForm(f => ({ ...f, prixAchatHT: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Prix vente TTC (€)</Label>
              <Input type="number" step="0.01" value={form.prixVenteTTC} onChange={e => setForm(f => ({ ...f, prixVenteTTC: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Fournisseur</Label>
              <Input value={form.fournisseur} onChange={e => setForm(f => ({ ...f, fournisseur: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Date expiration</Label>
              <Input type="date" value={form.datePeremption} onChange={e => setForm(f => ({ ...f, datePeremption: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Emplacement</Label>
              <Input value={form.emplacement} onChange={e => setForm(f => ({ ...f, emplacement: e.target.value }))} placeholder="Armoire A, Frigo 1..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.nom || saveMutation.isPending}>
              {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mvtDialogOpen} onOpenChange={setMvtDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mouvement de stock — {mvtTarget?.nom}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Stock actuel : <strong>{mvtTarget?.quantiteStock} {mvtTarget?.unite ?? ""}</strong></p>
            <div className="space-y-1">
              <Label>Quantite (+entree / -sortie)</Label>
              <Input type="number" value={mvtDelta} onChange={e => setMvtDelta(e.target.value)} placeholder="+10 ou -5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMvtDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => mvtTarget && mvtMutation.mutate({ id: mvtTarget.id, delta: Number(mvtDelta) })} disabled={!mvtDelta || mvtMutation.isPending}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
