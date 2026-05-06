import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PlusCircle, Trash2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MotherPatient {
  id: number;
  nom: string;
  espece: string;
  race?: string;
  ownerId: number;
  clinicId?: number;
}

interface Props {
  motherPatient: MotherPatient;
  fatherId?: number;
  onSuccess?: () => void;
}

interface Petit {
  nom: string;
  sexe: string;
  couleur: string;
  poids: string;
}

const emptyPetit = (): Petit => ({ nom: "", sexe: "M", couleur: "", poids: "" });

export function PorteeForm({ motherPatient, fatherId, onSuccess }: Props) {
  const [petits, setPetits] = useState<Petit[]>([emptyPetit()]);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const patients = petits.map(p => ({
        nom: p.nom || `${motherPatient.nom} - petit`,
        espece: motherPatient.espece,
        race: motherPatient.race,
        sexe: p.sexe,
        couleur: p.couleur || undefined,
        poids: p.poids ? parseFloat(p.poids) : undefined,
        ownerId: motherPatient.ownerId,
        clinicId: motherPatient.clinicId,
      }));
      const r = await fetch(`${API_BASE}/api/patients/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patients, motherId: motherPatient.id, fatherId }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(`${data.count} petits enregistrés avec succès`);
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(`Erreur: ${err.message}`);
    },
  });

  const addPetit = () => {
    if (petits.length < 20) setPetits(p => [...p, emptyPetit()]);
  };

  const removePetit = (idx: number) => {
    if (petits.length > 1) setPetits(p => p.filter((_, i) => i !== idx));
  };

  const updatePetit = (idx: number, field: keyof Petit, val: string) => {
    setPetits(p => p.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Mère: <strong>{motherPatient.nom}</strong> ({motherPatient.espece}
        {motherPatient.race ? ` - ${motherPatient.race}` : ""})
      </div>

      <div className="space-y-3">
        {petits.map((p, idx) => (
          <div key={idx} className="flex flex-wrap gap-2 items-end p-3 border rounded-lg bg-muted/30">
            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
              <Label className="text-xs">Nom</Label>
              <Input
                placeholder={`Petit ${idx + 1}`}
                value={p.nom}
                onChange={e => updatePetit(idx, "nom", e.target.value)}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Sexe</Label>
              <Select value={p.sexe} onValueChange={v => updatePetit(idx, "sexe", v)}>
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">M</SelectItem>
                  <SelectItem value="F">F</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
              <Label className="text-xs">Couleur / robe</Label>
              <Input
                placeholder="ex: noir"
                value={p.couleur}
                onChange={e => updatePetit(idx, "couleur", e.target.value)}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1 w-20">
              <Label className="text-xs">Poids (kg)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={p.poids}
                onChange={e => updatePetit(idx, "poids", e.target.value)}
                className="h-8"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => removePetit(idx)}
              disabled={petits.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPetit}
          disabled={petits.length >= 20}
        >
          <PlusCircle className="h-4 w-4 mr-1" />
          Ajouter un petit
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          size="sm"
        >
          {mutation.isPending ? "Enregistrement..." : `Enregistrer la portée (${petits.length})`}
        </Button>
      </div>
    </div>
  );
}
