import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Package, AlertTriangle, ShoppingCart, Truck, Activity, Plus, Search,
  Pencil, ArrowUpDown, Download, Brain, CheckCircle, RefreshCw, X, Loader2, Eye,
} from "lucide-react";

const API_BASE = "/api";

type Medicament = {
  id: number; nom: string; reference?: string; referenceCentravet?: string; codeEan?: string;
  categorie?: string; quantiteStock: number; quantiteMinimum: number; quantiteMax?: number;
  pointCommande?: number; quantiteCommandeOptimale?: number; prixAchatHT?: number;
  prixVenteTTC?: number; tvaTaux?: number; fournisseurPrincipal?: string; delaiLivraisonJours?: number;
  datePeremption?: string; datePeremptionLot?: string; emplacement?: string; unite?: string; actif?: boolean;
};

type Alerte = {
  id: number; typeAlerte: string; niveauUrgence: string; message: string;
  estTraitee: boolean; createdAt: string; medicamentId?: number; nomMedicament?: string;
};

type Commande = {
  id: number; numeroCommande: string; statut: string; typeDeclenchement: string;
  dateCreation: string; montantTotalHT?: number; notesIA?: string; notesASV?: string;
  dateLivraisonPrevue?: string; lignes?: LigneCommande[];
};

type LigneCommande = {
  id: number; medicamentId: number; nomMedicament?: string; referenceCentravet?: string;
  quantiteCommandee: number; quantiteRecue?: number; prixUnitaireHT?: number;
  statutLigne: string; lotNumero?: string; datePeremptionRecu?: string; unite?: string;
};

const CATEGORIES = ["medicament", "vaccin", "consommable", "aliment", "materiel"];
const STATUT_COMMANDE_LABELS: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  validee: { label: "Validée", color: "bg-blue-100 text-blue-700" },
  envoyee_centravet: { label: "Envoyée CENTRAVET", color: "bg-purple-100 text-purple-700" },
  en_cours_livraison: { label: "En livraison", color: "bg-yellow-100 text-yellow-700" },
  livree_partielle: { label: "Livrée partielle", color: "bg-orange-100 text-orange-700" },
  livree_complete: { label: "Livrée", color: "bg-green-100 text-green-700" },
  annulee: { label: "Annulée", color: "bg-red-100 text-red-700" },
};

const URGENCE_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string }> = {
  critique: { icon: AlertTriangle, color: "border-red-200 bg-red-50 text-red-800" },
  warning: { icon: AlertTriangle, color: "border-orange-200 bg-orange-50 text-orange-800" },
  info: { icon: Activity, color: "border-blue-200 bg-blue-50 text-blue-800" },
};

const EMPTY_MED = {
  nom: "", reference: "", referenceCentravet: "", codeEan: "", categorie: "medicament",
  quantiteStock: 0, quantiteMinimum: 5, quantiteMax: "", pointCommande: "",
  prixAchatHT: "", prixVenteTTC: "", tvaTaux: 20, fournisseurPrincipal: "CENTRAVET",
  delaiLivraisonJours: 1, datePeremption: "", emplacement: "", unite: "unité",
};

function KpiCard({ title, value, sub, icon: Icon, color }: { title: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <p className="text-xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// ONGLET ALERTES
// ─────────────────────────────────────────
function AlertesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "critique" | "warning" | "info">("all");

  const { data: alertes = [], isLoading, refetch } = useQuery<Alerte[]>({
    queryKey: ["alertes-stock", "actives"],
    queryFn: () => fetch(`${API_BASE}/stock/alertes?traitee=false`).then(r => r.json()),
  });

  const genererMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/stock/alertes/generer`, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => { toast({ title: `${data.count} alertes générées` }); qc.invalidateQueries({ queryKey: ["alertes-stock"] }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const traiterMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/stock/alertes/${id}/traiter`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alertes-stock"] }); },
  });

  const analyserMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/stock/ia/analyser-consommation`, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => { toast({ title: `Analyse IA complète — ${data.updated} produits mis à jour` }); qc.invalidateQueries({ queryKey: ["stock"] }); },
    onError: () => toast({ title: "Erreur IA", variant: "destructive" }),
  });

  const anomaliesMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/stock/ia/detecter-anomalies`, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: `${data.count} anomalie${data.count !== 1 ? "s" : ""} détectée${data.count !== 1 ? "s" : ""}` });
      qc.invalidateQueries({ queryKey: ["alertes-stock"] });
    },
    onError: () => toast({ title: "Erreur détection anomalies", variant: "destructive" }),
  });

  const filtered = filter === "all" ? alertes : alertes.filter(a => a.niveauUrgence === filter);
  const critiques = alertes.filter(a => a.niveauUrgence === "critique").length;
  const warnings = alertes.filter(a => a.niveauUrgence === "warning").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => genererMutation.mutate()} disabled={genererMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${genererMutation.isPending ? "animate-spin" : ""}`} />Actualiser
          </Button>
          <Button variant="outline" size="sm" onClick={() => analyserMutation.mutate()} disabled={analyserMutation.isPending}>
            <Brain className={`h-4 w-4 mr-2 ${analyserMutation.isPending ? "animate-spin" : ""}`} />Analyse consommation
          </Button>
          <Button variant="outline" size="sm" onClick={() => anomaliesMutation.mutate()} disabled={anomaliesMutation.isPending}
            className="border-purple-300 text-purple-700 hover:bg-purple-50">
            {anomaliesMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
            Détecter anomalies
          </Button>
        </div>
        <div className="flex gap-2">
          {(["all", "critique", "warning", "info"] as const).map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {f === "all" ? `Tout (${alertes.length})` : f === "critique" ? `Critique (${critiques})` : f === "warning" ? `Warning (${warnings})` : "Info"}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-30 text-green-500" />
          <p className="text-lg font-medium">Aucune alerte active</p>
          <p className="text-sm">Le stock est en bon état</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(a => {
          const cfg = URGENCE_CONFIG[a.niveauUrgence] ?? URGENCE_CONFIG.info;
          const Icon = cfg.icon;
          return (
            <div key={a.id} className={`flex items-start gap-3 border rounded-lg p-3 ${cfg.color}`}>
              <Icon className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{a.message}</p>
                <p className="text-xs opacity-70 mt-0.5">
                  {new Date(a.createdAt).toLocaleString("fr-FR")}
                  {a.nomMedicament && ` — ${a.nomMedicament}`}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0 h-7 text-xs" onClick={() => traiterMutation.mutate(a.id)}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" />Traité
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ONGLET PRODUITS
// ─────────────────────────────────────────
function ProduitsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mvtDialogOpen, setMvtDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Medicament | null>(null);
  const [mvtTarget, setMvtTarget] = useState<Medicament | null>(null);
  const [mvtDelta, setMvtDelta] = useState("");
  const [mvtMotif, setMvtMotif] = useState("");
  const [form, setForm] = useState<typeof EMPTY_MED>({ ...EMPTY_MED });

  const { data: stock = [], isLoading } = useQuery<Medicament[]>({
    queryKey: ["stock"],
    queryFn: () => fetch(`${API_BASE}/stock`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        quantiteStock: Number(form.quantiteStock), quantiteMinimum: Number(form.quantiteMinimum),
        quantiteMax: form.quantiteMax ? Number(form.quantiteMax) : undefined,
        pointCommande: form.pointCommande ? Number(form.pointCommande) : undefined,
        prixAchatHT: form.prixAchatHT ? Number(form.prixAchatHT) : undefined,
        prixVenteTTC: form.prixVenteTTC ? Number(form.prixVenteTTC) : undefined,
      };
      if (editing) {
        const r = await fetch(`${API_BASE}/stock/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error();
      } else {
        const r = await fetch(`${API_BASE}/stock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error();
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock"] }); toast({ title: editing ? "Produit mis à jour" : "Produit ajouté" }); setDialogOpen(false); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const mvtMutation = useMutation({
    mutationFn: async ({ id, delta, motif }: { id: number; delta: number; motif: string }) => {
      const type = delta > 0 ? "entree_reception" : "ajustement_inventaire";
      const r = await fetch(`${API_BASE}/stock/${id}/mouvement`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta, typeMouvement: type, motif }) });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock"] }); toast({ title: "Stock mis à jour" }); setMvtDialogOpen(false); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_MED }); setDialogOpen(true); };
  const openEdit = (m: Medicament) => {
    setEditing(m);
    setForm({
      nom: m.nom, reference: m.reference ?? "", referenceCentravet: m.referenceCentravet ?? "",
      codeEan: m.codeEan ?? "", categorie: m.categorie ?? "medicament",
      quantiteStock: m.quantiteStock, quantiteMinimum: m.quantiteMinimum,
      quantiteMax: m.quantiteMax?.toString() ?? "", pointCommande: m.pointCommande?.toString() ?? "",
      prixAchatHT: m.prixAchatHT?.toString() ?? "", prixVenteTTC: m.prixVenteTTC?.toString() ?? "",
      tvaTaux: m.tvaTaux ?? 20, fournisseurPrincipal: m.fournisseurPrincipal ?? "CENTRAVET",
      delaiLivraisonJours: m.delaiLivraisonJours ?? 1,
      datePeremption: m.datePeremption ?? "", emplacement: m.emplacement ?? "", unite: m.unite ?? "unité",
    });
    setDialogOpen(true);
  };

  const filtered = stock.filter(m => {
    const matchSearch = m.nom.toLowerCase().includes(search.toLowerCase()) || (m.referenceCentravet?.toLowerCase().includes(search.toLowerCase()));
    const matchCat = catFilter === "all" || m.categorie === catFilter;
    return matchSearch && matchCat;
  });

  const getStatutBadge = (m: Medicament) => {
    if (m.quantiteStock === 0) return <Badge variant="destructive" className="text-xs">Rupture</Badge>;
    const seuil = m.pointCommande ?? m.quantiteMinimum;
    if (m.quantiteStock <= seuil) return <Badge variant="destructive" className="text-xs opacity-80">Stock bas</Badge>;
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Aucun produit trouvé</p></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Produit</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Réf. CENTRAVET</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Catégorie</th>
                <th className="text-right p-3 font-medium">Stock</th>
                <th className="text-right p-3 font-medium hidden sm:table-cell">Min / Max</th>
                <th className="text-right p-3 font-medium hidden md:table-cell">Point cde</th>
                <th className="text-right p-3 font-medium hidden lg:table-cell">PA HT</th>
                <th className="text-left p-3 font-medium hidden xl:table-cell">Expiration</th>
                <th className="text-center p-3 font-medium">Statut</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b last:border-b-0 hover:bg-muted/10">
                  <td className="p-3 font-medium">
                    <div>{m.nom}</div>
                    {m.emplacement && <div className="text-xs text-muted-foreground">{m.emplacement}</div>}
                  </td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell font-mono text-xs">{m.referenceCentravet || m.reference || "—"}</td>
                  <td className="p-3 hidden md:table-cell">
                    <Badge variant="outline" className="text-xs capitalize">{m.categorie ?? "—"}</Badge>
                  </td>
                  <td className="p-3 text-right font-bold">{m.quantiteStock} <span className="font-normal text-muted-foreground text-xs">{m.unite ?? ""}</span></td>
                  <td className="p-3 text-right text-muted-foreground text-xs hidden sm:table-cell">{m.quantiteMinimum} / {m.quantiteMax ?? "—"}</td>
                  <td className="p-3 text-right text-muted-foreground text-xs hidden md:table-cell">{m.pointCommande ? m.pointCommande.toFixed(1) : "—"}</td>
                  <td className="p-3 text-right text-muted-foreground text-xs hidden lg:table-cell">{m.prixAchatHT ? `${m.prixAchatHT.toFixed(2)} €` : "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground hidden xl:table-cell">
                    {(m.datePeremptionLot ?? m.datePeremption) ? new Date(m.datePeremptionLot ?? m.datePeremption!).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="p-3 text-center">{getStatutBadge(m) ?? <span className="text-green-600 text-xs font-medium">OK</span>}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setMvtTarget(m); setMvtDelta(""); setMvtMotif(""); setMvtDialogOpen(true); }} title="Mouvement"><ArrowUpDown className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(m)} title="Modifier"><Pencil className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier le produit" : "Ajouter un produit"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1"><Label>Nom *</Label><Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <Select value={form.categorie} onValueChange={v => setForm(f => ({ ...f, categorie: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Unité</Label><Input value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} placeholder="unité, comprimé, ml..." /></div>
            <div className="space-y-1"><Label>Réf. CENTRAVET</Label><Input value={form.referenceCentravet} onChange={e => setForm(f => ({ ...f, referenceCentravet: e.target.value }))} placeholder="CV-XXXXX" /></div>
            <div className="space-y-1"><Label>Code EAN</Label><Input value={form.codeEan} onChange={e => setForm(f => ({ ...f, codeEan: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Stock actuel</Label><Input type="number" value={form.quantiteStock} onChange={e => setForm(f => ({ ...f, quantiteStock: Number(e.target.value) }))} /></div>
            <div className="space-y-1"><Label>Stock minimum</Label><Input type="number" value={form.quantiteMinimum} onChange={e => setForm(f => ({ ...f, quantiteMinimum: Number(e.target.value) }))} /></div>
            <div className="space-y-1"><Label>Stock maximum (IA)</Label><Input type="number" step="0.1" value={form.quantiteMax} onChange={e => setForm(f => ({ ...f, quantiteMax: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Point de commande (IA)</Label><Input type="number" step="0.1" value={form.pointCommande} onChange={e => setForm(f => ({ ...f, pointCommande: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Prix achat HT (€)</Label><Input type="number" step="0.01" value={form.prixAchatHT} onChange={e => setForm(f => ({ ...f, prixAchatHT: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Prix vente TTC (€)</Label><Input type="number" step="0.01" value={form.prixVenteTTC} onChange={e => setForm(f => ({ ...f, prixVenteTTC: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Fournisseur</Label><Input value={form.fournisseurPrincipal} onChange={e => setForm(f => ({ ...f, fournisseurPrincipal: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Délai livraison (jours)</Label><Input type="number" value={form.delaiLivraisonJours} onChange={e => setForm(f => ({ ...f, delaiLivraisonJours: Number(e.target.value) }))} /></div>
            <div className="space-y-1"><Label>Date expiration</Label><Input type="date" value={form.datePeremption} onChange={e => setForm(f => ({ ...f, datePeremption: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Emplacement</Label><Input value={form.emplacement} onChange={e => setForm(f => ({ ...f, emplacement: e.target.value }))} placeholder="Armoire A, Frigo 1..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.nom || saveMutation.isPending}>{saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mvtDialogOpen} onOpenChange={setMvtDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mouvement de stock — {mvtTarget?.nom}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Stock actuel : <strong>{mvtTarget?.quantiteStock} {mvtTarget?.unite ?? ""}</strong></p>
            <div className="space-y-1"><Label>Quantité (+entrée / -sortie)</Label><Input type="number" value={mvtDelta} onChange={e => setMvtDelta(e.target.value)} placeholder="+10 ou -5" /></div>
            <div className="space-y-1"><Label>Motif</Label><Input value={mvtMotif} onChange={e => setMvtMotif(e.target.value)} placeholder="Inventaire, perte, correction..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMvtDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => mvtTarget && mvtMutation.mutate({ id: mvtTarget.id, delta: Number(mvtDelta), motif: mvtMotif })} disabled={!mvtDelta || mvtMutation.isPending}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────
// ONGLET COMMANDES
// ─────────────────────────────────────────
function CommandesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null);
  const [iaGenerating, setIaGenerating] = useState(false);
  const [iaResult, setIaResult] = useState<{ notesIA: string; commandeId: number; numeroCommande: string } | null>(null);

  const { data: commandes = [], isLoading } = useQuery<Commande[]>({
    queryKey: ["commandes"],
    queryFn: () => fetch(`${API_BASE}/stock/commandes`).then(r => r.json()),
  });

  const { data: commandeDetail } = useQuery<Commande>({
    queryKey: ["commande-detail", selectedCommande?.id],
    queryFn: () => fetch(`${API_BASE}/stock/commandes/${selectedCommande?.id}`).then(r => r.json()),
    enabled: !!selectedCommande?.id && detailOpen,
  });

  const updateStatutMutation = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: string }) =>
      fetch(`${API_BASE}/stock/commandes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["commandes"] }); toast({ title: "Commande mise à jour" }); },
  });

  const genererIACommande = async () => {
    setIaGenerating(true);
    try {
      const r = await fetch(`${API_BASE}/stock/ia/generer-commande-suggeree`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error ?? "Erreur", variant: "destructive" }); return; }
      setIaResult(data);
      qc.invalidateQueries({ queryKey: ["commandes"] });
      toast({ title: `Commande ${data.numeroCommande} créée par l'IA` });
    } catch {
      toast({ title: "Erreur IA", variant: "destructive" });
    } finally {
      setIaGenerating(false);
    }
  };

  const exportTransNet = async (id: number, numero: string) => {
    try {
      const r = await fetch(`${API_BASE}/stock/commandes/${id}/exporter-centravet`, { method: "POST" });
      if (!r.ok) { toast({ title: "Erreur export", variant: "destructive" }); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `TransNet-${numero}.csv`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      toast({ title: `Export TransNet généré : ${numero}` });
      qc.invalidateQueries({ queryKey: ["commandes"] });
    } catch { toast({ title: "Erreur lors de l'export", variant: "destructive" }); }
  };

  const openDetail = (c: Commande) => { setSelectedCommande(c); setDetailOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <h2 className="text-base font-semibold">Commandes CENTRAVET</h2>
        <div className="flex gap-2">
          <Button onClick={genererIACommande} disabled={iaGenerating} className="bg-purple-600 hover:bg-purple-700 text-white">
            {iaGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
            Générer commande IA
          </Button>
        </div>
      </div>

      {iaResult && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-purple-800">Commande IA : {iaResult.numeroCommande}</p>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIaResult(null)}><X className="h-4 w-4" /></Button>
            </div>
            <pre className="text-xs whitespace-pre-wrap text-purple-700 bg-white rounded p-2 max-h-32 overflow-y-auto">{iaResult.notesIA}</pre>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : commandes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Aucune commande</p></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left p-3 font-medium">N° commande</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Statut</th>
                <th className="text-right p-3 font-medium hidden md:table-cell">Montant HT</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Livraison prévue</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Date création</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commandes.map(c => {
                const cfg = STATUT_COMMANDE_LABELS[c.statut] ?? { label: c.statut, color: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/10">
                    <td className="p-3 font-mono font-semibold text-sm">{c.numeroCommande}</td>
                    <td className="p-3 text-muted-foreground text-xs">{c.typeDeclenchement === "ia_automatique" ? "IA" : c.typeDeclenchement === "urgence" ? "Urgence" : "Manuel"}</td>
                    <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span></td>
                    <td className="p-3 text-right hidden md:table-cell">{c.montantTotalHT ? `${c.montantTotalHT.toFixed(2)} €` : "—"}</td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell">{c.dateLivraisonPrevue ? new Date(c.dateLivraisonPrevue).toLocaleDateString("fr-FR") : "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">{new Date(c.dateCreation).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDetail(c)} title="Voir détail"><Eye className="h-3.5 w-3.5" /></Button>
                        {c.statut === "brouillon" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatutMutation.mutate({ id: c.id, statut: "validee" })}>Valider</Button>
                        )}
                        {c.statut === "validee" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatutMutation.mutate({ id: c.id, statut: "envoyee_centravet" })}>Envoyer</Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exportTransNet(c.id, c.numeroCommande)} title="Export TransNet CSV"><Download className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Commande {commandeDetail?.numeroCommande}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            {commandeDetail?.notesIA && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-purple-700 mb-1">Analyse IA</p>
                <pre className="text-xs whitespace-pre-wrap text-purple-800">{commandeDetail.notesIA}</pre>
              </div>
            )}
            {commandeDetail?.lignes && (
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium">Produit</th>
                      <th className="text-left p-2 font-medium">Réf.</th>
                      <th className="text-right p-2 font-medium">Qté cde</th>
                      <th className="text-right p-2 font-medium">Qté reçue</th>
                      <th className="text-right p-2 font-medium">PA HT</th>
                      <th className="text-center p-2 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commandeDetail.lignes.map(l => (
                      <tr key={l.id} className="border-b last:border-b-0">
                        <td className="p-2 font-medium">{l.nomMedicament}</td>
                        <td className="p-2 text-muted-foreground font-mono text-xs">{l.referenceCentravet ?? "—"}</td>
                        <td className="p-2 text-right">{l.quantiteCommandee} {l.unite ?? ""}</td>
                        <td className="p-2 text-right">{l.quantiteRecue ?? 0}</td>
                        <td className="p-2 text-right">{l.prixUnitaireHT ? `${l.prixUnitaireHT.toFixed(2)} €` : "—"}</td>
                        <td className="p-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${l.statutLigne === "recue_complete" ? "bg-green-100 text-green-700" : l.statutLigne === "manquante" || l.statutLigne === "rupture_centravet" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                            {l.statutLigne}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fermer</Button>
            {commandeDetail && <Button variant="outline" onClick={() => exportTransNet(commandeDetail.id, commandeDetail.numeroCommande)}><Download className="h-4 w-4 mr-2" />Export TransNet CSV</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────
// ONGLET RÉCEPTION
// ─────────────────────────────────────────
function ReceptionTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [commandeId, setCommandeId] = useState("");
  const [numeroBL, setNumeroBL] = useState("");
  const [dateLivraison, setDateLivraison] = useState(new Date().toISOString().split("T")[0]);
  const [validePar, setValidePar] = useState("");
  const [lignesReception, setLignesReception] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: commandes = [] } = useQuery<Commande[]>({
    queryKey: ["commandes"],
    queryFn: () => fetch(`${API_BASE}/stock/commandes`).then(r => r.json()),
  });

  const { data: commandeDetail } = useQuery<Commande>({
    queryKey: ["commande-detail-reception", commandeId],
    queryFn: () => fetch(`${API_BASE}/stock/commandes/${commandeId}`).then(r => r.json()),
    enabled: !!commandeId,
    select: (data) => {
      if (data?.lignes) {
        setLignesReception(data.lignes.filter((l: LigneCommande) => l.statutLigne === "en_attente").map((l: LigneCommande) => ({
          ligneId: l.id, medicamentId: l.medicamentId, nom: l.nomMedicament,
          referenceCentravet: l.referenceCentravet, unite: l.unite,
          quantiteCommandee: l.quantiteCommandee, quantiteRecue: l.quantiteCommandee,
          lotNumero: "", datePeremption: "",
        })));
      }
      return data;
    },
  });

  const commandesEnAttente = commandes.filter(c =>
    ["validee", "envoyee_centravet", "en_cours_livraison"].includes(c.statut)
  );

  const validerReception = async () => {
    if (!commandeId || lignesReception.length === 0) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/stock/reception`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandeId: parseInt(commandeId), numeroBL, dateLivraison, validePar, lignes: lignesReception }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Réception validée — stock mis à jour" });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["commandes"] });
      setCommandeId(""); setLignesReception([]);
    } catch {
      toast({ title: "Erreur lors de la réception", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateLigne = (idx: number, field: string, value: any) => {
    setLignesReception(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Commande à réceptionner *</Label>
            <Select value={commandeId} onValueChange={setCommandeId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une commande..." /></SelectTrigger>
              <SelectContent>
                {commandesEnAttente.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.numeroCommande} — {STATUT_COMMANDE_LABELS[c.statut]?.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>N° bon de livraison</Label><Input value={numeroBL} onChange={e => setNumeroBL(e.target.value)} placeholder="BL-CENTRAVET-XXXXX" /></div>
          <div className="space-y-1"><Label>Date de livraison</Label><Input type="date" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)} /></div>
          <div className="space-y-1"><Label>Validé par (ASV)</Label><Input value={validePar} onChange={e => setValidePar(e.target.value)} placeholder="Prénom Nom" /></div>
        </div>

        {lignesReception.length > 0 && (
          <div className="space-y-1">
            <Label>Récapitulatif commande</Label>
            <div className="bg-muted/30 rounded-lg p-3 text-sm">
              <p className="font-semibold">{commandeDetail?.numeroCommande}</p>
              <p className="text-muted-foreground">{lignesReception.length} lignes à réceptionner</p>
              <p className="text-muted-foreground">Livraison prévue : {commandeDetail?.dateLivraisonPrevue ? new Date(commandeDetail.dateLivraisonPrevue).toLocaleDateString("fr-FR") : "—"}</p>
            </div>
          </div>
        )}
      </div>

      {lignesReception.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="text-left p-2 font-medium">Produit</th>
                  <th className="text-left p-2 font-medium hidden md:table-cell">Réf.</th>
                  <th className="text-right p-2 font-medium">Qté cde</th>
                  <th className="text-right p-2 font-medium">Qté reçue</th>
                  <th className="text-left p-2 font-medium">N° lot</th>
                  <th className="text-left p-2 font-medium">Expiration</th>
                </tr>
              </thead>
              <tbody>
                {lignesReception.map((l, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="p-2 font-medium">{l.nom}</td>
                    <td className="p-2 text-muted-foreground font-mono text-xs hidden md:table-cell">{l.referenceCentravet ?? "—"}</td>
                    <td className="p-2 text-right text-muted-foreground">{l.quantiteCommandee} {l.unite ?? ""}</td>
                    <td className="p-2">
                      <Input type="number" className="h-8 w-24 ml-auto" value={l.quantiteRecue} onChange={e => updateLigne(i, "quantiteRecue", Number(e.target.value))} />
                    </td>
                    <td className="p-2"><Input className="h-8 w-32" value={l.lotNumero} onChange={e => updateLigne(i, "lotNumero", e.target.value)} placeholder="Lot..." /></td>
                    <td className="p-2"><Input type="date" className="h-8" value={l.datePeremption} onChange={e => updateLigne(i, "datePeremption", e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={validerReception} disabled={saving || !validePar} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Valider la réception et mettre à jour le stock
          </Button>
        </>
      )}

      {commandeId && lignesReception.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-400" />
          <p>Toutes les lignes de cette commande ont déjà été réceptionnées</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// ONGLET MOUVEMENTS
// ─────────────────────────────────────────
function MouvementsTab() {
  const [selectedMedId, setSelectedMedId] = useState("");

  const { data: stock = [] } = useQuery<Medicament[]>({
    queryKey: ["stock"],
    queryFn: () => fetch(`${API_BASE}/stock`).then(r => r.json()),
  });

  const { data: mouvements = [], isLoading } = useQuery<any[]>({
    queryKey: ["mouvements", selectedMedId],
    queryFn: () => fetch(`${API_BASE}/stock/${selectedMedId}/mouvements`).then(r => r.json()),
    enabled: !!selectedMedId,
  });

  const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    entree_reception: { label: "Entrée réception", color: "text-green-700 bg-green-100" },
    sortie_consultation: { label: "Sortie consultation", color: "text-red-700 bg-red-100" },
    sortie_vente: { label: "Sortie vente", color: "text-orange-700 bg-orange-100" },
    perte_peremption: { label: "Perte péremption", color: "text-gray-700 bg-gray-100" },
    ajustement_inventaire: { label: "Ajustement inventaire", color: "text-blue-700 bg-blue-100" },
    retour_fournisseur: { label: "Retour fournisseur", color: "text-purple-700 bg-purple-100" },
  };

  return (
    <div className="space-y-4">
      <div className="max-w-sm space-y-1">
        <Label>Sélectionner un produit</Label>
        <Select value={selectedMedId} onValueChange={setSelectedMedId}>
          <SelectTrigger><SelectValue placeholder="Choisir un produit..." /></SelectTrigger>
          <SelectContent>
            {stock.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedMedId && isLoading && <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}

      {selectedMedId && !isLoading && mouvements.length === 0 && (
        <div className="text-center py-10 text-muted-foreground"><Activity className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>Aucun mouvement enregistré</p></div>
      )}

      {mouvements.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-right p-3 font-medium">Quantité</th>
                <th className="text-right p-3 font-medium hidden md:table-cell">Prix unit. HT</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Motif</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.map(m => {
                const cfg = TYPE_LABELS[m.typeMouvement] ?? { label: m.typeMouvement, color: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={m.id} className="border-b last:border-b-0">
                    <td className="p-3 text-sm">{new Date(m.createdAt).toLocaleString("fr-FR")}</td>
                    <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span></td>
                    <td className={`p-3 text-right font-semibold ${m.quantite > 0 ? "text-green-600" : "text-red-600"}`}>{m.quantite > 0 ? "+" : ""}{m.quantite}</td>
                    <td className="p-3 text-right text-muted-foreground hidden md:table-cell">{m.prixUnitaireHT ? `${m.prixUnitaireHT.toFixed(2)} €` : "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs hidden md:table-cell truncate max-w-[200px]">{m.motif ?? "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell">{m.utilisateur ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────
export default function StockPage() {
  const { data: stock = [] } = useQuery<Medicament[]>({
    queryKey: ["stock"],
    queryFn: () => fetch(`${API_BASE}/stock`).then(r => r.json()),
  });

  const { data: alertes = [] } = useQuery<Alerte[]>({
    queryKey: ["alertes-stock", "actives"],
    queryFn: () => fetch(`${API_BASE}/stock/alertes?traitee=false`).then(r => r.json()),
  });

  const { data: commandes = [] } = useQuery<Commande[]>({
    queryKey: ["commandes"],
    queryFn: () => fetch(`${API_BASE}/stock/commandes`).then(r => r.json()),
  });

  const ruptures = stock.filter(m => m.quantiteStock === 0).length;
  const stockBas = stock.filter(m => m.quantiteStock > 0 && m.quantiteStock <= (m.pointCommande ?? m.quantiteMinimum)).length;
  const enCommande = commandes.filter(c => ["validee", "envoyee_centravet", "en_cours_livraison"].includes(c.statut)).length;
  const alertesCritiques = alertes.filter(a => a.niveauUrgence === "critique").length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion du stock</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Module JIT — CENTRAVET / TransNet</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Produits en rupture" value={ruptures} icon={AlertTriangle} color="bg-red-100 text-red-600" sub={`sur ${stock.length} produits`} />
        <KpiCard title="Stock bas" value={stockBas} icon={Package} color="bg-orange-100 text-orange-600" sub="sous le point de commande" />
        <KpiCard title="Commandes en cours" value={enCommande} icon={ShoppingCart} color="bg-blue-100 text-blue-600" sub="chez CENTRAVET" />
        <KpiCard title="Alertes actives" value={alertes.length} icon={Activity} color={alertesCritiques > 0 ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-600"} sub={alertesCritiques > 0 ? `${alertesCritiques} critiques` : "en attente"} />
      </div>

      <Tabs defaultValue="alertes">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="alertes" className="relative">
            Alertes
            {alertes.length > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold ${alertesCritiques > 0 ? "bg-red-500 text-white" : "bg-orange-400 text-white"}`}>{alertes.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="produits">Produits ({stock.length})</TabsTrigger>
          <TabsTrigger value="commandes" className="relative">
            Commandes
            {enCommande > 0 && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-blue-500 text-white font-semibold">{enCommande}</span>}
          </TabsTrigger>
          <TabsTrigger value="reception"><Truck className="h-4 w-4 mr-1.5" />Réception</TabsTrigger>
          <TabsTrigger value="mouvements"><Activity className="h-4 w-4 mr-1.5" />Mouvements</TabsTrigger>
        </TabsList>

        <TabsContent value="alertes" className="mt-4"><AlertesTab /></TabsContent>
        <TabsContent value="produits" className="mt-4"><ProduitsTab /></TabsContent>
        <TabsContent value="commandes" className="mt-4"><CommandesTab /></TabsContent>
        <TabsContent value="reception" className="mt-4"><ReceptionTab /></TabsContent>
        <TabsContent value="mouvements" className="mt-4"><MouvementsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
