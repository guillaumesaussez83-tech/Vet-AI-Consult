import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Plus, Trash2, CreditCard, Banknote, Smartphone, RotateCcw, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function fmt(n: number | string) { return Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }); }

const PAYMENT_METHODS = [
  { value: "ESPECES", label: "Espèces", icon: Banknote },
  { value: "CB", label: "Carte bancaire", icon: CreditCard },
  { value: "VIREMENT", label: "Virement", icon: Smartphone },
  { value: "CHEQUE", label: "Chèque", icon: Receipt },
];

interface CartItem { id: string; label: string; qty: number; unitPrice: number; tvaRate: number; }

export default function CaissePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("caisse");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quickItem, setQuickItem] = useState({ label: "", qty: "1", unitPrice: "", tvaRate: "20" });
  const [payMethod, setPayMethod] = useState("CB");
  const [payDialog, setPayDialog] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<any>(null);
  const [avoirDialog, setAvoirDialog] = useState(false);
  const [avoirForm, setAvoirForm] = useState({ invoiceId: "", motif: "", montant: "" });

  // Stock items for quick add
  const { data: stockData } = useQuery({
    queryKey: ["stock-caisse"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/api/stock`); return r.json(); },
  });
  const stockItems: any[] = stockData?.data?.items ?? [];

  // Today's ventes
  const { data: ventesData, isLoading: ventesLoading } = useQuery({
    queryKey: ["ventes-caisse", tab],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0,10);
      const r = await fetch(`${API_BASE}/api/ventes?from=${today}&to=${today}`);
      return r.json();
    },
    enabled: tab === "historique",
  });
  const ventes: any[] = ventesData?.data?.ventes ?? [];

  // Cart calculations
  const totalHT = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const totalTVA = cart.reduce((s, i) => s + i.qty * i.unitPrice * (i.tvaRate / 100), 0);
  const totalTTC = totalHT + totalTVA;
  const rendu = paidAmount ? Math.max(0, Number(paidAmount) - totalTTC) : 0;

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + item.qty } : i);
      return [...prev, item];
    });
  };

  const addQuickItem = () => {
    if (!quickItem.label || !quickItem.unitPrice) return;
    addToCart({
      id: `quick-${Date.now()}`,
      label: quickItem.label,
      qty: Number(quickItem.qty) || 1,
      unitPrice: Number(quickItem.unitPrice),
      tvaRate: Number(quickItem.tvaRate) || 20,
    });
    setQuickItem({ label: "", qty: "1", unitPrice: "", tvaRate: "20" });
  };

  const addStockItem = (item: any) => {
    addToCart({
      id: `stock-${item.id}`,
      label: item.name,
      qty: 1,
      unitPrice: Number(item.unit_price_sell) || Number(item.unit_price_buy),
      tvaRate: Number(item.tva_rate) || 20,
    });
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.id !== id));
    else setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  };

  const venteMutation = useMutation({
    mutationFn: async () => {
      const lignes = cart.map(i => ({
        designation: i.label,
        quantity: i.qty,
        unitPriceHt: i.unitPrice,
        tvaRate: i.tvaRate,
        totalHt: i.qty * i.unitPrice,
      }));
      const r = await fetch(`${API_BASE}/api/ventes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: selectedOwner?.id || null,
          paymentMethod: payMethod,
          lignes,
          totalHt: totalHT,
          totalTva: totalTVA,
          totalTtc: totalTTC,
          notes: `Vente comptoir`,
        }),
      });
      if (!r.ok) throw new Error("Erreur vente");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Vente enregistrée ✓", description: `${fmt(totalTTC)} encaissé` });
      setCart([]); setPayDialog(false); setPaidAmount(""); setSelectedOwner(null);
      qc.invalidateQueries({ queryKey: ["ventes-caisse"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const avoirMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`${API_BASE}/api/ventes/avoir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Erreur avoir");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Avoir créé" });
      setAvoirDialog(false);
      setAvoirForm({ invoiceId: "", motif: "", montant: "" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6 text-emerald-600" />Caisse comptoir</h1>
          <p className="text-muted-foreground text-sm mt-1">Vente rapide, encaissement et avoirs</p>
        </div>
        <Button variant="outline" onClick={() => setAvoirDialog(true)}><RotateCcw className="h-4 w-4 mr-2" />Créer un avoir</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="caisse">Caisse</TabsTrigger>
          <TabsTrigger value="historique">Ventes du jour</TabsTrigger>
        </TabsList>

        <TabsContent value="caisse">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panier gauche */}
            <div className="lg:col-span-2 space-y-4">
              {/* Ajout rapide */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Saisie rapide</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input placeholder="Désignation" value={quickItem.label} onChange={e => setQuickItem({...quickItem, label: e.target.value})} className="flex-1" onKeyDown={e => e.key === "Enter" && addQuickItem()} />
                    <Input type="number" placeholder="Prix HT" value={quickItem.unitPrice} onChange={e => setQuickItem({...quickItem, unitPrice: e.target.value})} className="w-28" onKeyDown={e => e.key === "Enter" && addQuickItem()} />
                    <Input type="number" placeholder="Qté" value={quickItem.qty} onChange={e => setQuickItem({...quickItem, qty: e.target.value})} className="w-16" onKeyDown={e => e.key === "Enter" && addQuickItem()} />
                    <Button onClick={addQuickItem} disabled={!quickItem.label || !quickItem.unitPrice}><Plus className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>

              {/* Articles depuis stock */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Ajouter depuis le stock</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {stockItems.filter(i => Number(i.current_stock) > 0).map(i => (
                      <button key={i.id} onClick={() => addStockItem(i)}
                        className="text-left p-2 border rounded hover:bg-muted/40 transition-colors text-sm">
                        <div className="font-medium truncate">{i.name}</div>
                        <div className="text-xs text-muted-foreground">{fmt(i.unit_price_sell || i.unit_price_buy)}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Panier */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Panier ({cart.length} article{cart.length > 1 ? "s" : ""})</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Panier vide — ajoutez des articles</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/40">
                        <tr><th className="text-left p-3">Article</th><th className="text-center p-3">Qté</th><th className="text-right p-3">PU HT</th><th className="text-right p-3">Total HT</th><th className="p-3"></th></tr>
                      </thead>
                      <tbody>
                        {cart.map(item => (
                          <tr key={item.id} className="border-b">
                            <td className="p-3 font-medium">{item.label}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => updateQty(item.id, item.qty - 1)}>−</Button>
                                <span className="w-8 text-center">{item.qty}</span>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => updateQty(item.id, item.qty + 1)}>+</Button>
                              </div>
                            </td>
                            <td className="p-3 text-right">{fmt(item.unitPrice)}</td>
                            <td className="p-3 text-right font-bold">{fmt(item.qty * item.unitPrice)}</td>
                            <td className="p-3"><Button size="sm" variant="ghost" onClick={() => setCart(c => c.filter(i => i.id !== item.id))}><Trash2 className="h-3 w-3 text-red-400" /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Résumé & paiement droite */}
            <div className="space-y-4">
              {/* Client optionnel */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Client (optionnel)</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {selectedOwner ? (
                    <div className="flex items-center justify-between bg-muted/40 rounded p-2">
                      <span className="text-sm font-medium">{selectedOwner.last_name} {selectedOwner.first_name}</span>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedOwner(null)}>×</Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Vente comptant sans client enregistré</div>
                  )}
                </CardContent>
              </Card>

              {/* Mode de paiement */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Mode de paiement</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m.value} onClick={() => setPayMethod(m.value)}
                        className={`flex items-center gap-2 p-2 border rounded text-sm transition-all ${payMethod === m.value ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "hover:bg-muted/40"}`}>
                        <m.icon className="h-4 w-4" />{m.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Total */}
              <Card className={cart.length > 0 ? "border-green-300" : ""}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total HT</span><span>{fmt(totalHT)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA</span><span>{fmt(totalTVA)}</span></div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total TTC</span><span className="text-green-600">{fmt(totalTTC)}</span></div>

                  {payMethod === "ESPECES" && (
                    <div className="space-y-1 pt-2 border-t">
                      <label className="text-xs text-muted-foreground">Montant remis</label>
                      <Input type="number" step="0.01" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0,00" />
                      {Number(paidAmount) > 0 && <div className="text-sm font-medium text-green-600">Rendu : {fmt(rendu)}</div>}
                    </div>
                  )}

                  <Button className="w-full mt-2" size="lg" disabled={cart.length === 0 || venteMutation.isPending}
                    onClick={() => venteMutation.mutate()}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {venteMutation.isPending ? "Enregistrement…" : `Encaisser ${fmt(totalTTC)}`}
                  </Button>
                  {cart.length > 0 && <Button variant="ghost" className="w-full text-red-500 text-sm" onClick={() => setCart([])}>Vider le panier</Button>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historique">
          <Card><CardContent className="p-0">
            {ventesLoading ? <div className="text-center py-8 text-muted-foreground">Chargement…</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="text-left p-3 font-medium">Heure</th>
                      <th className="text-left p-3 font-medium">Client</th>
                      <th className="text-center p-3 font-medium">Mode</th>
                      <th className="text-right p-3 font-medium">Total TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventes.map((v: any) => (
                      <tr key={v.id} className="border-b hover:bg-muted/20">
                        <td className="p-3 text-muted-foreground">{new Date(v.created_at||v.sale_date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="p-3">{v.owner_name || <span className="text-muted-foreground">Comptant</span>}</td>
                        <td className="p-3 text-center"><Badge variant="outline" className="text-xs">{v.payment_method}</Badge></td>
                        <td className="p-3 text-right font-bold">{fmt(v.total_ttc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ventes.length === 0 && <div className="text-center py-8 text-muted-foreground">Aucune vente aujourd'hui</div>}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Avoir */}
      <Dialog open={avoirDialog} onOpenChange={o => !o && setAvoirDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="h-4 w-4" />Créer un avoir</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><label className="text-sm font-medium">N° de facture à avoir</label><Input placeholder="ex: FAC-2025-0042" value={avoirForm.invoiceId} onChange={e => setAvoirForm({...avoirForm, invoiceId: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Montant TTC de l'avoir</label><Input type="number" step="0.01" value={avoirForm.montant} onChange={e => setAvoirForm({...avoirForm, montant: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Motif</label><Input placeholder="Retour produit, erreur de facturation…" value={avoirForm.motif} onChange={e => setAvoirForm({...avoirForm, motif: e.target.value})} /></div>
            <p className="text-xs text-muted-foreground">L'avoir sera créé comme une facture négative et déduit du solde du client.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvoirDialog(false)}>Annuler</Button>
            <Button onClick={() => avoirMutation.mutate(avoirForm)} disabled={avoirMutation.isPending || !avoirForm.invoiceId || !avoirForm.montant}>
              Créer l'avoir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
