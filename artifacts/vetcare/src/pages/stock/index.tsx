import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Package, Plus, ArrowUpDown, TrendingDown, Clock, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function fmt(n: number | string) { return Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }); }
function fmtQty(n: number | string, unit: string) { return `${Number(n).toFixed(2).replace(".00","")} ${unit}`; }

const CATEGORIES = ["MEDICAMENT", "CONSOMMABLE", "ALIMENT", "ACCESSOIRE"];
const CAT_COLORS: Record<string, string> = {
  MEDICAMENT: "bg-blue-100 text-blue-800",
  CONSOMMABLE: "bg-green-100 text-green-800",
  ALIMENT: "bg-yellow-100 text-yellow-800",
  ACCESSOIRE: "bg-purple-100 text-purple-800",
};

export default function StockPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterAlert, setFilterAlert] = useState("all");
  const [articleDialog, setArticleDialog] = useState<any>(null);
  const [mvtDialog, setMvtDialog] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [mvtForm, setMvtForm] = useState({ type: "ENTREE", quantity: "", unitPrice: "", batchNumber: "", expirationDate: "", notes: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["stock", filterCat, filterAlert],
    queryFn: async () => {
      let url = `${API_BASE}/api/stock?`;
      if (filterCat !== "all") url += `category=${filterCat}&`;
      if (filterAlert !== "all") url += `alert=${filterAlert}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("Erreur chargement stock");
      return r.json();
    },
  });

  const items: any[] = data?.data?.items ?? [];
  const stats = data?.data?.stats ?? {};

  const filtered = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.reference?.toLowerCase().includes(search.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = payload.id ? `${API_BASE}/api/stock/${payload.id}` : `${API_BASE}/api/stock`;
      const r = await fetch(url, { method: payload.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("Erreur sauvegarde");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Article enregistré" }); qc.invalidateQueries({ queryKey: ["stock"] }); setArticleDialog(null); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const mvtMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const r = await fetch(`${API_BASE}/api/stock/${id}/mouvement`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("Erreur mouvement");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Mouvement enregistré" }); qc.invalidateQueries({ queryKey: ["stock"] }); setMvtDialog(null); setMvtForm({ type: "ENTREE", quantity: "", unitPrice: "", batchNumber: "", expirationDate: "", notes: "" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openNew = () => { setForm({ category: "MEDICAMENT", unit: "unité", tvaRate: 20, minStock: 0 }); setArticleDialog({}); };
  const openEdit = (item: any) => { setForm({ ...item, minStock: item.min_stock, unitPriceBuy: item.unit_price_buy, unitPriceSell: item.unit_price_sell, tvaRate: item.tva_rate }); setArticleDialog(item); };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6 text-blue-600" />Gestion du stock</h1>
          <p className="text-muted-foreground text-sm mt-1">Inventaire, mouvements et alertes</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nouvel article</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Total articles</div>
          <div className="text-2xl font-bold">{stats.total_articles ?? 0}</div>
        </CardContent></Card>
        <Card className={Number(stats.ruptures) > 0 ? "border-red-300" : ""}><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" />Ruptures</div>
          <div className={`text-2xl font-bold ${Number(stats.ruptures) > 0 ? "text-red-600" : ""}`}>{stats.ruptures ?? 0}</div>
        </CardContent></Card>
        <Card className={Number(stats.stocks_faibles) > 0 ? "border-orange-300" : ""}><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><TrendingDown className="h-3 w-3 text-orange-500" />Stocks faibles</div>
          <div className={`text-2xl font-bold ${Number(stats.stocks_faibles) > 0 ? "text-orange-600" : ""}`}>{stats.stocks_faibles ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Valeur stock</div>
          <div className="text-2xl font-bold text-green-600">{fmt(stats.valeur_stock ?? 0)}</div>
        </CardContent></Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher article..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAlert} onValueChange={setFilterAlert}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Alerte" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="low">Stock faible</SelectItem>
            <SelectItem value="out">Rupture</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} article(s)</span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="text-center py-12 text-muted-foreground">Chargement…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left p-3 font-medium">Article</th>
                    <th className="text-left p-3 font-medium">Catégorie</th>
                    <th className="text-right p-3 font-medium">Stock actuel</th>
                    <th className="text-right p-3 font-medium">Seuil min</th>
                    <th className="text-right p-3 font-medium">Prix achat</th>
                    <th className="text-center p-3 font-medium">Péremption</th>
                    <th className="text-center p-3 font-medium">Statut</th>
                    <th className="text-center p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const isOut = Number(item.current_stock) <= 0;
                    const isLow = !isOut && Number(item.current_stock) <= Number(item.min_stock) && Number(item.min_stock) > 0;
                    const expSoon = item.next_expiration && new Date(item.next_expiration) <= new Date(Date.now() + 30*24*60*60*1000);
                    return (
                      <tr key={item.id} className="border-b hover:bg-muted/20">
                        <td className="p-3">
                          <div className="font-medium">{item.name}</div>
                          {item.reference && <div className="text-xs text-muted-foreground">{item.reference}</div>}
                          {item.supplier_name && <div className="text-xs text-muted-foreground">{item.supplier_name}</div>}
                        </td>
                        <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${CAT_COLORS[item.category]||""}`}>{item.category}</span></td>
                        <td className={`p-3 text-right font-bold ${isOut ? "text-red-600" : isLow ? "text-orange-600" : "text-green-600"}`}>
                          {fmtQty(item.current_stock, item.unit)}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">{fmtQty(item.min_stock, item.unit)}</td>
                        <td className="p-3 text-right">{fmt(item.unit_price_buy)}</td>
                        <td className="p-3 text-center">
                          {item.next_expiration ? (
                            <span className={`text-xs ${expSoon ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                              {new Date(item.next_expiration).toLocaleDateString("fr-FR")}
                              {expSoon && <span className="ml-1">⚠️</span>}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 text-center">
                          {isOut ? <Badge variant="destructive" className="text-xs">Rupture</Badge>
                            : isLow ? <Badge className="text-xs bg-orange-100 text-orange-800">Stock faible</Badge>
                            : <Badge variant="secondary" className="text-xs">OK</Badge>}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => { setMvtDialog(item); }}>
                              <ArrowUpDown className="h-3 w-3 mr-1" />Mvt
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>Éditer</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">Aucun article trouvé</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Article */}
      <Dialog open={!!articleDialog} onOpenChange={o => !o && setArticleDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "Modifier l'article" : "Nouvel article"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><label className="text-sm font-medium">Nom *</label><Input value={form.name||""} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Référence</label><Input value={form.reference||""} onChange={e => setForm({...form, reference: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Catégorie</label>
              <Select value={form.category||"MEDICAMENT"} onValueChange={v => setForm({...form, category: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><label className="text-sm font-medium">Unité</label><Input value={form.unit||""} onChange={e => setForm({...form, unit: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Stock minimum</label><Input type="number" value={form.minStock||0} onChange={e => setForm({...form, minStock: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Prix achat HT</label><Input type="number" step="0.01" value={form.unitPriceBuy||0} onChange={e => setForm({...form, unitPriceBuy: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Prix vente HT</label><Input type="number" step="0.01" value={form.unitPriceSell||0} onChange={e => setForm({...form, unitPriceSell: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">TVA %</label><Input type="number" value={form.tvaRate||20} onChange={e => setForm({...form, tvaRate: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Emplacement</label><Input value={form.location||""} onChange={e => setForm({...form, location: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleDialog(null)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Mouvement */}
      <Dialog open={!!mvtDialog} onOpenChange={o => !o && setMvtDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowUpDown className="h-4 w-4" />Mouvement de stock — {mvtDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/40 rounded p-3 text-sm">
              Stock actuel : <strong>{mvtDialog ? fmtQty(mvtDialog.current_stock, mvtDialog.unit) : ""}</strong>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-sm font-medium">Type *</label>
                <Select value={mvtForm.type} onValueChange={v => setMvtForm({...mvtForm, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTREE">Entrée</SelectItem>
                    <SelectItem value="SORTIE">Sortie</SelectItem>
                    <SelectItem value="AJUSTEMENT">Ajustement inventaire</SelectItem>
                    <SelectItem value="PEREMPTION">Périmé / perte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="text-sm font-medium">Quantité *</label><Input type="number" step="0.01" value={mvtForm.quantity} onChange={e => setMvtForm({...mvtForm, quantity: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Prix unitaire</label><Input type="number" step="0.01" value={mvtForm.unitPrice} onChange={e => setMvtForm({...mvtForm, unitPrice: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">N° lot</label><Input value={mvtForm.batchNumber} onChange={e => setMvtForm({...mvtForm, batchNumber: e.target.value})} /></div>
              <div className="col-span-2 space-y-1"><label className="text-sm font-medium flex items-center gap-1"><Clock className="h-3 w-3" />Date péremption</label><Input type="date" value={mvtForm.expirationDate} onChange={e => setMvtForm({...mvtForm, expirationDate: e.target.value})} /></div>
              <div className="col-span-2 space-y-1"><label className="text-sm font-medium">Notes</label><Input value={mvtForm.notes} onChange={e => setMvtForm({...mvtForm, notes: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMvtDialog(null)}>Annuler</Button>
            <Button onClick={() => mvtMutation.mutate({ id: mvtDialog?.id, ...mvtForm })} disabled={mvtMutation.isPending || !mvtForm.quantity}>
              Enregistrer le mouvement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
