import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Syringe, Bell, Clock, CheckCircle2, Mail, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const VACCINES = ["RAGE", "HEPATITE", "LEPTO", "PARVO", "HERPES", "FeLV", "CALICI", "TYPHUS", "MYXO", "RHD", "AUTRE"];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  SENT: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

export default function VaccinationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("vaccins");
  const [addDialog, setAddDialog] = useState(false);
  const [relanceDialog, setRelanceDialog] = useState<any>(null);
  const [sendMessage, setSendMessage] = useState("");
  const [form, setForm] = useState<any>({ vaccineType: "RAGE", vaccineDate: new Date().toISOString().slice(0,10) });

  const { data: statsData } = useQuery({
    queryKey: ["vacc-stats"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/vaccinations/stats`);
      return r.json();
    },
  });
  const stats = statsData?.data ?? {};

  const { data: vaccData, isLoading: vaccLoading } = useQuery({
    queryKey: ["vaccinations"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/vaccinations`);
      return r.json();
    },
    enabled: tab === "vaccins",
  });
  const vaccinations: any[] = vaccData?.data ?? [];

  const { data: rappelData, isLoading: rappelLoading } = useQuery({
    queryKey: ["vacc-rappels"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/vaccinations/rappels`);
      return r.json();
    },
    enabled: tab === "rappels",
  });
  const rappels: any[] = rappelData?.data ?? [];

  const { data: upcomingData } = useQuery({
    queryKey: ["vacc-upcoming"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/vaccinations?upcoming=true`);
      return r.json();
    },
    enabled: tab === "calendrier",
  });
  const upcoming: any[] = upcomingData?.data ?? [];

  const addMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`${API_BASE}/api/vaccinations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("Erreur enregistrement");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Vaccination enregistrée" }); qc.invalidateQueries({ queryKey: ["vaccinations"] }); qc.invalidateQueries({ queryKey: ["vacc-stats"] }); setAddDialog(false); setForm({ vaccineType: "RAGE", vaccineDate: new Date().toISOString().slice(0,10) }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const sendRappelMutation = useMutation({
    mutationFn: async ({ id, message }: { id: number; message: string }) => {
      const r = await fetch(`${API_BASE}/api/vaccinations/rappels/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      if (!r.ok) throw new Error("Erreur envoi");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Rappel marqué comme envoyé" }); qc.invalidateQueries({ queryKey: ["vacc-rappels"] }); qc.invalidateQueries({ queryKey: ["vacc-stats"] }); setRelanceDialog(null); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openRelance = (rappel: any) => {
    setSendMessage(`Bonjour ${rappel.owner_name},\n\nNous vous rappelons que ${rappel.patient_name} doit renouveler son vaccin ${rappel.vaccine_type}${rappel.next_due_date ? ` avant le ${new Date(rappel.next_due_date).toLocaleDateString("fr-FR")}` : ""}.\n\nN'hésitez pas à prendre rendez-vous pour maintenir une protection optimale.\n\nCordialement,\nL'équipe vétérinaire`);
    setRelanceDialog(rappel);
  };

  const jours = (d: string | null) => {
    if (!d) return null;
    const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Syringe className="h-6 w-6 text-teal-600" />Vaccinations & Rappels</h1>
          <p className="text-muted-foreground text-sm mt-1">Historique vaccinal et relances automatiques</p>
        </div>
        <Button onClick={() => setAddDialog(true)}><Syringe className="h-4 w-4 mr-2" />Enregistrer un vaccin</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Total vaccinations</div>
          <div className="text-2xl font-bold">{stats.total_vaccins ?? 0}</div>
        </CardContent></Card>
        <Card className={Number(stats.rappels_30j) > 0 ? "border-yellow-300" : ""}><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-1"><Clock className="h-3 w-3" />Rappels 30j</div>
          <div className={`text-2xl font-bold ${Number(stats.rappels_30j) > 0 ? "text-yellow-600" : ""}`}>{stats.rappels_30j ?? 0}</div>
        </CardContent></Card>
        <Card className={Number(stats.rappels_en_retard) > 0 ? "border-red-300" : ""}><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" />En retard</div>
          <div className={`text-2xl font-bold ${Number(stats.rappels_en_retard) > 0 ? "text-red-600" : ""}`}>{stats.rappels_en_retard ?? 0}</div>
        </CardContent></Card>
        <Card className={Number(stats.relances_pending) > 0 ? "border-orange-300" : ""}><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-1"><Bell className="h-3 w-3 text-orange-500" />Relances à envoyer</div>
          <div className={`text-2xl font-bold ${Number(stats.relances_pending) > 0 ? "text-orange-600" : ""}`}>{stats.relances_pending ?? 0}</div>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="vaccins">Historique</TabsTrigger>
          <TabsTrigger value="calendrier">Calendrier rappels (60j)</TabsTrigger>
          <TabsTrigger value="rappels">Relances à envoyer {Number(stats.relances_pending) > 0 && <Badge variant="destructive" className="ml-2 text-xs">{stats.relances_pending}</Badge>}</TabsTrigger>
        </TabsList>

        {/* Historique */}
        <TabsContent value="vaccins">
          <Card><CardContent className="p-0">
            {vaccLoading ? <div className="text-center py-8 text-muted-foreground">Chargement…</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="text-left p-3 font-medium">Patient</th>
                      <th className="text-left p-3 font-medium">Propriétaire</th>
                      <th className="text-left p-3 font-medium">Vaccin</th>
                      <th className="text-center p-3 font-medium">Date</th>
                      <th className="text-center p-3 font-medium">Prochain rappel</th>
                      <th className="text-center p-3 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaccinations.map(v => {
                      const j = jours(v.next_due_date);
                      const isOverdue = j !== null && j < 0;
                      const isSoon = j !== null && j >= 0 && j <= 30;
                      return (
                        <tr key={v.id} className="border-b hover:bg-muted/20">
                          <td className="p-3"><div className="font-medium">{v.patient_name}</div><div className="text-xs text-muted-foreground">{v.patient_species}{v.patient_breed ? ` — ${v.patient_breed}` : ""}</div></td>
                          <td className="p-3"><div>{v.owner_name}</div>{v.owner_email && <div className="text-xs text-muted-foreground">{v.owner_email}</div>}</td>
                          <td className="p-3"><Badge variant="outline" className="text-xs">{v.vaccine_type}</Badge>{v.vaccine_name && <div className="text-xs text-muted-foreground mt-0.5">{v.vaccine_name}</div>}</td>
                          <td className="p-3 text-center text-muted-foreground">{new Date(v.vaccine_date).toLocaleDateString("fr-FR")}</td>
                          <td className="p-3 text-center">
                            {v.next_due_date ? (
                              <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : isSoon ? "text-yellow-600" : "text-green-600"}`}>
                                {new Date(v.next_due_date).toLocaleDateString("fr-FR")}
                                {isOverdue ? " ⚠️" : isSoon ? " 🔔" : ""}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-center">
                            {v.reminder_status ? <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[v.reminder_status]||""}`}>{v.reminder_status}</span> : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {vaccinations.length === 0 && <div className="text-center py-8 text-muted-foreground">Aucune vaccination enregistrée</div>}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Calendrier 60j */}
        <TabsContent value="calendrier">
          <Card><CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left p-3 font-medium">Patient</th>
                    <th className="text-left p-3 font-medium">Propriétaire</th>
                    <th className="text-left p-3 font-medium">Vaccin</th>
                    <th className="text-center p-3 font-medium">Rappel dû le</th>
                    <th className="text-center p-3 font-medium">J restants</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map(v => {
                    const j = jours(v.next_due_date);
                    const isOverdue = j !== null && j < 0;
                    return (
                      <tr key={v.id} className={`border-b hover:bg-muted/20 ${isOverdue ? "bg-red-50" : j !== null && j <= 7 ? "bg-orange-50" : ""}`}>
                        <td className="p-3 font-medium">{v.patient_name}<div className="text-xs text-muted-foreground">{v.patient_species}</div></td>
                        <td className="p-3">{v.owner_name}{v.owner_email && <div className="text-xs text-muted-foreground">{v.owner_email}</div>}</td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{v.vaccine_type}</Badge></td>
                        <td className="p-3 text-center">{v.next_due_date ? new Date(v.next_due_date).toLocaleDateString("fr-FR") : "—"}</td>
                        <td className={`p-3 text-center font-bold ${isOverdue ? "text-red-600" : j !== null && j <= 7 ? "text-orange-600" : "text-yellow-600"}`}>
                          {j !== null ? (isOverdue ? `${Math.abs(j)}j retard` : `${j}j`) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {upcoming.length === 0 && <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2"><CheckCircle2 className="h-8 w-8 text-green-400" /><span>Aucun rappel dans les 60 prochains jours</span></div>}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* Relances */}
        <TabsContent value="rappels">
          <Card><CardContent className="p-0">
            {rappelLoading ? <div className="text-center py-8 text-muted-foreground">Chargement…</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="text-left p-3 font-medium">Patient</th>
                      <th className="text-left p-3 font-medium">Propriétaire</th>
                      <th className="text-left p-3 font-medium">Vaccin</th>
                      <th className="text-center p-3 font-medium">Rappel dû</th>
                      <th className="text-center p-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rappels.map(r => (
                      <tr key={r.id} className="border-b hover:bg-muted/20">
                        <td className="p-3 font-medium">{r.patient_name}<div className="text-xs text-muted-foreground">{r.species}</div></td>
                        <td className="p-3">{r.owner_name}{r.owner_email && <div className="text-xs text-muted-foreground">{r.owner_email}</div>}</td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{r.vaccine_type}</Badge></td>
                        <td className="p-3 text-center text-muted-foreground">{r.next_due_date ? new Date(r.next_due_date).toLocaleDateString("fr-FR") : "—"}</td>
                        <td className="p-3 text-center">
                          <Button size="sm" variant="outline" onClick={() => openRelance(r)} disabled={!r.owner_email} title={!r.owner_email ? "Email non renseigné" : ""}>
                            <Mail className="h-3 w-3 mr-1" />Envoyer rappel
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rappels.length === 0 && <div className="text-center py-8 flex flex-col items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-8 w-8 text-green-400" /><span>Aucun rappel en attente</span></div>}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Ajout Vaccination */}
      <Dialog open={addDialog} onOpenChange={o => !o && setAddDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Enregistrer une vaccination</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><label className="text-sm font-medium">ID Patient *</label><Input type="number" placeholder="Patient ID" value={form.patientId||""} onChange={e => setForm({...form, patientId: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Type vaccin *</label>
                <Select value={form.vaccineType||"RAGE"} onValueChange={v => setForm({...form, vaccineType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VACCINES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="text-sm font-medium">Nom commercial</label><Input value={form.vaccineName||""} onChange={e => setForm({...form, vaccineName: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Date vaccination *</label><Input type="date" value={form.vaccineDate||""} onChange={e => setForm({...form, vaccineDate: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Prochain rappel</label><Input type="date" value={form.nextDueDate||""} onChange={e => setForm({...form, nextDueDate: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">N° lot</label><Input value={form.batchNumber||""} onChange={e => setForm({...form, batchNumber: e.target.value})} /></div>
              <div className="col-span-2 space-y-1"><label className="text-sm font-medium">Notes</label><Input value={form.notes||""} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Annuler</Button>
            <Button onClick={() => addMutation.mutate(form)} disabled={addMutation.isPending || !form.patientId || !form.vaccineType}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Rappel */}
      <Dialog open={!!relanceDialog} onOpenChange={o => !o && setRelanceDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Rappel vaccinal — {relanceDialog?.patient_name}</DialogTitle></DialogHeader>
          {relanceDialog && (
            <div className="space-y-3">
              <div className="bg-muted/40 rounded p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">Propriétaire :</span> <strong>{relanceDialog.owner_name}</strong></div>
                <div><span className="text-muted-foreground">Email :</span> {relanceDialog.owner_email}</div>
                <div><span className="text-muted-foreground">Vaccin :</span> {relanceDialog.vaccine_type}</div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Message</label>
                <Textarea rows={8} value={sendMessage} onChange={e => setSendMessage(e.target.value)} className="text-sm" />
                <p className="text-xs text-muted-foreground">Ce message sera tracé. L'envoi doit être fait depuis votre messagerie.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelanceDialog(null)}>Annuler</Button>
            <Button onClick={() => sendRappelMutation.mutate({ id: relanceDialog.id, message: sendMessage })} disabled={sendRappelMutation.isPending}>
              <Mail className="h-4 w-4 mr-2" />Marquer comme envoyé
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
