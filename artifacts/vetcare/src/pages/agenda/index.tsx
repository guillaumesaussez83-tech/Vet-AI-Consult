import { useState, useMemo } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { formatDateFR } from "@/lib/utils";
import { useListPatients } from "@workspace/api-client-react";
import { unwrapResponse as __unwrapEnvelope } from "../../lib/queryClient";

import {
  ChevronLeft, ChevronRight, Plus, Calendar, Settings, ClipboardList,
  User, Clock, Stethoscope, Edit2, Trash2, AlertTriangle, CalendarX2, Loader2, Search,
} from "lucide-react";

const API = "/api/agenda";

// ─── Types ────────────────────────────────────────────────────────────────────

type Vet = {
  id: string; nom: string; prenom: string; couleur: string;
  initiales: string; actif: boolean; rpps?: string;
};

type Slot = { heure: string; disponible: boolean };

type RDV = {
  id: number; dateHeure: string; dureeMinutes: number;
  motif?: string; typeRdv?: string; statut: string; statutSalle?: string;
  veterinaire?: string; veterinaireId?: string;
  animalNom?: string; animalEspece?: string;
  proprietaireNom?: string; proprietaireTelephone?: string;
  notes?: string;
  patient?: { id: number; nom: string; espece: string } | null;
  owner?: { id: number; nom: string; prenom?: string; telephone?: string } | null;
  vet?: { id: string; nom: string; prenom: string; couleur: string; initiales: string } | null;
};

type PlanningSemaine = {
  id: string; veterinaireId: string; jourSemaine: number;
  heureDebut: string; heureFin: string; pauseDebut?: string; pauseFin?: string; actif: boolean;
};

type Exception = {
  id: string; veterinaireId: string; dateDebut: string; dateFin: string;
  typeException: string; motif?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const JOURS_COURT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const JOURS_LONG  = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const TYPE_RDV_LABELS: Record<string, string> = {
  consultation: "Consultation", vaccination: "Vaccination", chirurgie: "Chirurgie",
  urgence: "Urgence", suivi: "Suivi", bilan: "Bilan", autre: "Autre",
};

const TYPE_RDV_COLORS: Record<string, string> = {
  consultation: "bg-blue-500", vaccination: "bg-green-500", chirurgie: "bg-purple-500",
  urgence: "bg-red-500", suivi: "bg-amber-500", bilan: "bg-teal-500", autre: "bg-gray-500",
};

const ESPECE_LABELS: Record<string, string> = {
  chien: "Chien", chat: "Chat", nac: "NAC", cheval: "Cheval", autre: "Autre",
};

const TYPE_EXCEPTION_LABELS: Record<string, string> = {
  conge: "Congé", formation: "Formation", maladie: "Maladie",
  garde_exceptionnelle: "Garde exceptionnelle", fermeture_clinique: "Fermeture clinique",
};

const COULEURS_VETS = ["#2563EB", "#16A34A", "#F59E0B", "#EF4444", "#8B5CF6", "#0891B2", "#C2410C", "#15803D"];

// ─── Utilities ────────────────────────────────────────────────────────────────

function getWeekDates(weekOffset: number): string[] {
  const today = new Date();
  const dow = today.getDay();
  const lundi = new Date(today);
  lundi.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h < 20; h++) {
    for (let m = 0; m < 60; m += 20) {
      if (h === 19 && m >= 40) break;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

const ALL_TIME_SLOTS = generateTimeSlots();

function slotMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const [tab, setTab] = useState<"agenda" | "planning" | "config">("agenda");
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Shared state ──────────────────────────────────────────────────────────

  const { data: vets = [], isLoading: vetsLoading } = useQuery<Vet[]>({
    queryKey: ["agenda-vets"],
    queryFn: () => fetch(`${API}/veterinaires`).then(__unwrapEnvelope),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5">Planning multi-vétérinaire</p>
        </div>
      </div>

      {vetsLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[480px] w-full" />
        </div>
      )}

      {!vetsLoading && (
        <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="agenda" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="planning" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Planning
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="mt-4">
            <AgendaTab vets={vets} vetsLoading={vetsLoading} toast={toast} qc={qc} />
          </TabsContent>
          <TabsContent value="planning" className="mt-4">
            <PlanningTab vets={vets} toast={toast} qc={qc} />
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            <ConfigTab vets={vets} toast={toast} qc={qc} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — AGENDA
// ═══════════════════════════════════════════════════════════════════════════════

function AgendaTab({ vets, vetsLoading, toast, qc }: {
  vets: Vet[]; vetsLoading: boolean;
  toast: ReturnType<typeof useToast>["toast"];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const { user } = useUser();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showNewRdv, setShowNewRdv] = useState(false);
  const [selectedRdv, setSelectedRdv] = useState<RDV | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [selectedVetId, setSelectedVetId] = useState<string>("");

  const defaultVetId = useMemo(() => {
    if (!vets.length) return "";
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
    const lastName = user?.lastName?.toLowerCase() ?? "";
    const matched = vets.find(v =>
      (email && v.nom?.toLowerCase() === email) ||
      (email && `${v.prenom ?? ""} ${v.nom}`.toLowerCase().includes(email)) ||
      (lastName && v.nom?.toLowerCase().includes(lastName))
    );
    return matched?.id ?? vets[0]?.id ?? "";
  }, [vets, user]);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[5];
  const weekLabel = `Semaine du ${formatDateLong(weekStart)} au ${formatDateLong(weekEnd)}`;

  const { data: rdvs = [], isLoading: rdvsLoading } = useQuery<RDV[]>({
    queryKey: ["agenda-rdvs", weekStart],
    queryFn: () => fetch(`${API}/rendez-vous/semaine/${weekStart}`).then(__unwrapEnvelope),
    refetchInterval: 60000,
  });

  // Group RDVs by date
  const rdvByDate = useMemo(() => {
    const map: Record<string, RDV[]> = {};
    for (const d of weekDates) map[d] = [];
    for (const r of rdvs) {
      const d = r.dateHeure.split("T")[0];
      if (map[d]) map[d].push(r);
    }
    return map;
  }, [rdvs, weekDates]);

  function openNewRdv(date?: string, heure?: string, vetId?: string) {
    setSelectedDate(date ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }));
    setSelectedSlot(heure ?? "");
    setSelectedVetId(vetId ?? defaultVetId);
    setSelectedRdv(null);
    setShowNewRdv(true);
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[280px] text-center">{weekLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Aujourd'hui</Button>
        </div>
        <Button onClick={() => openNewRdv()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nouveau RDV
        </Button>
      </div>

      {vetsLoading || rdvsLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Chargement...
        </div>
      ) : vets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            <Stethoscope className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Aucun vétérinaire configuré</p>
            <p className="text-sm mt-1">Ajoutez des vétérinaires dans l'onglet Configuration.</p>
          </CardContent>
        </Card>
      ) : (
        <WeekGrid
          weekDates={weekDates}
          vets={vets}
          rdvByDate={rdvByDate}
          onSlotClick={openNewRdv}
          onRdvClick={rdv => { setSelectedRdv(rdv); setShowNewRdv(true); }}
        />
      )}

      {showNewRdv && (
        <RdvDialog
          open={showNewRdv}
          onClose={() => { setShowNewRdv(false); setSelectedRdv(null); }}
          vets={vets}
          initialDate={selectedDate}
          initialHeure={selectedSlot}
          initialVetId={selectedVetId}
          rdv={selectedRdv}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["agenda-rdvs", weekStart] });
            setShowNewRdv(false);
            setSelectedRdv(null);
            toast({ title: "RDV enregistré" });
          }}
        />
      )}
    </>
  );
}

// ─── Week Grid ────────────────────────────────────────────────────────────────

function WeekGrid({ weekDates, vets, rdvByDate, onSlotClick, onRdvClick }: {
  weekDates: string[];
  vets: Vet[];
  rdvByDate: Record<string, RDV[]>;
  onSlotClick: (date: string, heure: string, vetId: string) => void;
  onRdvClick: (rdv: RDV) => void;
}) {
  const SLOT_H = 28; // px height per 20-min slot
  const TIME_W = 52; // px width for time column

  const startHour = 8 * 60;

  function rdvTop(rdv: RDV): number {
    const heure = rdv.dateHeure.split("T")[1]?.slice(0, 5) ?? "08:00";
    return ((slotMinutes(heure) - startHour) / 20) * SLOT_H;
  }

  function rdvHeight(rdv: RDV): number {
    return ((rdv.dureeMinutes ?? 20) / 20) * SLOT_H;
  }

  const totalH = ALL_TIME_SLOTS.length * SLOT_H;

  return (
    <div className="border rounded-lg overflow-auto bg-white shadow-sm" style={{ maxHeight: "calc(100vh - 240px)" }}>
      {/* Header row */}
      <div className="sticky top-0 z-20 bg-white border-b flex">
        <div style={{ minWidth: TIME_W, width: TIME_W }} className="border-r" />
        {weekDates.map(date => (
          <div
            key={date}
            className={`flex-1 min-w-0 border-r last:border-r-0 px-1 py-2 ${isToday(date) ? "bg-blue-50" : ""}`}
          >
            <div className={`text-xs font-semibold text-center mb-1 ${isToday(date) ? "text-blue-600" : "text-gray-600"}`}>
              {formatDateFr(date)}
            </div>
            {/* Vet sub-headers */}
            <div className="flex gap-0.5">
              {vets.map(vet => (
                <div
                  key={vet.id}
                  className="flex-1 flex items-center justify-center gap-0.5 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: vet.couleur + "20", color: vet.couleur }}
                  title={`Dr. ${vet.prenom} ${vet.nom}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: vet.couleur }}
                  />
                  <span className="hidden xl:inline truncate">{vet.initiales}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex">
        {/* Time column */}
        <div style={{ minWidth: TIME_W, width: TIME_W, position: "relative" }} className="border-r flex-shrink-0">
          {ALL_TIME_SLOTS.map((slot, i) => (
            <div
              key={slot}
              className="absolute w-full border-b border-gray-100 flex items-start justify-end pr-1.5"
              style={{ top: i * SLOT_H, height: SLOT_H }}
            >
              {slot.endsWith(":00") ? (
                <span className="text-[10px] text-gray-400 leading-tight">{slot}</span>
              ) : null}
            </div>
          ))}
          <div style={{ height: totalH }} />
        </div>

        {/* Day columns */}
        {weekDates.map(date => {
          const dayRdvs = rdvByDate[date] ?? [];
          return (
            <div
              key={date}
              className={`flex-1 min-w-0 border-r last:border-r-0 relative flex ${isToday(date) ? "bg-blue-50/30" : ""}`}
              style={{ height: totalH }}
            >
              {/* Grid lines */}
              {ALL_TIME_SLOTS.map((slot, i) => (
                <div
                  key={slot}
                  className="absolute inset-x-0 border-b border-gray-100"
                  style={{ top: i * SLOT_H, height: SLOT_H }}
                />
              ))}

              {/* Vet sub-columns for clicking */}
              <div className="flex h-full w-full absolute inset-0">
                {vets.map(vet => (
                  <div key={vet.id} className="flex-1 h-full">
                    {ALL_TIME_SLOTS.map((slot) => (
                      <div
                        key={slot}
                        className="w-full cursor-pointer hover:bg-blue-50/60 transition-colors"
                        style={{ height: SLOT_H }}
                        onClick={() => onSlotClick(date, slot, vet.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* RDV cards */}
              {dayRdvs.map(rdv => {
                const vetIdx = rdv.veterinaireId ? vets.findIndex(v => v.id === rdv.veterinaireId) : 0;
                const vetCount = vets.length;
                const vet = rdv.vet ?? vets[vetIdx];
                const leftPct = vetIdx >= 0 ? (vetIdx / vetCount) * 100 : 0;
                const widthPct = 100 / vetCount;
                const top = rdvTop(rdv);
                const height = Math.max(rdvHeight(rdv), SLOT_H);

                return (
                  <div
                    key={rdv.id}
                    className="absolute z-10 px-1 py-0.5 rounded text-white cursor-pointer hover:opacity-90 overflow-hidden shadow-sm"
                    style={{
                      top: top + 1,
                      height: height - 2,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: vet?.couleur ?? "#2563EB",
                    }}
                    onClick={e => { e.stopPropagation(); onRdvClick(rdv); }}
                    title={`${rdv.animalNom ?? rdv.patient?.nom ?? ""} — ${rdv.proprietaireNom ?? ""}`}
                  >
                    <div className="text-[10px] font-semibold leading-tight truncate">
                      {rdv.animalNom ?? rdv.patient?.nom ?? rdv.motif ?? "RDV libre"}
                    </div>
                    {height >= 40 && (
                      <div className="text-[9px] opacity-80 truncate">
                        {rdv.proprietaireNom ?? (rdv.owner ? `${rdv.owner.prenom ?? ""} ${rdv.owner.nom}`.trim() : "")}
                      </div>
                    )}
                    {height >= 52 && (
                      <div className="text-[9px] opacity-80 truncate">
                        {TYPE_RDV_LABELS[rdv.typeRdv ?? ""] ?? rdv.motif ?? ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RDV Dialog ───────────────────────────────────────────────────────────────

function RdvDialog({ open, onClose, vets, initialDate, initialHeure, initialVetId, rdv, onSaved }: {
  open: boolean; onClose: () => void; vets: Vet[];
  initialDate: string; initialHeure: string; initialVetId: string;
  rdv: RDV | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const defaultVetId = rdv?.veterinaireId ?? (initialVetId ? initialVetId : (vets[0]?.id ?? ""));
  const [form, setForm] = useState(() => ({
    veterinaireId: defaultVetId,
    dateHeure: rdv?.dateHeure ?? `${initialDate || new Date().toISOString().split("T")[0]}T${initialHeure || "09:00"}`,
    dureeMinutes: rdv?.dureeMinutes ?? 20,
    typeRdv: rdv?.typeRdv ?? "consultation",
    patientId: rdv?.patient?.id ?? null as number | null,
    animalNom: rdv?.animalNom ?? rdv?.patient?.nom ?? "",
    animalEspece: rdv?.animalEspece ?? rdv?.patient?.espece ?? "chien",
    proprietaireNom: rdv?.proprietaireNom ?? (rdv?.owner ? `${rdv.owner.prenom ?? ""} ${rdv.owner.nom}`.trim() : ""),
    proprietaireTelephone: rdv?.proprietaireTelephone ?? rdv?.owner?.telephone ?? "",
    motif: rdv?.motif ?? "",
    notes: rdv?.notes ?? "",
  }));
  const [patientSearch, setPatientSearch] = useState("");
  const [showPatientList, setShowPatientList] = useState(false);
  const { data: allPatients = [] } = useListPatients();
  const filteredPatients = patientSearch.length >= 2
    ? allPatients.filter(p =>
        p.nom.toLowerCase().includes(patientSearch.toLowerCase()) ||
        (p.owner && `${p.owner.prenom ?? ""} ${p.owner.nom}`.toLowerCase().includes(patientSearch.toLowerCase()))
      ).slice(0, 8)
    : [];

  const { data: slots = [] } = useQuery<Slot[]>({
    queryKey: ["agenda-slots", form.veterinaireId, form.dateHeure.split("T")[0]],
    queryFn: () => form.veterinaireId
      ? fetch(`${API}/slots/${form.veterinaireId}/${form.dateHeure.split("T")[0]}?duree=${form.dureeMinutes}`).then(__unwrapEnvelope)
      : Promise.resolve([]),
    enabled: !!form.veterinaireId,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const url = rdv ? `${API}/rendez-vous/${rdv.id}` : `${API}/rendez-vous`;
      const res = await fetch(url, {
        method: rdv ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        if (res.status === 409 && d.prochains) {
          throw new Error(`Créneau pris. Prochains disponibles: ${d.prochains.map((s: Slot) => s.heure).join(", ")}`);
        }
        throw new Error(typeof d.error === "string" ? d.error : d.message ?? "Erreur lors de la création du RDV");
      }
      return res.json();
    },
    onSuccess: onSaved,
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!rdv) return;
      await fetch(`${API}/rendez-vous/${rdv.id}`, { method: "DELETE" });
    },
    onSuccess: onSaved,
    onError: () => toast({ title: "Erreur lors de la suppression", variant: "destructive" }),
  });

  function set(k: string, v: unknown) { setForm(f => ({ ...f, [k]: v })); }

  const selectedDate = form.dateHeure.split("T")[0];
  const selectedTime = form.dateHeure.split("T")[1]?.slice(0, 5) ?? "";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rdv ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Vet */}
          <div className="space-y-1">
            <Label>Vétérinaire</Label>
            <Select value={form.veterinaireId} onValueChange={v => set("veterinaireId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {vets.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: v.couleur }} />
                      Dr. {v.prenom} {v.nom}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date + heure */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={selectedDate} onChange={e => set("dateHeure", `${e.target.value}T${selectedTime || "09:00"}`)} />
            </div>
            <div className="space-y-1">
              <Label>Heure</Label>
              {slots.length > 0 ? (
                <Select value={selectedTime} onValueChange={v => set("dateHeure", `${selectedDate}T${v}`)}>
                  <SelectTrigger>
                    <SelectValue placeholder="--:--" />
                  </SelectTrigger>
                  <SelectContent>
                    {slots.map(s => (
                      <SelectItem key={s.heure} value={s.heure} disabled={!s.disponible}>
                        {s.heure} {!s.disponible && "(pris)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input type="time" step={1200} value={selectedTime} onChange={e => set("dateHeure", `${selectedDate}T${e.target.value}`)} />
              )}
            </div>
          </div>

          {/* Durée + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Durée (min)</Label>
              <Select value={String(form.dureeMinutes)} onValueChange={v => set("dureeMinutes", parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 45, 60, 90].map(d => (
                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.typeRdv} onValueChange={v => set("typeRdv", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_RDV_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Patient (recherche liée) */}
          <div className="space-y-1">
            <Label>Patient (recherche dans la base)</Label>
            {form.patientId ? (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-blue-50 border-blue-200">
                <User className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-sm font-medium text-blue-900 flex-1">{form.animalNom}</span>
                <span className="text-xs text-blue-600">{form.proprietaireNom}</span>
                <button
                  type="button"
                  className="text-xs text-blue-400 hover:text-red-500 ml-2"
                  onClick={() => {
                    set("patientId", null);
                    set("animalNom", ""); set("animalEspece", "chien");
                    set("proprietaireNom", ""); set("proprietaireTelephone", "");
                    setPatientSearch("");
                  }}
                >✕</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Nom animal ou propriétaire..."
                  value={patientSearch}
                  onChange={e => { setPatientSearch(e.target.value); setShowPatientList(true); }}
                  onFocus={() => setShowPatientList(true)}
                  onBlur={() => setTimeout(() => setShowPatientList(false), 150)}
                />
                {showPatientList && filteredPatients.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredPatients.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-3 border-b last:border-0"
                        onClick={() => {
                          set("patientId", p.id);
                          set("animalNom", p.nom ?? "");
                          set("animalEspece", p.espece ?? "chien");
                          set("proprietaireNom", p.owner ? `${p.owner.prenom ?? ""} ${p.owner.nom}`.trim() : "");
                          set("proprietaireTelephone", (p.owner as any)?.telephone ?? "");
                          setPatientSearch("");
                          setShowPatientList(false);
                        }}
                      >
                        <span className="text-sm font-medium">{p.nom}</span>
                        <span className="text-xs text-muted-foreground">{ESPECE_LABELS[p.espece] ?? p.espece}</span>
                        {p.owner && <span className="text-xs text-muted-foreground ml-auto">{p.owner.prenom} {p.owner.nom}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Animal + Espèce (saisie libre si pas de patient lié) */}
          {!form.patientId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nom de l'animal</Label>
                <Input value={form.animalNom} onChange={e => set("animalNom", e.target.value)} placeholder="Rex, Félix..." />
              </div>
              <div className="space-y-1">
                <Label>Espèce</Label>
                <Select value={form.animalEspece} onValueChange={v => set("animalEspece", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ESPECE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Propriétaire */}
          {!form.patientId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nom du propriétaire</Label>
                <Input value={form.proprietaireNom} onChange={e => set("proprietaireNom", e.target.value)} placeholder="Dupont" />
              </div>
              <div className="space-y-1">
                <Label>Téléphone</Label>
                <Input value={form.proprietaireTelephone} onChange={e => set("proprietaireTelephone", e.target.value)} placeholder="06..." />
              </div>
            </div>
          )}

          {/* Motif */}
          <div className="space-y-1">
            <Label>Motif</Label>
            <Input value={form.motif} onChange={e => set("motif", e.target.value)} placeholder="Motif de consultation..." />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notes internes..." />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          {rdv && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => deleteMut.mutate()}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {rdv ? "Mettre à jour" : "Créer le RDV"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — PLANNING
// ═══════════════════════════════════════════════════════════════════════════════

function PlanningTab({ vets, toast, qc }: {
  vets: Vet[];
  toast: ReturnType<typeof useToast>["toast"];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const now = new Date();
  const [moisOffset, setMoisOffset] = useState(0);
  const [showExcDialog, setShowExcDialog] = useState(false);
  const [selectedVetExc, setSelectedVetExc] = useState<string>("");

  const year = now.getFullYear() + Math.floor((now.getMonth() + moisOffset) / 12);
  const mois = ((now.getMonth() + moisOffset) % 12 + 12) % 12 + 1;
  const moisLabel = `${MOIS_NOMS[mois - 1]} ${year}`;

  const { data: planningData, isLoading } = useQuery({
    queryKey: ["agenda-planning-mois", year, mois],
    queryFn: () => fetch(`${API}/planning/mois/${year}/${mois}`).then(__unwrapEnvelope),
  });

  const moisCalendar = planningData?.mois ?? {};
  const days = Object.keys(moisCalendar).sort();

  // Build calendar weeks
  const firstDay = days[0] ? new Date(days[0] + "T12:00:00Z") : new Date();
  const startDow = (firstDay.getDay() + 6) % 7; // 0=Lundi
  const calendarCells: (string | null)[] = Array(startDow).fill(null).concat(days);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < calendarCells.length; i += 7) weeks.push(calendarCells.slice(i, i + 7));

  const EXCEPTION_COLORS: Record<string, string> = {
    conge: "bg-orange-100 text-orange-700",
    formation: "bg-purple-100 text-purple-700",
    maladie: "bg-red-100 text-red-700",
    garde_exceptionnelle: "bg-green-100 text-green-700",
    fermeture_clinique: "bg-gray-200 text-gray-700",
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMoisOffset(o => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[160px] text-center">{moisLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setMoisOffset(o => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMoisOffset(0)}>Ce mois</Button>
        </div>
        <Button
          variant="outline"
          onClick={() => { setSelectedVetExc(vets[0]?.id ?? ""); setShowExcDialog(true); }}
          className="flex items-center gap-2"
        >
          <CalendarX2 className="h-4 w-4" /> Ajouter exception
        </Button>
      </div>

      {/* Vet legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {vets.map(vet => (
          <div key={vet.id} className="flex items-center gap-1.5 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: vet.couleur }} />
            <span className="text-gray-700">Dr. {vet.initiales ?? `${vet.prenom[0]}${vet.nom[0]}`} — {vet.prenom} {vet.nom}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Chargement...
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Header */}
            <div className="grid grid-cols-7 border-b">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(j => (
                <div key={j} className="py-2 text-center text-xs font-semibold text-gray-500 border-r last:border-r-0">{j}</div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
                {week.map((date, di) => {
                  const dayData = date ? moisCalendar[date] : null;
                  const isWE = di >= 5;
                  const today = date === new Date().toISOString().split("T")[0];
                  return (
                    <div
                      key={di}
                      className={`min-h-[80px] border-r last:border-r-0 p-1.5 ${!date ? "bg-gray-50" : isWE ? "bg-gray-50/60" : ""} ${today ? "ring-2 ring-inset ring-blue-300" : ""}`}
                    >
                      {date && (
                        <>
                          <div className={`text-xs font-medium mb-1 ${today ? "text-blue-600 font-bold" : "text-gray-700"}`}>
                            {parseInt(date.split("-")[2])}
                          </div>
                          <div className="space-y-0.5">
                            {vets.map(vet => {
                              const d = dayData?.[vet.id];
                              if (!d) return null;
                              const exc = d.exception;
                              if (exc && ["conge", "maladie", "formation", "fermeture_clinique"].includes(exc)) {
                                return (
                                  <div key={vet.id} className={`text-[9px] px-1 py-0.5 rounded truncate ${EXCEPTION_COLORS[exc]}`}>
                                    {vet.initiales} {TYPE_EXCEPTION_LABELS[exc]?.slice(0, 6)}
                                  </div>
                                );
                              }
                              if (!d.travaille) return null;
                              return (
                                <div
                                  key={vet.id}
                                  className="text-[9px] px-1 py-0.5 rounded text-white truncate flex items-center gap-0.5"
                                  style={{ backgroundColor: vet.couleur + "CC" }}
                                >
                                  <span>{vet.initiales}</span>
                                  {d.nbRdv > 0 && <span className="opacity-80">({d.nbRdv})</span>}
                                  {d.estGardeWeekend && <span className="opacity-70">G</span>}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {showExcDialog && (
        <ExceptionDialog
          open={showExcDialog}
          onClose={() => setShowExcDialog(false)}
          vets={vets}
          initialVetId={selectedVetExc}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["agenda-planning-mois"] });
            setShowExcDialog(false);
            toast({ title: "Exception ajoutée" });
          }}
        />
      )}
    </>
  );
}

function ExceptionDialog({ open, onClose, vets, initialVetId, onSaved }: {
  open: boolean; onClose: () => void; vets: Vet[];
  initialVetId: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    veterinaireId: initialVetId,
    dateDebut: today, dateFin: today,
    typeException: "conge", motif: "",
  });
  const [conflits, setConflits] = useState<unknown[]>([]);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/planning/exception`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: data => {
      if (data.conflits?.length > 0) setConflits(data.conflits);
      else onSaved();
    },
    onError: () => toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" }),
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une exception</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Vétérinaire</Label>
            <Select value={form.veterinaireId} onValueChange={v => set("veterinaireId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {vets.map(v => <SelectItem key={v.id} value={v.id}>Dr. {v.prenom} {v.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Début</Label>
              <Input type="date" value={form.dateDebut} onChange={e => set("dateDebut", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fin</Label>
              <Input type="date" value={form.dateFin} onChange={e => set("dateFin", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.typeException} onValueChange={v => set("typeException", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_EXCEPTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Motif (optionnel)</Label>
            <Input value={form.motif} onChange={e => set("motif", e.target.value)} placeholder="Ex: Vacances été..." />
          </div>
          {conflits.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
                <AlertTriangle className="h-4 w-4" /> {conflits.length} RDV en conflit
              </div>
              <p className="text-xs text-amber-600">Des rendez-vous existent sur cette période. L'exception a été créée mais les RDV doivent être déplacés manuellement.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => { setConflits([]); mut.mutate(); }} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

function ConfigTab({ vets, toast, qc }: {
  vets: Vet[];
  toast: ReturnType<typeof useToast>["toast"];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [showVetDialog, setShowVetDialog] = useState(false);
  const [editVet, setEditVet] = useState<Vet | null>(null);
  const [selectedVetId, setSelectedVetId] = useState<string>(vets[0]?.id ?? "");
  const [showRotDialog, setShowRotDialog] = useState(false);

  const selectedVet = vets.find(v => v.id === selectedVetId) ?? vets[0];

  const { data: planning = [] } = useQuery<PlanningSemaine[]>({
    queryKey: ["agenda-planning-semaine", selectedVetId],
    queryFn: () => fetch(`${API}/planning/semaine-type/${selectedVetId}`).then(__unwrapEnvelope),
    enabled: !!selectedVetId,
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => fetch(`${API}/veterinaires/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agenda-vets"] }); toast({ title: "Vétérinaire désactivé" }); },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Vet list */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
            <CardTitle className="text-sm font-semibold">Vétérinaires</CardTitle>
            <Button size="sm" onClick={() => { setEditVet(null); setShowVetDialog(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {vets.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Aucun vétérinaire</div>
            ) : (
              <div className="divide-y">
                {vets.map(vet => (
                  <div
                    key={vet.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedVetId === vet.id ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}
                    onClick={() => setSelectedVetId(vet.id)}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: vet.couleur }}
                    >
                      {vet.initiales}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">Dr. {vet.prenom} {vet.nom}</div>
                      {vet.rpps && <div className="text-xs text-gray-400">RPPS: {vet.rpps}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setEditVet(vet); setShowVetDialog(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={e => { e.stopPropagation(); deactivateMut.mutate(vet.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold">Rotations weekend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500 mb-3">Générez automatiquement un planning de gardes équitable entre les vétérinaires.</p>
            <Button variant="outline" className="w-full" onClick={() => setShowRotDialog(true)}>
              Générer les rotations
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Weekly planning for selected vet */}
      <div className="lg:col-span-2">
        {selectedVet ? (
          <WeeklyPlanningEditor vet={selectedVet} planning={planning} qc={qc} toast={toast} />
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-gray-400">
              Sélectionnez un vétérinaire
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      {showVetDialog && (
        <VetDialog
          open={showVetDialog}
          onClose={() => setShowVetDialog(false)}
          vet={editVet}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["agenda-vets"] });
            setShowVetDialog(false);
            toast({ title: editVet ? "Vétérinaire mis à jour" : "Vétérinaire ajouté" });
          }}
        />
      )}
      {showRotDialog && (
        <RotationDialog
          open={showRotDialog}
          onClose={() => setShowRotDialog(false)}
          vets={vets}
          toast={toast}
        />
      )}
    </div>
  );
}

function WeeklyPlanningEditor({ vet, planning, qc, toast }: {
  vet: Vet; planning: PlanningSemaine[];
  qc: ReturnType<typeof useQueryClient>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const planByDay = useMemo(() => {
    const m: Record<number, PlanningSemaine | undefined> = {};
    for (const p of planning) m[p.jourSemaine] = p;
    return m;
  }, [planning]);

  const saveMut = useMutation({
    mutationFn: (data: {
      jourSemaine: number; actif: boolean;
      heureDebut: string; heureFin: string; pauseDebut?: string; pauseFin?: string;
    }) => fetch(`${API}/planning/semaine-type`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ veterinaireId: vet.id, ...data }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-planning-semaine", vet.id] }),
    onError: () => toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex flex-row items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: vet.couleur }}>
          {vet.initiales}
        </div>
        <CardTitle className="text-sm font-semibold">Planning type — Dr. {vet.prenom} {vet.nom}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5, 6].map(jour => {
            const p = planByDay[jour];
            const actif = !!p?.actif;
            return (
              <DayEditor
                key={jour}
                jour={jour}
                label={JOURS_LONG[jour]}
                planning={p}
                actif={actif}
                onSave={(data) => saveMut.mutate({ jourSemaine: jour, ...data })}
                isSaving={saveMut.isPending}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DayEditor({ jour, label, planning, actif, onSave, isSaving }: {
  jour: number; label: string;
  planning?: PlanningSemaine;
  actif: boolean;
  onSave: (d: { actif: boolean; heureDebut: string; heureFin: string; pauseDebut?: string; pauseFin?: string }) => void;
  isSaving: boolean;
}) {
  const [localActif, setLocalActif] = useState(actif);
  const [heureDebut, setHeureDebut] = useState(planning?.heureDebut ?? "08:30");
  const [heureFin, setHeureFin] = useState(planning?.heureFin ?? "19:00");
  const [pauseDebut, setPauseDebut] = useState(planning?.pauseDebut ?? "12:00");
  const [pauseFin, setPauseFin] = useState(planning?.pauseFin ?? "14:00");
  const [hasPause, setHasPause] = useState(!!(planning?.pauseDebut));
  const isWE = jour >= 5;

  function save() {
    onSave({
      actif: localActif,
      heureDebut, heureFin,
      pauseDebut: hasPause ? pauseDebut : undefined,
      pauseFin: hasPause ? pauseFin : undefined,
    });
  }

  return (
    <div className={`rounded-lg border p-3 transition-colors ${localActif ? "bg-white" : "bg-gray-50"}`}>
      <div className="flex items-center gap-3">
        <Checkbox
          checked={localActif}
          onCheckedChange={v => {
            setLocalActif(!!v);
            onSave({ actif: !!v, heureDebut, heureFin, pauseDebut: hasPause ? pauseDebut : undefined, pauseFin: hasPause ? pauseFin : undefined });
          }}
        />
        <span className={`text-sm font-medium w-24 ${isWE ? "text-amber-700" : "text-gray-700"}`}>{label}</span>
        {localActif ? (
          <>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Clock className="h-3 w-3" />
              <Input type="time" value={heureDebut} onChange={e => setHeureDebut(e.target.value)} className="h-7 w-24 text-xs" />
              <span>—</span>
              <Input type="time" value={heureFin} onChange={e => setHeureFin(e.target.value)} className="h-7 w-24 text-xs" />
            </div>
            <div className="flex items-center gap-2 ml-3">
              <Checkbox
                checked={hasPause}
                onCheckedChange={v => setHasPause(!!v)}
                id={`pause-${jour}`}
              />
              <label htmlFor={`pause-${jour}`} className="text-xs text-gray-500 cursor-pointer">Pause</label>
              {hasPause && (
                <div className="flex items-center gap-1 text-xs">
                  <Input type="time" value={pauseDebut} onChange={e => setPauseDebut(e.target.value)} className="h-7 w-20 text-xs" />
                  <span>—</span>
                  <Input type="time" value={pauseFin} onChange={e => setPauseFin(e.target.value)} className="h-7 w-20 text-xs" />
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={save} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sauvegarder"}
            </Button>
          </>
        ) : (
          <span className="text-xs text-gray-400">Repos / Fermé</span>
        )}
      </div>
    </div>
  );
}

function VetDialog({ open, onClose, vet, onSaved }: {
  open: boolean; onClose: () => void; vet: Vet | null; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    nom: vet?.nom ?? "", prenom: vet?.prenom ?? "",
    couleur: vet?.couleur ?? "#2563EB", initiales: vet?.initiales ?? "",
    rpps: vet?.rpps ?? "",
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const mut = useMutation({
    mutationFn: async () => {
      const url = vet ? `${API}/veterinaires/${vet.id}` : `${API}/veterinaires`;
      const res = await fetch(url, {
        method: vet ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: onSaved,
    onError: () => toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{vet ? "Modifier le vétérinaire" : "Ajouter un vétérinaire"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Prénom</Label>
              <Input value={form.prenom} onChange={e => { set("prenom", e.target.value); if (!form.initiales) set("initiales", `${e.target.value[0] ?? ""}${form.nom[0] ?? ""}`.toUpperCase()); }} />
            </div>
            <div className="space-y-1">
              <Label>Nom</Label>
              <Input value={form.nom} onChange={e => { set("nom", e.target.value); if (!form.initiales) set("initiales", `${form.prenom[0] ?? ""}${e.target.value[0] ?? ""}`.toUpperCase()); }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Initiales</Label>
              <Input value={form.initiales} onChange={e => set("initiales", e.target.value.toUpperCase())} maxLength={3} placeholder="GS" />
            </div>
            <div className="space-y-1">
              <Label>N° RPPS (optionnel)</Label>
              <Input value={form.rpps} onChange={e => set("rpps", e.target.value)} placeholder="11234567890" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2">
              {COULEURS_VETS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 transition-all ${form.couleur === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => set("couleur", c)}
                />
              ))}
              <input type="color" value={form.couleur} onChange={e => set("couleur", e.target.value)} className="w-7 h-7 rounded-full cursor-pointer border border-gray-300" title="Couleur personnalisée" />
            </div>
          </div>
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: form.couleur }}>
              {form.initiales || `${form.prenom[0] ?? "?"}${form.nom[0] ?? "?"}`}
            </div>
            <div>
              <div className="text-sm font-medium">Dr. {form.prenom || "Prénom"} {form.nom || "Nom"}</div>
              <div className="text-xs text-gray-400" style={{ color: form.couleur }}>Vétérinaire</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.nom || !form.prenom}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {vet ? "Mettre à jour" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RotationDialog({ open, onClose, vets, toast }: {
  open: boolean; onClose: () => void; vets: Vet[];
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const today = new Date().toISOString().split("T")[0];
  const in3months = new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split("T")[0];
  const [vetIds, setVetIds] = useState<string[]>(vets.map(v => v.id));
  const [dateDebut, setDateDebut] = useState(today);
  const [dateFin, setDateFin] = useState(in3months);
  const [preview, setPreview] = useState<{ date: string; veterinaireId: string; typeGarde: string }[]>([]);

  const previewMut = useMutation({
    mutationFn: () => fetch(`${API}/rotations/generer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vetIds, dateDebut, dateFin, confirmer: false }),
    }).then(__unwrapEnvelope),
    onSuccess: data => setPreview(data.preview ?? []),
  });

  const saveMut = useMutation({
    mutationFn: () => fetch(`${API}/rotations/generer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vetIds, dateDebut, dateFin, confirmer: true }),
    }).then(__unwrapEnvelope),
    onSuccess: () => { toast({ title: "Rotations enregistrées" }); onClose(); },
    onError: () => toast({ title: "Erreur lors de la génération", variant: "destructive" }),
  });

  const vetMap = useMemo(() => Object.fromEntries(vets.map(v => [v.id, v])), [vets]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Générer les rotations weekend</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Vétérinaires participants</Label>
            <div className="space-y-1.5">
              {vets.map(vet => (
                <div key={vet.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={vetIds.includes(vet.id)}
                    onCheckedChange={v => setVetIds(ids => v ? [...ids, vet.id] : ids.filter(i => i !== vet.id))}
                    id={`rot-vet-${vet.id}`}
                  />
                  <label htmlFor={`rot-vet-${vet.id}`} className="flex items-center gap-2 text-sm cursor-pointer">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: vet.couleur }} />
                    Dr. {vet.prenom} {vet.nom}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Début</Label>
              <Input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fin</Label>
              <Input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => previewMut.mutate()} disabled={vetIds.length === 0 || previewMut.isPending}>
            {previewMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Aperçu
          </Button>
          {preview.length > 0 && (
            <div className="rounded-md border max-h-48 overflow-y-auto">
              <div className="text-xs font-medium text-gray-500 px-3 py-2 border-b">{preview.length} weekends générés</div>
              <div className="divide-y">
                {preview.map((r, i) => {
                  const vet = vetMap[r.veterinaireId];
                  return (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                      <span className="text-gray-600">{formatDateFR(r.date)}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: vet?.couleur }} />
                        <span>Dr. {vet?.initiales}</span>
                        <Badge variant="outline" className="text-[10px] py-0">{r.typeGarde}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || preview.length === 0}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirmer et enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
