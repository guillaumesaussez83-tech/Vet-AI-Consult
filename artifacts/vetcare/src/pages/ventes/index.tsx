import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Plus, Trash2, Eye, ShoppingCart, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type VenteLigne = {
  id: number;
  venteId: number;
  produitId?: number;
  description: string;
  quantite: string;
  prixUnitaire: string;
  tvaTaux: string;
  montantHt: string;
  montantTtc: string;
};

type Vente = {
  id: number;
  clinicId: string;
  numero: string;
  type: "comptoir" | "prescription";
  assistantId?: number;
  patientId?: number;
  proprietaireId?: number;
  ordonnanceId?: number;
  notes?: string;
  montantHt: string;
  montantTva: string;
  montantTtc: string;
  statut: string;
  date: string;
  lignes?: VenteLigne[];
};

type LigneForm = {
  description: string;
  quantite: string;
  prixUnitaire: string;
  tvaTaux: string;
};

type VenteForm = {
  notes: string;
  lignes: LigneForm[];
};

const EMPTY_FORM: VenteForm = {
  notes: "",
  lignes: [{ description: "", quantite: "1", prixUnitaire: "0", tvaTaux: "20" }],
};

function computeLigne(l: LigneForm) {
  const qty = parseFloat(l.quantite) || 0;
  const pu = parseFloat(l.prixUnitaire) || 0;
  const tva = parseFloat(l.tvaTaux) || 0;
  const ht = Math.round(qty * pu * 100) / 100;
  const ttc = Math.round(ht * (1 + tva / 100) * 100) / 100;
  return { montantHt: ht.toFixed(2), montantTtc: ttc.toFixed(2) };
}

function computeTotals(lignes: LigneForm[]) {
  let totalHt = 0;
  let totalTtc = 0;
  for (const l of lignes) {
    const { montantHt, montantTtc } = computeLigne(l);
    totalHt += parseFloat(montantHt);
    totalTtc += parseFloat(montantTtc);
  }
  const totalTva = totalTtc - totalHt;
  return {
    montantHt: totalHt.toFixed(2),
    montantTva: totalTva.toFixed(2),
    montantTtc: totalTtc.toFixed(2),
  };
}

function VenteTab({ type }: { type: "comptoir" | "prescription" }) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [viewVente, setViewVente] = useState<Vente | null>(null);
  const [form, setForm] = useState<VenteForm>(EMPTY_FORM);

  async function authFetch(path: string, init?: RequestInit) {
    const token = await getToken();
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  const { data: ventes = [], isLoading } = useQuery<Vente[]>({
    queryKey: ["ventes", type],
    queryFn: async () => {
      const res = await authFetch(`/api/ventes?type=${type}`);
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const createVente = useMutation({
    mutationFn: async (payload: object) => {
      const res = await authFetch("/api/ventes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erreur création vente");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ventes", type] });
      setOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Vente créée" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de créer la vente", variant: "destructive" }),
  });

  const deleteVente = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/api/ventes/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ventes", type] });
      toast({ title: "Vente supprimée" });
    },
  });

  const fetchDetail = async (id: number) => {
    const res = await authFetch(`/api/ventes/${id}`);
    const json = await res.json();
    setViewVente(json.data);
  };

  function updateLigne(i: number, field: keyof LigneForm, value: string) {
    setForm((f) => {
      const lignes = [...f.lignes];
      lignes[i] = { ...lignes[i], [field]: value };
      return { ...f, lignes };
    });
  }

  function addLigne() {
    setForm((f) => ({
      ...f,
      lignes: [...f.lignes, { description: "", quantite: "1", prixUnitaire: "0", tvaTaux: "20" }],
    }));
  }

  function removeLigne(i: number) {
    setForm((f) => ({ ...f, lignes: f.lignes.filter((_, idx) => idx !== i) }));
  }

  function handleSubmit() {
    if (form.lignes.length === 0) return;
    const totals = computeTotals(form.lignes);
    const lignes = form.lignes.map((l) => {
      const { montantHt, montantTtc } = computeLigne(l);
      return {
        description: l.description,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        tvaTaux: l.tvaTaux,
        montantHt,
        montantTtc,
      };
    });
    createVente.mutate({ type, notes: form.notes, ...totals, lignes });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Chargement..." : `${ventes.length} vente(s)`}
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle vente
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Numéro</th>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-right px-4 py-2 font-medium">TTC</th>
              <th className="text-left px-4 py-2 font-medium">Statut</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {ventes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucune vente
                </td>
              </tr>
            )}
            {ventes.map((v) => (
              <tr key={v.id} className="border-t hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2 font-mono text-xs">{v.numero}</td>
                <td className="px-4 py-2">
                  {new Date(v.date).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-2 text-right font-semibold">
                  {parseFloat(v.montantTtc).toFixed(2)} €
                </td>
                <td className="px-4 py-2">
                  <Badge variant={v.statut === "completee" ? "default" : "secondary"}>
                    {v.statut}
                  </Badge>
                </td>
                <td className="px-4 py-2 flex gap-1 justify-end">
                  <Button variant="ghost" size="icon" onClick={() => fetchDetail(v.id).then(() => {})}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { if (confirm("Supprimer cette vente ?")) deleteVente.mutate(v.id); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle vente {type === "comptoir" ? "comptoir" : "sur prescription"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notes optionnelles..."
                rows={2}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Lignes</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLigne}>
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter
                </Button>
              </div>
              <div className="space-y-2">
                {form.lignes.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start border rounded p-2">
                    <div className="col-span-5">
                      <Input placeholder="Description" value={l.description} onChange={(e) => updateLigne(i, "description", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" placeholder="Qté" value={l.quantite} onChange={(e) => updateLigne(i, "quantite", e.target.value)} min="0" step="0.001" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" placeholder="P.U. HT" value={l.prixUnitaire} onChange={(e) => updateLigne(i, "prixUnitaire", e.target.value)} min="0" step="0.01" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" placeholder="TVA %" value={l.tvaTaux} onChange={(e) => updateLigne(i, "tvaTaux", e.target.value)} min="0" max="100" />
                    </div>
                    <div className="col-span-1 flex items-center">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLigne(i)} disabled={form.lignes.length === 1}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {form.lignes.length > 0 && (() => {
              const t = computeTotals(form.lignes);
              return (
                <div className="bg-muted/30 rounded p-3 text-sm space-y-1 text-right">
                  <div>HT : <strong>{t.montantHt} €</strong></div>
                  <div>TVA : <strong>{t.montantTva} €</strong></div>
                  <div className="text-base font-bold">TTC : {t.montantTtc} €</div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={createVente.isPending}>
              {createVente.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewVente} onOpenChange={(o) => !o && setViewVente(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Vente {viewVente?.numero}</DialogTitle>
          </DialogHeader>
          {viewVente && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{new Date(viewVente.date).toLocaleDateString("fr-FR")}</span>
              </div>
              {viewVente.notes && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Notes</span>
                  <span>{viewVente.notes}</span>
                </div>
              )}
              <div className="border rounded overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-1 text-xs">Description</th>
                      <th className="text-right px-3 py-1 text-xs">Qté</th>
                      <th className="text-right px-3 py-1 text-xs">P.U.</th>
                      <th className="text-right px-3 py-1 text-xs">TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewVente.lignes ?? []).map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="px-3 py-1">{l.description}</td>
                        <td className="px-3 py-1 text-right">{l.quantite}</td>
                        <td className="px-3 py-1 text-right">{parseFloat(l.prixUnitaire).toFixed(2)} €</td>
                        <td className="px-3 py-1 text-right">{parseFloat(l.montantTtc).toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-right space-y-1">
                <div>HT : <strong>{parseFloat(viewVente.montantHt).toFixed(2)} €</strong></div>
                <div>TVA : <strong>{parseFloat(viewVente.montantTva).toFixed(2)} €</strong></div>
                <div className="text-base font-bold">TTC : {parseFloat(viewVente.montantTtc).toFixed(2)} €</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewVente(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VentesPage() {
  const [tab, setTab] = useState<"comptoir" | "prescription">("comptoir");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Ventes</h1>
          <p className="text-muted-foreground text-sm">Gestion des ventes comptoir et sur prescription</p>
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-1">
          {(["comptoir", "prescription"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "comptoir" ? (
                <>
                  <ShoppingCart className="h-4 w-4 inline mr-1" />
                  Ventes comptoir
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 inline mr-1" />
                  Ventes sur prescription
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <VenteTab key={tab} type={tab} />
    </div>
  );
}
