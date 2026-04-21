import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useListPatients } from "@workspace/api-client-react";
import { Clock, RefreshCw, Plus, ChevronRight, ChevronLeft, FileText, Euro, User, AlertCircle, Search, Loader2 } from "lucide-react";

const API_BASE = "/api";

type RDV = {
  id: number;
  dateHeure: string;
  dureeMinutes: number;
  veterinaire?: string | null;
  motif?: string | null;
  statut: string;
  statutSalle: string;
  proprietaireNom?: string | null;
  animalNom?: string | null;
  patient?: { id: number; nom: string; espece: string } | null;
  owner?: { id: number; nom: string; prenom?: string | null; telephone?: string | null } | null;
};

type Statut = "en_attente_arrivee" | "arrive" | "en_consultation" | "en_attente_resultat" | "a_encaisser" | "termine";

const COLONNES: { id: Statut; label: string; color: string; bg: string; border: string }[] = [
  { id: "en_attente_arrivee", label: "En attente", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
  { id: "arrive",             label: "Arrivé",     color: "text-blue-600",  bg: "bg-blue-50",  border: "border-blue-200" },
  { id: "en_consultation",    label: "En consultation", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  { id: "a_encaisser",        label: "À encaisser", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { id: "termine",            label: "Partis",      color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
];

const FLOW: Statut[] = ["en_attente_arrivee", "arrive", "en_consultation", "a_encaisser", "termine"];

const ESPECE_EMOJI: Record<string, string> = {
  chien: "🐕", chat: "🐈", lapin: "🐇", oiseau: "🐦",
  reptile: "🦎", cochon_inde: "🐹", furet: "🐾", autre: "🐾",
};

const VET_COLORS = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
function vetColor(vet: string): string {
  let h = 0;
  for (let i = 0; i < vet.length; i++) h = (h * 31 + vet.charCodeAt(i)) & 0xffff;
  return VET_COLORS[h % VET_COLORS.length];
}

function elapsed(dateHeure: string): number {
  const start = new Date(dateHeure).getTime();
  return Math.floor((Date.now() - start) / 60000);
}

function formatTime(dateHeure: string): string {
  const normalized = dateHeure && !dateHeure.endsWith("Z") && !dateHeure.includes("+") ? dateHeure + "Z" : dateHeure;
  return new Date(normalized).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsedMinutes(dateHeure: string): number {
  const normalized = dateHeure && !dateHeure.endsWith("Z") && !dateHeure.includes("+") ? dateHeure + "Z" : dateHeure;
  return Math.floor((Date.now() - new Date(normalized).getTime()) / 60000);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function ElapsedBadge({ rdv }: { rdv: RDV }) {
  const [mins, setMins] = useState(() => elapsedMinutes(rdv.dateHeure));
  useEffect(() => {
    const t = setInterval(() => setMins(elapsedMinutes(rdv.dateHeure)), 30000);
    return () => clearInterval(t);
  }, [rdv.dateHeure]);

  if (rdv.statutSalle === "en_attente_arrivee" || rdv.statutSalle === "termine") return null;
  if (mins < 15) return null;
  const label = `${mins}min`;
  if (mins >= 30) return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><AlertCircle className="h-3 w-3" />{label}</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock className="h-3 w-3" />{label}</span>;
}

export default function SalleAttentePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<Statut | null>(null);
  const [showSansRdvModal, setShowSansRdvModal] = useState(false);
  const [sansRdvForm, setSansRdvForm] = useState({ patientId: "", patientNom: "", motif: "", patientSearch: "" });
  const [savingSansRdv, setSavingSansRdv] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [newRdvCount, setNewRdvCount] = useState(0);
  const prevIdsRef = useRef<Set<number>>(new Set());
  const { data: allPatients = [] } = useListPatients();
  const filteredPatients = sansRdvForm.patientSearch.length >= 2
    ? allPatients.filter(p => p.nom.toLowerCase().includes(sansRdvForm.patientSearch.toLowerCase()) ||
        (p.owner && `${p.owner.prenom ?? ""} ${p.owner.nom}`.toLowerCase().includes(sansRdvForm.patientSearch.toLowerCase()))
      ).slice(0, 6)
    : [];

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: rdvs = [], isFetching } = useQuery<RDV[]>({
    queryKey: ["salle-attente"],
    queryFn: () => fetch(`${API_BASE}/rendez-vous/salle-attente`).then(r => r.json()),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Détecter les nouveaux RDVs à chaque polling
  useEffect(() => {
    if (!rdvs.length) return;
    const currentIds = new Set(rdvs.map(r => r.id));

    if (prevIdsRef.current.size > 0) {
      const nouveaux = rdvs.filter(r => !prevIdsRef.current.has(r.id));
      if (nouveaux.length > 0) {
        setNewRdvCount(nouveaux.length);
        toast({
          title: `${nouveaux.length} nouveau${nouveaux.length > 1 ? "x" : ""} rendez-vous`,
          description: nouveaux
            .map(r => r.patient?.nom ?? r.animalNom ?? "Patient inconnu")
            .join(", "),
        });
        setTimeout(() => setNewRdvCount(0), 8000);
      }
    }

    prevIdsRef.current = currentIds;
    setLastSyncAt(new Date());
  }, [rdvs]);

  const updateStatut = useMutation({
    mutationFn: ({ id, statutSalle }: { id: number; statutSalle: Statut }) =>
      fetch(`${API_BASE}/rendez-vous/${id}/statut-salle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statutSalle }),
      }).then(r => { if (!r.ok) throw new Error("Erreur"); return r.json(); }),
    onMutate: async ({ id, statutSalle }) => {
      await qc.cancelQueries({ queryKey: ["salle-attente"] });
      const prev = qc.getQueryData<RDV[]>(["salle-attente"]);
      qc.setQueryData<RDV[]>(["salle-attente"], old =>
        old ? old.map(r => r.id === id ? { ...r, statutSalle } : r) : old
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["salle-attente"], ctx.prev);
      toast({ title: "Erreur de mise à jour", variant: "destructive" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["salle-attente"] }),
  });

  const moveRdv = useCallback((id: number, newStatut: Statut) => {
    updateStatut.mutate({ id, statutSalle: newStatut });
    if (newStatut === "a_encaisser") {
      const rdv = rdvs.find(r => r.id === id);
      if (rdv) toast({ title: `${rdv.patient?.nom ?? "Patient"} — ouverture de la facturation...` });
    }
  }, [updateStatut, rdvs, toast]);

  const moveStep = useCallback((rdv: RDV, dir: 1 | -1) => {
    const idx = FLOW.indexOf(rdv.statutSalle as Statut);
    const next = FLOW[idx + dir];
    if (next) moveRdv(rdv.id, next);
  }, [moveRdv]);

  const grouped = COLONNES.reduce((acc, col) => {
    acc[col.id] = rdvs.filter(r => r.statutSalle === col.id);
    return acc;
  }, {} as Record<Statut, RDV[]>);

  const summary = {
    enAttente: (grouped["en_attente_arrivee"] ?? []).length,
    arrive: (grouped["arrive"] ?? []).length,
    enConsultation: (grouped["en_consultation"] ?? []).length,
    aEncaisser: (grouped["a_encaisser"] ?? []).length,
    termine: (grouped["termine"] ?? []).length,
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.effectAllowed = "move";
    setDragId(id);
  };
  const handleDragOver = (e: React.DragEvent, col: Statut) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(col);
  };
  const handleDrop = (e: React.DragEvent, col: Statut) => {
    e.preventDefault();
    if (dragId !== null) moveRdv(dragId, col);
    setDragId(null);
    setDropTarget(null);
  };
  const handleDragEnd = () => { setDragId(null); setDropTarget(null); };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Salle d'attente</h1>
          <p className="text-sm text-muted-foreground capitalize">{formatDate(now)}</p>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5 font-mono text-base font-semibold text-foreground">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="hidden md:flex items-center gap-3 text-muted-foreground">
            {summary.enAttente > 0 && <span><strong className="text-foreground">{summary.enAttente}</strong> en attente</span>}
            {summary.arrive > 0 && <span><strong className="text-blue-600">{summary.arrive}</strong> arrivé{summary.arrive > 1 ? "s" : ""}</span>}
            {summary.enConsultation > 0 && <span><strong className="text-violet-600">{summary.enConsultation}</strong> en consultation</span>}
            {summary.aEncaisser > 0 && <span><strong className="text-amber-600">{summary.aEncaisser}</strong> à encaisser</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {newRdvCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary text-primary-foreground animate-bounce">
              +{newRdvCount} nouveau{newRdvCount > 1 ? "x" : ""}
            </span>
          )}
          {lastSyncAt && !isFetching && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Sync {lastSyncAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["salle-attente"] })}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => { setSansRdvForm({ patientId: "", patientNom: "", motif: "", patientSearch: "" }); setShowSansRdvModal(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Client sans RDV
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {COLONNES.map((col, colIdx) => {
          const cards = grouped[col.id] ?? [];
          const isDropTarget = dropTarget === col.id;
          return (
            <div
              key={col.id}
              className={`flex flex-col flex-1 min-w-0 border-r last:border-r-0 transition-colors ${
                isDropTarget ? "bg-primary/5" : "bg-gray-50/50"
              }`}
              onDragOver={e => handleDragOver(e, col.id)}
              onDrop={e => handleDrop(e, col.id)}
              onDragLeave={() => setDropTarget(null)}
            >
              {/* Column header */}
              <div className={`px-3 py-3 border-b ${col.bg} ${col.border} sticky top-0`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-widest ${col.color}`}>
                    {col.label}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.bg} ${col.border} border ${col.color}`}>
                    {cards.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {cards.length === 0 && (
                  <div className={`mt-4 mx-1 rounded-lg border-2 border-dashed ${col.border} p-4 text-center text-xs text-muted-foreground`}>
                    Vide
                  </div>
                )}
                {cards.map(rdv => {
                  const emoji = ESPECE_EMOJI[rdv.patient?.espece ?? ""] ?? "🐾";
                  const flowIdx = FLOW.indexOf(rdv.statutSalle as Statut);
                  const canPrev = flowIdx > 0;
                  const canNext = flowIdx < FLOW.length - 1;
                  const isDragging = dragId === rdv.id;

                  return (
                    <div
                      key={rdv.id}
                      draggable
                      onDragStart={e => handleDragStart(e, rdv.id)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white rounded-xl border shadow-sm transition-all cursor-grab active:cursor-grabbing select-none ${
                        isDragging ? "opacity-40 ring-2 ring-primary" : "hover:shadow-md hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="p-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-lg leading-none">{emoji}</span>
                            <span className="font-bold text-base truncate">
                              {rdv.patient?.nom ?? rdv.animalNom ?? "Client sans dossier"}
                            </span>
                          </div>
                          <ElapsedBadge rdv={rdv} />
                        </div>

                        {/* Owner */}
                        {(rdv.owner || rdv.proprietaireNom) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {rdv.owner ? `${rdv.owner.prenom ?? ""} ${rdv.owner.nom}`.trim() : rdv.proprietaireNom}
                            </span>
                          </div>
                        )}

                        {/* Time + Vet */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono font-semibold text-foreground">{formatTime(rdv.dateHeure)}</span>
                          {rdv.veterinaire && (
                            <div className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${vetColor(rdv.veterinaire)}`} />
                              <span className="truncate">{rdv.veterinaire}</span>
                            </div>
                          )}
                          {rdv.motif && <span className="truncate text-muted-foreground/70">· {rdv.motif}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="px-3 pb-2.5 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          {rdv.patient?.id && (
                            <Link href={`/consultations/nouvelle?patientId=${rdv.patient.id}`}>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-50">
                                <FileText className="h-3 w-3" />
                                Consulter
                              </Button>
                            </Link>
                          )}
                          {rdv.statutSalle === "a_encaisser" && (
                            <Link href="/encaissements">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                                <Euro className="h-3 w-3" />
                                Encaisser
                              </Button>
                            </Link>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 disabled:opacity-30"
                            disabled={!canPrev}
                            onClick={() => moveStep(rdv, -1)}
                            title="Étape précédente"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 disabled:opacity-30"
                            disabled={!canNext}
                            onClick={() => moveStep(rdv, 1)}
                            title="Étape suivante"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal — Client sans RDV */}
      <Dialog open={showSansRdvModal} onOpenChange={setShowSansRdvModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un client sans RDV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm mb-1.5 block">Patient <span className="text-muted-foreground">(optionnel)</span></Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un animal…"
                  className="pl-8"
                  value={sansRdvForm.patientSearch}
                  onChange={e => setSansRdvForm(f => ({ ...f, patientSearch: e.target.value, patientId: "", patientNom: "" }))}
                />
              </div>
              {filteredPatients.length > 0 && !sansRdvForm.patientId && (
                <div className="mt-1 border rounded-md bg-white shadow-sm divide-y max-h-40 overflow-y-auto">
                  {filteredPatients.map((p: any) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                      onClick={() => setSansRdvForm(f => ({
                        ...f,
                        patientId: String(p.id),
                        patientNom: `${p.nom} (${p.espece})`,
                        patientSearch: `${p.nom} — ${p.owner ? `${p.owner.prenom ?? ""} ${p.owner.nom}`.trim() : ""}`,
                      }))}
                    >
                      <span className="font-medium">{p.nom}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{p.espece}</span>
                      {p.owner && <span className="text-muted-foreground ml-2 text-xs">• {p.owner.prenom ?? ""} {p.owner.nom}</span>}
                    </button>
                  ))}
                </div>
              )}
              {sansRdvForm.patientId && (
                <p className="text-xs text-green-600 mt-1">✓ {sansRdvForm.patientNom} sélectionné</p>
              )}
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Motif de venue</Label>
              <Input
                placeholder="Ex. : contrôle, urgence, vaccin…"
                value={sansRdvForm.motif}
                onChange={e => setSansRdvForm(f => ({ ...f, motif: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSansRdvModal(false)}>Annuler</Button>
            <Button
              disabled={savingSansRdv}
              onClick={async () => {
                setSavingSansRdv(true);
                try {
                  const now = new Date();
                  const dateHeure = `${now.toISOString().split("T")[0]}T${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", ":")}`;
                  const res = await fetch(`${API_BASE}/agenda/rendez-vous`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      dateHeure,
                      dureeMinutes: 20,
                      motif: sansRdvForm.motif || "Consultation sans RDV",
                      typeRdv: "consultation",
                      patientId: sansRdvForm.patientId ? parseInt(sansRdvForm.patientId) : null,
                      animalNom: sansRdvForm.patientNom || sansRdvForm.patientSearch || null,
                    }),
                  });
                  if (!res.ok) throw new Error("Erreur serveur");
                  await qc.invalidateQueries({ queryKey: ["salle-attente"] });
                  setShowSansRdvModal(false);
                  toast({ title: "Client ajouté en salle d'attente" });
                } catch {
                  toast({ title: "Erreur lors de l'ajout", variant: "destructive" });
                } finally {
                  setSavingSansRdv(false);
                }
              }}
            >
              {savingSansRdv ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ajout…</> : "Ajouter en salle d'attente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
