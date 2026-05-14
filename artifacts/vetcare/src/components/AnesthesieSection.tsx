import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Loader2, Sparkles, Save } from "lucide-react";

import { unwrapResponse as __unwrapResponse } from "../lib/queryClient";

const API_BASE = "/api";

type AnesthesieData = {
  id?: number; consultationId: number; poids?: number; premedication?: string;
  premedicationDose?: string; premedicationVoie?: string; induction?: string; inductionDose?: string;
  maintenance?: string; maintenancePourcentage?: number; heureReveil?: string;
  scoreReveil?: number; complications?: string; notes?: string; protocoleIA?: string;
};

type Props = {
  consultationId: number;
  espece?: string;
  race?: string;
  poids?: number;
  diagnostic?: string;
};

export function AnesthesieSection({ consultationId, espece, race, poids, diagnostic }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [generatingIA, setGeneratingIA] = useState(false);
  const [form, setForm] = useState<Partial<AnesthesieData>>({});
  const [initialized, setInitialized] = useState(false);

  const { data: protocole, isLoading } = useQuery<AnesthesieData | null>({
    queryKey: ["anesthesie", consultationId],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/anesthesie/consultation/${consultationId}`);
      if (!r.ok) throw new Error();
      return __unwrapResponse(r);
    },
    enabled: open,
    select: (data) => {
      if (data && !initialized) {
        setForm(data);
        setInitialized(true);
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/anesthesie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consultationId }),
      });
      if (!r.ok) throw new Error("Erreur");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["anesthesie", consultationId] }); toast({ title: "Protocole enregistre" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const genererIA = async () => {
    setGeneratingIA(true);
    try {
      const r = await fetch(`${API_BASE}/anesthesie/generer-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ espece, race, poids: form.poids ?? poids, diagnostic }),
      });
      const data: any = await __unwrapResponse(r);
      if (data.protocole) {
        setForm(f => ({ ...f, protocoleIA: data.protocole }));
        toast({ title: "Protocole IA genere" });
      }
    } catch {
      toast({ title: "Erreur IA", variant: "destructive" });
    } finally {
      setGeneratingIA(false);
    }
  };

  const f = (key: keyof AnesthesieData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Protocole d'anesthesie
            {protocole && <Badge variant="secondary" className="text-xs">Enregistre</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{open ? "Reduire" : "Developper"}</span>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 pt-0">
          {isLoading && <div className="text-sm text-muted-foreground text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Poids (kg)</Label>
              <Input type="number" step="0.1" value={form.poids ?? ""} onChange={e => setForm(p => ({ ...p, poids: parseFloat(e.target.value) }))} placeholder={poids?.toString()} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Premedication</Label>
              <Input value={form.premedication ?? ""} onChange={f("premedication")} placeholder="Acepromazine..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dose premed. (mg/kg)</Label>
              <Input value={form.premedicationDose ?? ""} onChange={f("premedicationDose")} placeholder="0.05" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Voie premed.</Label>
              <Input value={form.premedicationVoie ?? ""} onChange={f("premedicationVoie")} placeholder="IM / SC / IV" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Induction</Label>
              <Input value={form.induction ?? ""} onChange={f("induction")} placeholder="Propofol..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dose induction (mg/kg)</Label>
              <Input value={form.inductionDose ?? ""} onChange={f("inductionDose")} placeholder="4-6" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Maintenance</Label>
              <Input value={form.maintenance ?? ""} onChange={f("maintenance")} placeholder="Isoflurane" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">% maintenance</Label>
              <Input type="number" step="0.1" value={form.maintenancePourcentage ?? ""} onChange={e => setForm(p => ({ ...p, maintenancePourcentage: parseFloat(e.target.value) }))} placeholder="1.5-2.5" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Heure reveil</Label>
              <Input type="time" value={form.heureReveil ?? ""} onChange={f("heureReveil")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Score reveil (1-5)</Label>
              <Input type="number" min={1} max={5} value={form.scoreReveil ?? ""} onChange={e => setForm(p => ({ ...p, scoreReveil: parseInt(e.target.value) }))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Complications / evenements</Label>
            <Textarea value={form.complications ?? ""} onChange={f("complications")} rows={2} placeholder="RAS / Hypotension transitoire..." />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes ?? ""} onChange={f("notes")} rows={2} />
          </div>

          <Button variant="outline" size="sm" onClick={genererIA} disabled={generatingIA} className="w-full">
            {generatingIA ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generer protocole IA
          </Button>

          {form.protocoleIA && (
            <div className="space-y-1">
              <Label className="text-xs">Recommandations IA</Label>
              <pre className="text-xs whitespace-pre-wrap bg-muted/30 rounded-lg p-3 leading-relaxed max-h-48 overflow-y-auto">{form.protocoleIA}</pre>
            </div>
          )}

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Enregistrement..." : "Enregistrer le protocole"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
