import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, User, Clock } from "lucide-react";
import { useListPatients, useListOwners } from "@workspace/api-client-react";

const API_BASE = "/api";

type RDV = {
  id: number; dateHeure: string; dureeMinutes: number; patientId?: number; ownerId?: number;
  veterinaire?: string; motif?: string; statut: string; notes?: string;
  patient?: { id: number; nom: string; espece: string } | null;
  owner?: { id: number; nom: string; prenom?: string; telephone?: string } | null;
};

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const STATUTS = ["planifié", "confirmé", "en cours", "terminé", "annulé"];
const STATUT_COLORS: Record<string, string> = {
  "planifié": "bg-blue-100 text-blue-800 border-blue-200",
  "confirmé": "bg-green-100 text-green-800 border-green-200",
  "en cours": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "terminé": "bg-gray-100 text-gray-600 border-gray-200",
  "annulé": "bg-red-100 text-red-600 border-red-200",
};

function getWeekDates(ref: Date): Date[] {
  const dow = ref.getDay();
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const HOURS = Array.from({ length: 23 }, (_, i) => {
  const h = 8 + Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter(h => h <= "19:00");

const EMPTY_FORM = {
  dateHeure: "", dureeMinutes: 30, patientId: "", ownerId: "",
  veterinaire: "", motif: "", statut: "planifié", notes: "",
};

export default function AgendaPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date();
  const [refDate, setRefDate] = useState(today);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRdv, setEditingRdv] = useState<RDV | null>(null);
  const [detailRdv, setDetailRdv] = useState<RDV | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const weekDates = getWeekDates(refDate);
  const from = weekDates[0].toISOString().split("T")[0] + "T00:00:00";
  const to = weekDates[6].toISOString().split("T")[0] + "T23:59:59";

  const { data: rdvs = [], isLoading } = useQuery<RDV[]>({
    queryKey: ["rendez-vous", from, to],
    queryFn: () => fetch(`${API_BASE}/rendez-vous?from=${from}&to=${to}`).then(r => r.json()),
  });

  const { data: patients = [] } = useListPatients();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        patientId: form.patientId ? parseInt(form.patientId) : undefined,
        ownerId: form.ownerId ? parseInt(form.ownerId) : undefined,
        dureeMinutes: Number(form.dureeMinutes),
      };
      if (editingRdv) {
        const r = await fetch(`${API_BASE}/rendez-vous/${editingRdv.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error("Erreur");
      } else {
        const r = await fetch(`${API_BASE}/rendez-vous`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error("Erreur");
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rendez-vous"] }); toast({ title: editingRdv ? "RDV modifie" : "RDV cree" }); setDialogOpen(false); setDetailRdv(null); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/rendez-vous/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rendez-vous"] }); toast({ title: "RDV supprime" }); setDetailRdv(null); },
  });

  const goWeek = (delta: number) => {
    const d = new Date(refDate);
    d.setDate(d.getDate() + delta * 7);
    setRefDate(d);
  };

  const openNew = (date?: string) => {
    setEditingRdv(null);
    setForm({ ...EMPTY_FORM, dateHeure: date ?? "" });
    setDialogOpen(true);
  };

  const openEdit = (rdv: RDV) => {
    setEditingRdv(rdv);
    const dt = new Date(rdv.dateHeure);
    const localIso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}T${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
    setForm({
      dateHeure: localIso, dureeMinutes: rdv.dureeMinutes, patientId: rdv.patientId?.toString() ?? "",
      ownerId: rdv.ownerId?.toString() ?? "", veterinaire: rdv.veterinaire ?? "", motif: rdv.motif ?? "",
      statut: rdv.statut, notes: rdv.notes ?? "",
    });
    setDialogOpen(true);
    setDetailRdv(null);
  };

  const getRdvsForSlot = (date: Date, hour: string) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    return rdvs.filter(r => {
      const rdvDate = new Date(r.dateHeure);
      const rdvDateStr = `${rdvDate.getFullYear()}-${String(rdvDate.getMonth()+1).padStart(2,"0")}-${String(rdvDate.getDate()).padStart(2,"0")}`;
      const rdvHour = `${String(rdvDate.getHours()).padStart(2,"0")}:${String(rdvDate.getMinutes()).padStart(2,"0")}`;
      return rdvDateStr === dateStr && rdvHour === hour;
    });
  };

  const weekLabel = `${weekDates[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — ${weekDates[6].toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  const todayStr = today.toDateString();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Agenda</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[200px] text-center">{weekLabel}</span>
          <Button variant="outline" size="icon" onClick={() => goWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setRefDate(today)}>Aujourd'hui</Button>
          <Button size="sm" onClick={() => openNew()}><Plus className="h-4 w-4 mr-2" />Nouveau RDV</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
              <div className="p-2" />
              {weekDates.map((d, i) => {
                const isToday = d.toDateString() === todayStr;
                return (
                  <div key={i} className={`p-2 text-center border-l ${isToday ? "bg-primary/5" : ""}`}>
                    <p className="text-xs text-muted-foreground">{JOURS[i]}</p>
                    <p className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</p>
                  </div>
                );
              })}
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Chargement...</div>
            ) : (
              HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b hover:bg-muted/10 transition-colors min-h-[36px]">
                  <div className="p-1 text-right pr-2">
                    {hour.endsWith(":00") && <span className="text-xs text-muted-foreground">{hour}</span>}
                  </div>
                  {weekDates.map((d, di) => {
                    const slots = getRdvsForSlot(d, hour);
                    const isToday = d.toDateString() === todayStr;
                    const slotDt = new Date(d);
                    const [h, m] = hour.split(":").map(Number);
                    slotDt.setHours(h, m, 0, 0);
                    const slotIso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${hour}`;
                    return (
                      <div
                        key={di}
                        className={`border-l p-0.5 cursor-pointer ${isToday ? "bg-primary/5" : ""}`}
                        onClick={() => slots.length === 0 && openNew(slotIso)}
                      >
                        {slots.map((rdv) => (
                          <div
                            key={rdv.id}
                            className={`text-xs rounded px-1 py-0.5 border mb-0.5 cursor-pointer truncate ${STATUT_COLORS[rdv.statut] ?? "bg-gray-100"}`}
                            onClick={(e) => { e.stopPropagation(); setDetailRdv(rdv); }}
                          >
                            {rdv.patient?.nom ?? rdv.motif ?? "RDV"} — {rdv.veterinaire ? `Dr. ${rdv.veterinaire}` : ""}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detailRdv} onOpenChange={(o) => !o && setDetailRdv(null)}>
        {detailRdv && (
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Rendez-vous</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm py-2">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><strong>{new Date(detailRdv.dateHeure).toLocaleString("fr-FR")}</strong> ({detailRdv.dureeMinutes} min)</div>
              {detailRdv.patient && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{detailRdv.patient.nom} ({detailRdv.patient.espece})</div>}
              {detailRdv.owner && <p className="text-muted-foreground">Prop. : {detailRdv.owner.prenom} {detailRdv.owner.nom}</p>}
              {detailRdv.motif && <p><strong>Motif :</strong> {detailRdv.motif}</p>}
              {detailRdv.veterinaire && <p><strong>Veto :</strong> Dr. {detailRdv.veterinaire}</p>}
              <Badge className={`text-xs ${STATUT_COLORS[detailRdv.statut] ?? ""}`}>{detailRdv.statut}</Badge>
              {detailRdv.notes && <p className="text-muted-foreground italic">{detailRdv.notes}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(detailRdv.id)}>Supprimer</Button>
              <Button size="sm" onClick={() => openEdit(detailRdv)}>Modifier</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingRdv ? "Modifier le RDV" : "Nouveau rendez-vous"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1">
              <Label>Date et heure *</Label>
              <Input type="datetime-local" value={form.dateHeure} onChange={e => setForm(f => ({ ...f, dateHeure: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Duree (minutes)</Label>
              <Select value={form.dureeMinutes.toString()} onValueChange={v => setForm(f => ({ ...f, dureeMinutes: parseInt(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90, 120].map(d => <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={v => setForm(f => ({ ...f, statut: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Patient</Label>
              <Select value={form.patientId} onValueChange={v => setForm(f => ({ ...f, patientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selectionner..." /></SelectTrigger>
                <SelectContent>
                  {patients.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.nom} ({p.espece})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Veterinaire</Label>
              <Input value={form.veterinaire} onChange={e => setForm(f => ({ ...f, veterinaire: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Motif</Label>
              <Input value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} placeholder="Vaccination, visite, chirurgie..." />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.dateHeure || saveMutation.isPending}>
              {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
