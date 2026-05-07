import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Plus, FileText, CheckCircle2, Package, Trash2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function fmt(n: number | string) { return Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }); }

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  RECUE: "Reçue",
  ANNULEE: "Annulée",
};
const STATUS_COLORS: Record<string, string> = {
  BROUILLON: "bg-gray-100 text-gray-700",
  ENVOYEE: "bg-blue-100 text-blue-700",
  RECUE: "bg-green-100 text-green-700",
  ANNULEE: "bg-red-100 text-red-700",
};

interface Ligne { designation: string; reference: string; quantity: string; unitPrice: string; tvaRate: string; stockItemId?: number; }

export default function FournisseursPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("fournisseurs");
  const [fournDialog, setFournDialog] = useState<any>(null);
  const [cmdDialog, setCmdDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState<any>(null);
  const [fournForm, setFournForm] = useState<any>({});
  const [cmdForm, setCmdForm] = useState<any>({ fournisseurId: "", notes: "", expectedDate: "" });
  const [lignes, setLignes] = useState<Ligne[]>([{ designation: "", reference: "", quantity: "1", unitPrice: "0", tvaRate: "20" }]);

  const { data: fournData } = useQuery({ queryKey: ["fournisseurs"], queryFn: async () => { const r = await fetch(`${API_BASE}/api/fournisseurs`); return r.json(); } });
  const fournisseurs: any[] = fournData?.data ?? [];

  const { data: cmdData, isLoading: cmdLoading } = useQuery({
    queryKey: ["commandes", tab],
    queryFn: async () => { const r = await fetch(`${API_BASE}/api/fournisseurs/commandes`); return r.json(); },
    enabled: tab === "commandes",
  });
  const commandes: any[] = cmdData?.data ?? [];

  const saveFournMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = payload.id ? `${API_BASE}/api/fournisseurs/${payload.id}` : `${API_BASE}/api/fournisseurs`;
      const r = await fetch(url, { method: payload.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Fournisseur enregistré" }); qc.invalidateQueries({ queryKey: ["fournisseurs"] }); setFournDialog(null); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const createCmdMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`${API_BASE}/api/fournisseurs/commandes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("Erreur création commande");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Commande créée" }); qc.invalidateQueries({ queryKey: ["commandes"] }); setCmdDialog(false); setCmdForm({ fournisseurId: "", notes: "", expectedDate: "" }); setLignes([{ designation: "", reference: "", quantity: "1", unitPrice: "0", tvaRate: "20" }]); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`${API_BASE}/api/fournisseurs/commandes/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error("Erreur");
      return r.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: vars.status === "RECUE" ? "Commande reçue — stock mis à jour" : "Statut mis à jour" });
      qc.invalidateQueries({ queryKey: ["commandes"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const loadDetail = async (id: number) => {
    const r = await fetch(`${API_BASE}/api/fournisseurs/commandes/${id}`);
    const d = await r.json();
    setDetailDialog(d.data);
  };

  const totalCmd = lignes.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);
  const addLigne = () => setLignes([...lignes, { designation: "", reference: "", quantity: "1", unitPrice: "0", tvaRate: "20" }]);
  const removeLigne = (i: number) => setLignes(lignes.filter((_, idx) => idx !== i));
  const updateLigne = (i: number, field: keyof Ligne, value: string) => {
    const updated = [...lignes];
    updated[i] = { ...updated[i], [field]: value };
    setLignes(updated);
  };

  const printBonCommande = () => {
    if (!detailDialog) return;
    const { commande: c, lignes: ls } = detailDialog;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bon de commande ${c.order_number}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h1{font-size:18px;margin-bottom:4px}.header{display:flex;justify-content:space-between;margin-bottom:24px}.info{font-size:11px;color:#666}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f3f4f6;padding:8px;text-align:left;font-size:11px}td{padding:8px;border-bottom:1px solid #e5e7eb}.total{text-align:right;margin-top:16px;font-size:14px}</style>
    </head><body>
    <div class="header"><div><h1>Bon de commande</h1><div>${c.order_number}</div><div class="info">Date : ${new Date(c.order_date).toLocaleDateString("fr-FR")}</div>${c.expected_date ? `<div class="info">Livraison souhaitée : ${new Date(c.expected_date).toLocaleDateString("fr-FR")}</div>` : ''}</div>
    <div><strong>Fournisseur :</strong><br>${c.fournisseur_name}<br>${c.fournisseur_email||''}</div></div>
    <table><thead><tr><th>Désignation</th><th>Référence</th><th>Qté</th><th>PU HT</th><th>Total HT</th></tr></thead><tbody>
    ${ls.map((l: any) => `<tr><td>${l.designation}</td><td>${l.reference||'–'}</td><td>${Number(l.quantity).toFixed(2)}</td><td>${fmt(l.unit_price)}</td><td>${fmt(l.total_ht)}</td></tr>`).join('')}
    </tbody></table>
    <div class="total"><div>Total HT : <strong>${fmt(c.total_ht)}</strong></div><div>TVA : <strong>${fmt(c.total_tva)}</strong></div><div style="font-size:16px;font-weight:bold">Total TTC : ${fmt(c.total_ttc)}</div></div>
    ${c.notes ? `<p style="margin-top:24px;font-size:11px;color:#666">Notes : ${c.notes}</p>` : ''}
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6 text-indigo-600" />Fournisseurs & Commandes</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestion des fournisseurs et bons de commande</p>
        </div>
        <div className="flex gap-2">
          {tab === "fournisseurs" && <Button onClick={() => { setFournForm({}); setFournDialog({}); }}><Plus className="h-4 w-4 mr-2" />Nouveau fournisseur</Button>}
          {tab === "commandes" && <Button onClick={() => setCmdDialog(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle commande</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="fournisseurs">Fournisseurs ({fournisseurs.length})</TabsTrigger>
          <TabsTrigger value="commandes">Bons de commande</TabsTrigger>
        </TabsList>

        {/* Fournisseurs */}
        <TabsContent value="fournisseurs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fournisseurs.map(f => (
              <Card key={f.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setFournForm(f); setFournDialog(f); }}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="font-semibold">{f.name}</div>
                    <Badge variant="secondary" className="text-xs">{f.nb_commandes} cmd</Badge>
                  </div>
                  {f.contact && <div className="text-sm text-muted-foreground">{f.contact}</div>}
                  {f.email && <div className="text-xs text-blue-600">{f.email}</div>}
                  {f.phone && <div className="text-xs text-muted-foreground">{f.phone}</div>}
                  {f.derniere_commande && <div className="text-xs text-muted-foreground">Dernière commande : {new Date(f.derniere_commande).toLocaleDateString("fr-FR")}</div>}
                </CardContent>
              </Card>
            ))}
            {fournisseurs.length === 0 && <div className="col-span-3 text-center py-12 text-muted-foreground">Aucun fournisseur — créez-en un</div>}
          </div>
        </TabsContent>

        {/* Commandes */}
        <TabsContent value="commandes">
          <Card><CardContent className="p-0">
            {cmdLoading ? <div className="text-center py-8 text-muted-foreground">Chargement…</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="text-left p-3 font-medium">N° commande</th>
                      <th className="text-left p-3 font-medium">Fournisseur</th>
                      <th className="text-center p-3 font-medium">Date</th>
                      <th className="text-center p-3 font-medium">Livraison</th>
                      <th className="text-right p-3 font-medium">Total TTC</th>
                      <th className="text-center p-3 font-medium">Statut</th>
                      <th className="text-center p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commandes.map(c => (
                      <tr key={c.id} className="border-b hover:bg-muted/20">
                        <td className="p-3 font-mono font-medium">{c.order_number}</td>
                        <td className="p-3">{c.fournisseur_name}</td>
                        <td className="p-3 text-center text-muted-foreground">{new Date(c.order_date).toLocaleDateString("fr-FR")}</td>
                        <td className="p-3 text-center text-muted-foreground">{c.expected_date ? new Date(c.expected_date).toLocaleDateString("fr-FR") : "—"}</td>
                        <td className="p-3 text-right font-bold">{fmt(c.total_ttc)}</td>
                        <td className="p-3 text-center"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[c.status]||""}`}>{STATUS_LABELS[c.status]||c.status}</span></td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => loadDetail(c.id)}><FileText className="h-3 w-3" /></Button>
                            {c.status === "BROUILLON" && <Button size="sm" variant="outline" className="text-xs" onClick={() => statusMutation.mutate({ id: c.id, status: "ENVOYEE" })}>Envoyée</Button>}
                            {c.status === "ENVOYEE" && <Button size="sm" variant="outline" className="text-xs text-green-600" onClick={() => statusMutation.mutate({ id: c.id, status: "RECUE" })}><Package className="h-3 w-3 mr-1" />Réceptionnée</Button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {commandes.length === 0 && <div className="text-center py-8 text-muted-foreground">Aucune commande</div>}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Fournisseur */}
      <Dialog open={!!fournDialog} onOpenChange={o => !o && setFournDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{fournForm.id ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><label className="text-sm font-medium">Nom *</label><Input value={fournForm.name||""} onChange={e => setFournForm({...fournForm, name: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Contact</label><Input value={fournForm.contact||""} onChange={e => setFournForm({...fournForm, contact: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Email</label><Input type="email" value={fournForm.email||""} onChange={e => setFournForm({...fournForm, email: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Téléphone</label><Input value={fournForm.phone||""} onChange={e => setFournForm({...fournForm, phone: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-medium">SIRET</label><Input value={fournForm.siret||""} onChange={e => setFournForm({...fournForm, siret: e.target.value})} /></div>
            <div className="col-span-2 space-y-1"><label className="text-sm font-medium">Adresse</label><Input value={fournForm.address||""} onChange={e => setFournForm({...fournForm, address: e.target.value})} /></div>
            <div className="col-span-2 space-y-1"><label className="text-sm font-medium">Conditions de paiement</label><Input value={fournForm.paymentConditions||""} onChange={e => setFournForm({...fournForm, paymentConditions: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFournDialog(null)}>Annuler</Button>
            <Button onClick={() => saveFournMutation.mutate(fournForm)} disabled={saveFournMutation.isPending || !fournForm.name}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nouvelle Commande */}
      <Dialog open={cmdDialog} onOpenChange={o => !o && setCmdDialog(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvelle commande fournisseur</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1"><label className="text-sm font-medium">Fournisseur *</label>
                <Select value={cmdForm.fournisseurId} onValueChange={v => setCmdForm({...cmdForm, fournisseurId: v})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>{fournisseurs.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="text-sm font-medium">Livraison souhaitée</label><Input type="date" value={cmdForm.expectedDate} onChange={e => setCmdForm({...cmdForm, expectedDate: e.target.value})} /></div>
            </div>

            {/* Lignes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Lignes de commande *</label>
                <Button size="sm" variant="outline" onClick={addLigne}><Plus className="h-3 w-3 mr-1" />Ligne</Button>
              </div>
              <div className="space-y-2">
                {lignes.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4"><Input placeholder="Désignation" value={l.designation} onChange={e => updateLigne(i, "designation", e.target.value)} /></div>
                    <div className="col-span-2"><Input placeholder="Référence" value={l.reference} onChange={e => updateLigne(i, "reference", e.target.value)} /></div>
                    <div className="col-span-2"><Input type="number" placeholder="Qté" value={l.quantity} onChange={e => updateLigne(i, "quantity", e.target.value)} /></div>
                    <div className="col-span-2"><Input type="number" step="0.01" placeholder="PU HT" value={l.unitPrice} onChange={e => updateLigne(i, "unitPrice", e.target.value)} /></div>
                    <div className="col-span-1 text-right text-sm text-muted-foreground">{fmt(Number(l.quantity) * Number(l.unitPrice))}</div>
                    <div className="col-span-1 flex justify-end"><Button size="sm" variant="ghost" onClick={() => removeLigne(i)} disabled={lignes.length === 1}><Trash2 className="h-3 w-3" /></Button></div>
                  </div>
                ))}
              </div>
              <div className="text-right mt-2 font-bold">Total HT : {fmt(totalCmd)} — TTC : {fmt(totalCmd * 1.20)}</div>
            </div>

            <div className="space-y-1"><label className="text-sm font-medium">Notes</label><Input value={cmdForm.notes} onChange={e => setCmdForm({...cmdForm, notes: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCmdDialog(false)}>Annuler</Button>
            <Button onClick={() => createCmdMutation.mutate({ ...cmdForm, lignes })} disabled={createCmdMutation.isPending || !cmdForm.fournisseurId || lignes.some(l => !l.designation)}>
              Créer la commande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Détail commande */}
      <Dialog open={!!detailDialog} onOpenChange={o => !o && setDetailDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Commande {detailDialog?.commande?.order_number}</span>
              <Button size="sm" variant="outline" onClick={printBonCommande}><Printer className="h-3 w-3 mr-1" />Imprimer</Button>
            </DialogTitle>
          </DialogHeader>
          {detailDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Fournisseur :</span> <strong>{detailDialog.commande.fournisseur_name}</strong></div>
                <div><span className="text-muted-foreground">Statut :</span> <span className={`text-xs px-2 py-0.5 rounded ml-1 ${STATUS_COLORS[detailDialog.commande.status]||""}`}>{STATUS_LABELS[detailDialog.commande.status]}</span></div>
                <div><span className="text-muted-foreground">Date :</span> {new Date(detailDialog.commande.order_date).toLocaleDateString("fr-FR")}</div>
                {detailDialog.commande.expected_date && <div><span className="text-muted-foreground">Livraison :</span> {new Date(detailDialog.commande.expected_date).toLocaleDateString("fr-FR")}</div>}
              </div>
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr><th className="text-left p-2">Désignation</th><th className="text-left p-2">Réf</th><th className="text-right p-2">Qté</th><th className="text-right p-2">PU HT</th><th className="text-right p-2">Total HT</th></tr>
                </thead>
                <tbody>
                  {detailDialog.lignes.map((l: any) => (
                    <tr key={l.id} className="border-b">
                      <td className="p-2">{l.designation}</td>
                      <td className="p-2 text-muted-foreground">{l.reference||"—"}</td>
                      <td className="p-2 text-right">{Number(l.quantity)}</td>
                      <td className="p-2 text-right">{fmt(l.unit_price)}</td>
                      <td className="p-2 text-right font-medium">{fmt(l.total_ht)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right space-y-1 text-sm">
                <div>HT : {fmt(detailDialog.commande.total_ht)}</div>
                <div>TVA : {fmt(detailDialog.commande.total_tva)}</div>
                <div className="text-base font-bold">TTC : {fmt(detailDialog.commande.total_ttc)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
