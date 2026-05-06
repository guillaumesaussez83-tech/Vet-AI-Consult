import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, Phone, Mail, MapPin, Euro } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CremationPartner {
  id: number;
  nom: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  tarifIndividuel?: string;
  tarifCollectif?: string;
  notes?: string;
  active: boolean;
}

const emptyPartner = (): Partial<CremationPartner> => ({ nom: "", adresse: "", telephone: "", email: "", tarifIndividuel: "", tarifCollectif: "", notes: "" });

export default function CremationPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CremationPartner | null>(null);
  const [form, setForm] = useState<Partial<CremationPartner>>(emptyPartner());
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: CremationPartner[] }>({
    queryKey: ["cremation-partners"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/cremation-partners`);
      if (!r.ok) throw new Error("Erreur chargement partenaires");
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (body: Partial<CremationPartner>) => {
      const r = await fetch(`${API_BASE}/api/cremation-partners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { toast.success("Partenaire ajouté"); qc.invalidateQueries({ queryKey: ["cremation-partners"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<CremationPartner> }) => {
      const r = await fetch(`${API_BASE}/api/cremation-partners/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { toast.success("Partenaire modifié"); qc.invalidateQueries({ queryKey: ["cremation-partners"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/api/cremation-partners/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { toast.success("Partenaire supprimé"); qc.invalidateQueries({ queryKey: ["cremation-partners"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => { setEditing(null); setForm(emptyPartner()); setOpen(true); };
  const openEdit = (p: CremationPartner) => { setEditing(p); setForm({ ...p }); setOpen(true); };
  const handleSave = () => {
    if (editing) {
      updateMut.mutate({ id: editing.id, body: form });
    } else {
      createMut.mutate(form);
    }
  };
  const upd = (k: keyof CremationPartner, v: string) => setForm(f => ({ ...f, [k]: v }));

  const partners = data?.data ?? [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Partenaires Crémation</h1>
          <p className="text-muted-foreground text-sm">Gérez vos prestataires de crémation animale</p>
        </div>
        <Button onClick={openCreate}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement...</p>}
      {!isLoading && partners.length === 0 && (
        <Card className="text-center py-12 text-muted-foreground">
          <CardContent>Aucun partenaire enregistré. Cliquez sur "Ajouter" pour commencer.</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map(p => (
          <Card key={p.id} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{p.nom}</CardTitle>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {p.adresse && <div className="flex gap-1.5 items-start text-muted-foreground"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{p.adresse}</span></div>}
              {p.telephone && <div className="flex gap-1.5 items-center text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{p.telephone}</span></div>}
              {p.email && <div className="flex gap-1.5 items-center text-muted-foreground"><Mail className="h-3.5 w-3.5 shrink-0" /><span>{p.email}</span></div>}
              <div className="flex gap-2 pt-1 flex-wrap">
                {p.tarifIndividuel && <Badge variant="outline"><Euro className="h-3 w-3 mr-1" />Individuelle: {p.tarifIndividuel}€</Badge>}
                {p.tarifCollectif && <Badge variant="secondary"><Euro className="h-3 w-3 mr-1" />Collective: {p.tarifCollectif}€</Badge>}
              </div>
              {p.notes && <p className="text-muted-foreground italic text-xs mt-1">{p.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le partenaire" : "Nouveau partenaire"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input value={form.nom || ""} onChange={e => upd("nom", e.target.value)} placeholder="Ex: Crématorium Animal Services" /></div>
            <div><Label>Adresse</Label><Input value={form.adresse || ""} onChange={e => upd("adresse", e.target.value)} placeholder="123 rue..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Téléphone</Label><Input value={form.telephone || ""} onChange={e => upd("telephone", e.target.value)} /></div>
              <div><Label>Email</Label><Input value={form.email || ""} onChange={e => upd("email", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tarif individuelle (€)</Label><Input type="number" step="0.01" value={form.tarifIndividuel || ""} onChange={e => upd("tarifIndividuel", e.target.value)} /></div>
              <div><Label>Tarif collective (€)</Label><Input type="number" step="0.01" value={form.tarifCollectif || ""} onChange={e => upd("tarifCollectif", e.target.value)} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes || ""} onChange={e => upd("notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
