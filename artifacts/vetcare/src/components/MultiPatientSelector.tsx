import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, PlusCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API = "/api";

interface Patient { id: number; nom: string; espece: string; ownerName?: string | null; }
interface LinkedPatient { id: number; patientId: number; patientName: string; espece: string; ownerName?: string | null; }

async function fetchAllPatients(): Promise<Patient[]> {
  const r = await fetch(`${API}/patients`);
  const d = await r.json();
  return d.data ?? [];
}

interface Props { consultationId: number; primaryPatientId?: number | null; }

export function MultiPatientSelector({ consultationId, primaryPatientId }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");

  const { data: linked = [] } = useQuery<LinkedPatient[]>({
    queryKey: ["consult-patients", consultationId],
    queryFn: async () => {
      const r = await fetch(`${API}/consultations/${consultationId}/patients`);
      const d = await r.json();
      return d.data ?? [];
    },
  });

  const { data: allPatients = [] } = useQuery<Patient[]>({
    queryKey: ["patients-list"],
    queryFn: fetchAllPatients,
  });

  const addMutation = useMutation({
    mutationFn: async (patientId: number) => {
      const r = await fetch(`${API}/consultations/${consultationId}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      if (!r.ok) throw new Error("Erreur ajout patient");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["consult-patients", consultationId] }); setSelected(""); },
  });

  const removeMutation = useMutation({
    mutationFn: async (patientId: number) => {
      await fetch(`${API}/consultations/${consultationId}/patients/${patientId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consult-patients", consultationId] }),
  });

  const linkedIds = new Set(linked.map(l => l.patientId));
  const available = allPatients.filter(p => p.id !== primaryPatientId && !linkedIds.has(p.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>Animaux supplémentaires</span>
      </div>
      {linked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {linked.map(l => (
            <Badge key={l.id} variant="secondary" className="flex items-center gap-1 pr-1">
              <span>{l.patientName} ({l.espece})</span>
              <button onClick={() => removeMutation.mutate(l.patientId)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div className="flex gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-8 text-xs w-48">
              <SelectValue placeholder="Ajouter un animal..." />
            </SelectTrigger>
            <SelectContent>
              {available.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nom} ({p.espece})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={!selected || addMutation.isPending}
            onClick={() => selected && addMutation.mutate(Number(selected))}
          >
            <PlusCircle className="h-3 w-3 mr-1" />
            Ajouter
          </Button>
        </div>
      )}
    </div>
  );
}
