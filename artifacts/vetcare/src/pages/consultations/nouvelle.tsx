import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useCreateConsultation, useListPatients, getListConsultationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus } from "lucide-react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";

export default function NouvelleConsultationPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();
  const createConsultation = useCreateConsultation();
  const { data: patients } = useListPatients();

  const params = new URLSearchParams(search);
  const preSelectedPatientId = params.get("patientId");

  const [form, setForm] = useState({
    patientId: preSelectedPatientId || "",
    veterinaire: user?.fullName || user?.firstName || "",
    date: new Date().toISOString().split("T")[0],
    motif: "",
    statut: "en_attente",
  });

  useEffect(() => {
    if (user && !form.veterinaire) {
      setForm(f => ({ ...f, veterinaire: user.fullName || user.firstName || "" }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId) {
      toast({ title: "Veuillez sélectionner un patient", variant: "destructive" });
      return;
    }
    try {
      const consultation = await createConsultation.mutateAsync({
        data: {
          patientId: parseInt(form.patientId),
          veterinaire: form.veterinaire,
          date: form.date,
          motif: form.motif || null,
          statut: form.statut,
        }
      });
      queryClient.invalidateQueries({ queryKey: getListConsultationsQueryKey() });
      toast({ title: "Consultation créée" });
      navigate(`/consultations/${consultation.id}`);
    } catch {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Link href="/consultations">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nouvelle Consultation</h1>
          <p className="text-muted-foreground">Démarrer une nouvelle consultation</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de la consultation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Patient *</Label>
              <Select value={form.patientId} onValueChange={v => setForm(f => ({ ...f, patientId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner un patient..." />
                </SelectTrigger>
                <SelectContent>
                  {patients?.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nom} ({p.espece}) — {p.owner?.prenom} {p.owner?.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vétérinaire *</Label>
              <Input className="mt-1" value={form.veterinaire} onChange={e => setForm(f => ({ ...f, veterinaire: e.target.value }))} required />
            </div>
            <div>
              <Label>Date *</Label>
              <Input className="mt-1" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <Label>Motif de consultation</Label>
              <Input className="mt-1" value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} placeholder="Ex: Vaccination annuelle, Boiterie..." />
            </div>
            <div className="flex gap-3 pt-2">
              <Link href="/consultations">
                <Button type="button" variant="outline">Annuler</Button>
              </Link>
              <Button type="submit" disabled={createConsultation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {createConsultation.isPending ? "Création..." : "Démarrer la consultation"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
