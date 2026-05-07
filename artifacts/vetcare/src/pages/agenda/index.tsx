import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, User, AlertTriangle, CheckCircle2, XCircle, Phone, ChevronLeft, ChevronRight, RefreshCw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const VET_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16",
];

const STATUT_CONFIG: Record<string, { label: string; color: string; bgClass: string }> = {
  CONFIRME:       { label: "Confirmé",       color: "#10B981", bgClass: "bg-green-100 text-green-800" },
  EN_ATTENTE:     { label: "En attente",     color: "#F59E0B", bgClass: "bg-yellow-100 text-yellow-800" },
  ARRIVE:         { label: "Arrivé",         color: "#3B82F6", bgClass: "bg-blue-100 text-blue-800" },
  EN_CONSULTATION:{ label: "En consultation",color: "#8B5CF6", bgClass: "bg-purple-100 text-purple-800" },
  TERMINE:        { label: "Terminé",        color: "#6B7280", bgClass: "bg-gray-100 text-gray-700" },
  ANNULE:         { label: "Annulé",         color: "#EF4444", bgClass: "bg-red-100 text-red-800" },
  NO_SHOW:        { label: "No-show",        color: "#DC2626", bgClass: "bg-red-200 text-red-900" },
};

const TYPE_RDV = ["CONSULTATION", "VACCINATION", "CHIRURGIE", "URGENCE", "BILAN", "SUIVI", "AUTRE"];

interface RdvForm {
  dateHeure: string; dureeMinutes: number; motif: string; typeRdv: string;
  veterinaire: string; veterinaireId: string; proprietaireNom: string;
  proprietaireTelephone: string; animalNom: string; notes: string; patientId: string; ownerId: string;
}

const defaultForm: RdvForm = {
  dateHeure: "", dureeMinutes: 30, motif: "", typeRdv: "CONSULTATION",
  veterinaire: "", veterinaireId: "", proprietaireNom: "",
  proprietaireTelephone: "", animalNom: "", notes: "", patientId: "", ownerId: "",
};

export default function AgendaPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const calRef = useRef<any>(null);
  const [currentRange, setCurrentRange] = useState({ start: "", end: "" });
  const [selectedVets, setSelectedVets] = useState<string[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<RdvForm>(defaultForm);
  const [activeTab, setActiveTab] = useState("agenda");

  // --- Fetch vétérinaires ---
  const { data: vetsData } = useQuery({
    queryKey: ["agenda-vets"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/agenda/veterinaires/tous`);
      return r.json();
    },
  });
  const vets: any[] = vetsData?.data ?? [];
  const vetColorMap: Record<string, string> = {};
  vets.forEach((v: any, i: number) => { vetColorMap[v.id || v.prenom] = VET_COLORS[i % VET_COLORS.length]; });

  // --- Fetch RDV for current range ---
  const { data: rdvData, isLoading: rdvLoading, refetch: refetchRdv } = useQuery({
    queryKey: ["agenda-rdv", currentRange.start, currentRange.end],
    queryFn: async () => {
      if (!currentRange.start) return { data: [] };
      const r = await fetch(`${API_BASE}/api/rendez-vous?start=${currentRange.start}&end=${currentRange.end}`);
      return r.json();
    },
    enabled: !!currentRange.start,
  });
  const rdvList: any[] = rdvData?.data ?? [];

  // --- Fetch salle d'attente ---
  const { data: salleData, refetch: refetchSalle } = useQuery({
    queryKey: ["salle-attente"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/rendez-vous/salle-attente`);
      return r.json();
    },
    refetchInterval: 30000,
  });
  const salleList: any[] = salleData?.data ?? [];

  // --- Fetch patients + owners for search ---
  const { data: patientsData } = useQuery({
    queryKey: ["patients-search"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/patients?limit=200`);
      return r.json();
    },
  });
  const patientsList: any[] = patientsData?.data?.patients ?? [];

  // Convert RDV → FullCalendar events
  const calEvents = rdvList
    .filter(r => !selectedVets.length || selectedVets.includes(r.veterinaire_id || r.veterinaire))
    .map((r: any) => {
      const vetKey = r.veterinaire_id || r.veterinaire || "";
      const color = vetColorMap[vetKey] || "#6B7280";
      const statut = STATUT_CONFIG[r.statut] || STATUT_CONFIG["EN_ATTENTE"];
      return {
        id: String(r.id),
        title: `${r.animal_nom || "?"} — ${r.proprietaire_nom || "?"}`,
        start: r.date_heure,
        end: new Date(new Date(r.date_heure).getTime() + (r.duree_minutes || 30) * 60000).toISOString(),
        backgroundColor: r.statut === "NO_SHOW" ? "#DC2626" : r.statut === "ANNULE" ? "#9CA3AF" : color,
        borderColor: r.statut === "NO_SHOW" ? "#B91C1C" : color,
        textColor: "#fff",
        extendedProps: { rdv: r, statut, color },
      };
    });

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`${API_BASE}/api/rendez-vous`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Erreur création RDV");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "RDV créé ✓" });
      setShowDialog(false); setForm(defaultForm); qc.invalidateQueries({ queryKey: ["agenda-rdv"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`${API_BASE}/api/rendez-vous/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Erreur mise à jour RDV");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "RDV mis à jour ✓" });
      setShowDialog(false); setEditId(null); setForm(defaultForm);
      qc.invalidateQueries({ queryKey: ["agenda-rdv"] }); qc.invalidateQueries({ queryKey: ["salle-attente"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/api/rendez-vous/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Erreur suppression");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "RDV supprimé" });
      setShowDialog(false); setEditId(null); setForm(defaultForm);
      qc.invalidateQueries({ queryKey: ["agenda-rdv"] }); qc.invalidateQueries({ queryKey: ["salle-attente"] });
    },
  });

  const statutSalleMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: number; statut: string }) => {
      const r = await fetch(`${API_BASE}/api/rendez-vous/${id}/statut-salle`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut }),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salle-attente"] });
      qc.invalidateQueries({ queryKey: ["agenda-rdv"] });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      const r = await fetch(`${API_BASE}/api/rendez-vous/${id}/no-show`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "No-show enregistré" });
      qc.invalidateQueries({ queryKey: ["salle-attente"] }); qc.invalidateQueries({ queryKey: ["agenda-rdv"] });
    },
  });

  // --- FullCalendar handlers ---
  const handleDateClick = useCallback((info: any) => {
    const dt = new Date(info.dateStr || info.date);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    setForm({ ...defaultForm, dateHeure: dateStr, veterinaireId: vets[0]?.id || "", veterinaire: vets[0] ? `${vets[0].prenom} ${vets[0].nom}` : "" });
    setEditId(null); setShowDialog(true);
  }, [vets]);

  const handleEventClick = useCallback((info: any) => {
    const rdv = info.event.extendedProps.rdv;
    const dt = new Date(rdv.date_heure);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    setForm({
      dateHeure: dateStr, dureeMinutes: rdv.duree_minutes || 30, motif: rdv.motif || "",
      typeRdv: rdv.type_rdv || "CONSULTATION", veterinaire: rdv.veterinaire || "",
      veterinaireId: rdv.veterinaire_id || "", proprietaireNom: rdv.proprietaire_nom || "",
      proprietaireTelephone: rdv.proprietaire_telephone || "", animalNom: rdv.animal_nom || "",
      notes: rdv.notes || "", patientId: String(rdv.patient_id || ""), ownerId: String(rdv.owner_id || ""),
    });
    setEditId(rdv.id); setShowDialog(true);
  }, []);

  const handleEventDrop = useCallback((info: any) => {
    const rdvId = parseInt(info.event.id);
    updateMutation.mutate({ id: rdvId, data: { dateHeure: info.event.start.toISOString() } });
  }, []);

  const handleEventResize = useCallback((info: any) => {
    const rdvId = parseInt(info.event.id);
    const dur = Math.round((info.event.end - info.event.start) / 60000);
    updateMutation.mutate({ id: rdvId, data: { dureeMinutes: dur } });
  }, []);

  const handleDatesSet = useCallback((info: any) => {
    setCurrentRange({ start: info.startStr, end: info.endStr });
  }, []);

  const handleSubmit = () => {
    const payload = {
      dateHeure: new Date(form.dateHeure).toISOString(),
      dureeMinutes: form.dureeMinutes,
      motif: form.motif,
      typeRdv: form.typeRdv,
      veterinaire: form.veterinaire,
      veterinaireId: form.veterinaireId,
      proprietaireNom: form.proprietaireNom,
      proprietaireTelephone: form.proprietaireTelephone,
      animalNom: form.animalNom,
      notes: form.notes,
      patientId: form.patientId ? parseInt(form.patientId) : null,
      ownerId: form.ownerId ? parseInt(form.ownerId) : null,
      statut: "CONFIRME",
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  };

  const selectedPatient = patientsList.find(p => String(p.id) === form.patientId);

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h1 className="text-lg font-bold">Agenda</h1>
          {rdvLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          {/* Filtre vétérinaires */}
          <div className="flex gap-1">
            {vets.map((v: any, i: number) => {
              const key = v.id || v.prenom;
              const active = selectedVets.includes(key);
              return (
                <button key={key}
                  onClick={() => setSelectedVets(prev => active ? prev.filter(x => x !== key) : [...prev, key])}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${active ? "opacity-100" : "opacity-40"}`}
                  style={{ backgroundColor: VET_COLORS[i % VET_COLORS.length] + "22", color: VET_COLORS[i % VET_COLORS.length], border: `1.5px solid ${VET_COLORS[i % VET_COLORS.length]}` }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VET_COLORS[i % VET_COLORS.length] }} />
                  {v.prenom}
                </button>
              );
            })}
          </div>
          <Button size="sm" onClick={() => { setForm(defaultForm); setEditId(null); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-1" />Nouveau RDV
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar main */}
        <div className="flex-1 overflow-auto p-2">
          <FullCalendar
            ref={calRef}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, listPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
            }}
            locale="fr"
            firstDay={1}
            slotMinTime="07:00:00"
            slotMaxTime="20:00:00"
            height="100%"
            allDaySlot={false}
            editable={true}
            droppable={true}
            selectable={true}
            selectMirror={true}
            nowIndicator={true}
            events={calEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            datesSet={handleDatesSet}
            slotDuration="00:15:00"
            snapDuration="00:15:00"
            eventContent={(arg) => (
              <div className="p-0.5 overflow-hidden h-full">
                <div className="text-xs font-semibold leading-tight truncate">{arg.event.title}</div>
                {arg.event.extendedProps.rdv?.motif && (
                  <div className="text-xs opacity-80 truncate">{arg.event.extendedProps.rdv.motif}</div>
                )}
                {arg.event.extendedProps.rdv?.statut === "NO_SHOW" && (
                  <div className="text-xs font-bold">⚠ NO-SHOW</div>
                )}
              </div>
            )}
          />
        </div>

        {/* Salle d'attente panel */}
        <div className="w-72 border-l bg-gray-50 flex flex-col overflow-hidden">
          <div className="p-3 border-b bg-white">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-1">
                <User className="h-4 w-4 text-blue-500" />Salle d'attente
              </h2>
              <Badge variant="outline" className="text-xs">{salleList.length}</Badge>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {salleList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                Salle vide
              </div>
            ) : (
              salleList.map((rdv: any) => {
                const statut = STATUT_CONFIG[rdv.statut] || STATUT_CONFIG["EN_ATTENTE"];
                const heure = new Date(rdv.date_heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={rdv.id} className="bg-white rounded-lg border p-2 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">{rdv.animal_nom || "?"}</span>
                      <span className="text-xs text-muted-foreground">{heure}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1 truncate">{rdv.proprietaire_nom}</div>
                    {rdv.proprietaire_telephone && (
                      <div className="text-xs flex items-center gap-1 text-blue-600 mb-1">
                        <Phone className="h-3 w-3" />{rdv.proprietaire_telephone}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <Badge className={`text-xs px-1 py-0 ${statut.bgClass}`}>{statut.label}</Badge>
                      <div className="flex gap-1">
                        {rdv.statut !== "ARRIVE" && rdv.statut !== "EN_CONSULTATION" && rdv.statut !== "TERMINE" && (
                          <button onClick={() => statutSalleMutation.mutate({ id: rdv.id, statut: "ARRIVE" })}
                            className="text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Arrivé</button>
                        )}
                        {rdv.statut === "ARRIVE" && (
                          <button onClick={() => statutSalleMutation.mutate({ id: rdv.id, statut: "EN_CONSULTATION" })}
                            className="text-xs px-1 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200">Consulter</button>
                        )}
                        {rdv.statut === "EN_CONSULTATION" && (
                          <button onClick={() => statutSalleMutation.mutate({ id: rdv.id, statut: "TERMINE" })}
                            className="text-xs px-1 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200">Terminer</button>
                        )}
                        {!["TERMINE", "ANNULE", "NO_SHOW"].includes(rdv.statut) && (
                          <button onClick={() => noShowMutation.mutate({ id: rdv.id })}
                            className="text-xs px-1 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200">NS</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="p-2 border-t">
            <button onClick={() => { refetchSalle(); refetchRdv(); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1">
              <RefreshCw className="h-3 w-3" />Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Dialogue création/édition RDV */}
      <Dialog open={showDialog} onOpenChange={o => !o && (setShowDialog(false), setEditId(null))}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {/* Date/heure + durée */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date & heure</Label>
                <Input type="datetime-local" value={form.dateHeure}
                  onChange={e => setForm(f => ({ ...f, dateHeure: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Durée (min)</Label>
                <Select value={String(form.dureeMinutes)} onValueChange={v => setForm(f => ({ ...f, dureeMinutes: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15,20,30,45,60,90,120].map(d => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Type + vétérinaire */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={form.typeRdv} onValueChange={v => setForm(f => ({ ...f, typeRdv: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPE_RDV.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vétérinaire</Label>
                <Select value={form.veterinaireId} onValueChange={v => {
                  const vet = vets.find(x => x.id === v);
                  setForm(f => ({ ...f, veterinaireId: v, veterinaire: vet ? `${vet.prenom} ${vet.nom}` : v }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>{vets.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.prenom} {v.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Motif */}
            <div className="space-y-1">
              <Label className="text-xs">Motif</Label>
              <Input value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} placeholder="Motif de consultation..." />
            </div>

            {/* Patient search */}
            <div className="space-y-1">
              <Label className="text-xs">Patient (recherche)</Label>
              <Select value={form.patientId} onValueChange={v => {
                const p = patientsList.find(x => String(x.id) === v);
                setForm(f => ({
                  ...f, patientId: v,
                  animalNom: p?.nom || f.animalNom,
                  proprietaireNom: p?.owner_nom ? `${p.owner_nom} ${p.owner_prenom || ""}`.trim() : f.proprietaireNom,
                  proprietaireTelephone: p?.owner_telephone || f.proprietaireTelephone,
                  ownerId: String(p?.owner_id || f.ownerId),
                }));
              }}>
                <SelectTrigger><SelectValue placeholder="Chercher un patient..." /></SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {patientsList.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nom} — {p.owner_nom || ""} {p.owner_prenom || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Propriétaire + animal si pas de patient sélectionné */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Nom propriétaire</Label>
                <Input value={form.proprietaireNom} onChange={e => setForm(f => ({ ...f, proprietaireNom: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Téléphone</Label>
                <Input value={form.proprietaireTelephone} onChange={e => setForm(f => ({ ...f, proprietaireTelephone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Animal</Label>
              <Input value={form.animalNom} onChange={e => setForm(f => ({ ...f, animalNom: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes internes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {editId && (
                <Button variant="destructive" size="sm" onClick={() => {
                  if (confirm("Annuler ce RDV ?")) updateMutation.mutate({ id: editId, data: { statut: "ANNULE" } });
                }}>
                  <XCircle className="h-4 w-4 mr-1" />Annuler le RDV
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowDialog(false); setEditId(null); }}>Fermer</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editId ? "Mettre à jour" : "Créer le RDV"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
