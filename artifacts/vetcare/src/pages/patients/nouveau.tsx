import { useState } from "react";
import { useLocation } from "wouter";
import { useCreatePatient, useCreateOwner, useListOwners, getListPatientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus } from "lucide-react";
import { Link } from "wouter";

export default function NouveauPatientPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createPatient = useCreatePatient();
  const createOwner = useCreateOwner();
  const { data: owners } = useListOwners();

  const [ownerMode, setOwnerMode] = useState<"existing" | "new">("new");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");

  const [ownerForm, setOwnerForm] = useState({
    nom: "", prenom: "", email: "", telephone: "", adresse: ""
  });
  const [consentementRgpd, setConsentementRgpd] = useState(false);
  const [patientForm, setPatientForm] = useState({
    nom: "", espece: "chien", race: "", sexe: "mâle", dateNaissance: "",
    poids: "", couleur: "", sterilise: false, antecedents: "", allergies: "",
    puce: "", passeport: "", assurance: false, assuranceNom: "", agressif: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentementRgpd) {
      toast({ title: "Le consentement RGPD est obligatoire", variant: "destructive" });
      return;
    }
    try {
      let ownerId: number;

      if (ownerMode === "new") {
        const owner = await createOwner.mutateAsync({
          data: {
            nom: ownerForm.nom,
            prenom: ownerForm.prenom,
            email: ownerForm.email || null,
            telephone: ownerForm.telephone,
            adresse: ownerForm.adresse || null,
          }
        });
        ownerId = owner.id;
      } else {
        ownerId = parseInt(selectedOwnerId);
      }

      await createPatient.mutateAsync({
        data: {
          nom: patientForm.nom,
          espece: patientForm.espece,
          race: patientForm.race || null,
          sexe: patientForm.sexe,
          dateNaissance: patientForm.dateNaissance || null,
          poids: patientForm.poids ? parseFloat(patientForm.poids) : null,
          couleur: patientForm.couleur || null,
          sterilise: patientForm.sterilise,
          ownerId,
          antecedents: patientForm.antecedents || null,
          allergies: patientForm.allergies || null,
          puce: patientForm.puce || null,
          passeport: patientForm.passeport || null,
          assurance: patientForm.assurance,
          assuranceNom: patientForm.assuranceNom || null,
          agressif: patientForm.agressif,
          consentementRgpd: true,
          dateConsentement: new Date().toISOString(),
        } as any
      });

      queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      toast({ title: "Patient créé avec succès" });
      navigate("/patients");
    } catch {
      toast({ title: "Erreur lors de la création du patient", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/patients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nouveau Patient</h1>
          <p className="text-muted-foreground">Créer un nouveau dossier patient</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Propriétaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                type="button"
                variant={ownerMode === "new" ? "default" : "outline"}
                onClick={() => setOwnerMode("new")}
              >
                Nouveau propriétaire
              </Button>
              <Button
                type="button"
                variant={ownerMode === "existing" ? "default" : "outline"}
                onClick={() => setOwnerMode("existing")}
              >
                Propriétaire existant
              </Button>
            </div>

            {ownerMode === "existing" ? (
              <div>
                <Label>Sélectionner un propriétaire</Label>
                <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choisir un propriétaire..." />
                  </SelectTrigger>
                  <SelectContent>
                    {owners?.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.prenom} {o.nom} — {o.telephone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Nom *</Label>
                  <Input className="mt-1" value={ownerForm.nom} onChange={e => setOwnerForm(f => ({ ...f, nom: e.target.value }))} required />
                </div>
                <div>
                  <Label>Prénom *</Label>
                  <Input className="mt-1" value={ownerForm.prenom} onChange={e => setOwnerForm(f => ({ ...f, prenom: e.target.value }))} required />
                </div>
                <div>
                  <Label>Téléphone *</Label>
                  <Input className="mt-1" value={ownerForm.telephone} onChange={e => setOwnerForm(f => ({ ...f, telephone: e.target.value }))} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input className="mt-1" type="email" value={ownerForm.email} onChange={e => setOwnerForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <Label>Adresse</Label>
                  <Input className="mt-1" value={ownerForm.adresse} onChange={e => setOwnerForm(f => ({ ...f, adresse: e.target.value }))} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations du patient</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Nom de l'animal *</Label>
                <Input className="mt-1" value={patientForm.nom} onChange={e => setPatientForm(f => ({ ...f, nom: e.target.value }))} required />
              </div>
              <div>
                <Label>Espèce *</Label>
                <Select value={patientForm.espece} onValueChange={v => setPatientForm(f => ({ ...f, espece: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chien">Chien</SelectItem>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="lapin">Lapin</SelectItem>
                    <SelectItem value="oiseau">Oiseau</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Race</Label>
                <Input className="mt-1" value={patientForm.race} onChange={e => setPatientForm(f => ({ ...f, race: e.target.value }))} />
              </div>
              <div>
                <Label>Sexe *</Label>
                <Select value={patientForm.sexe} onValueChange={v => setPatientForm(f => ({ ...f, sexe: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mâle">Mâle</SelectItem>
                    <SelectItem value="femelle">Femelle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date de naissance</Label>
                <Input className="mt-1" type="date" value={patientForm.dateNaissance} onChange={e => setPatientForm(f => ({ ...f, dateNaissance: e.target.value }))} />
              </div>
              <div>
                <Label>Poids (kg)</Label>
                <Input className="mt-1" type="number" step="0.1" value={patientForm.poids} onChange={e => setPatientForm(f => ({ ...f, poids: e.target.value }))} />
              </div>
              <div>
                <Label>Couleur / Robe</Label>
                <Input className="mt-1" value={patientForm.couleur} onChange={e => setPatientForm(f => ({ ...f, couleur: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={patientForm.sterilise} onCheckedChange={v => setPatientForm(f => ({ ...f, sterilise: v }))} />
                <Label>Stérilisé(e)</Label>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={patientForm.agressif} onCheckedChange={v => setPatientForm(f => ({ ...f, agressif: v }))} id="agressif" />
              <Label htmlFor="agressif" className="text-destructive font-semibold">Animal agressif</Label>
              {patientForm.agressif && (
                <span className="inline-flex items-center bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">AGRESSIF</span>
              )}
            </div>
            <div>
              <Label>Antécédents médicaux</Label>
              <Textarea className="mt-1" rows={3} value={patientForm.antecedents} onChange={e => setPatientForm(f => ({ ...f, antecedents: e.target.value }))} placeholder="Maladies passées, interventions chirurgicales..." />
            </div>
            <div>
              <Label>Allergies connues</Label>
              <Textarea className="mt-1" rows={2} value={patientForm.allergies} onChange={e => setPatientForm(f => ({ ...f, allergies: e.target.value }))} placeholder="Allergies connues..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identification &amp; Assurance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Numéro de puce électronique (transpondeur)</Label>
                <Input className="mt-1" value={patientForm.puce} onChange={e => setPatientForm(f => ({ ...f, puce: e.target.value }))} placeholder="123456789012345" />
              </div>
              <div>
                <Label>Numéro de passeport</Label>
                <Input className="mt-1" value={patientForm.passeport} onChange={e => setPatientForm(f => ({ ...f, passeport: e.target.value }))} placeholder="FR..." />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={patientForm.assurance} onCheckedChange={v => setPatientForm(f => ({ ...f, assurance: v }))} id="assurance" />
                <Label htmlFor="assurance">Animal assuré</Label>
              </div>
              {patientForm.assurance && (
                <div>
                  <Label>Nom de la compagnie d'assurance</Label>
                  <Input className="mt-1" value={patientForm.assuranceNom} onChange={e => setPatientForm(f => ({ ...f, assuranceNom: e.target.value }))} placeholder="Compagnie d'assurance..." />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="consentement_rgpd"
                checked={consentementRgpd}
                onChange={e => setConsentementRgpd(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <label htmlFor="consentement_rgpd" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                <span className="text-destructive font-medium">* </span>
                J'accepte que les données de l'animal et du propriétaire soient traitées conformément à la{" "}
                <a href="/confidentialite" target="_blank" className="text-primary underline hover:no-underline">
                  politique de confidentialité
                </a>{" "}
                de la clinique, conformément au RGPD (Règlement Général sur la Protection des Données).
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Link href="/patients">
            <Button type="button" variant="outline">Annuler</Button>
          </Link>
          <Button type="submit" disabled={createPatient.isPending || createOwner.isPending || !consentementRgpd}>
            <Plus className="mr-2 h-4 w-4" />
            {createPatient.isPending ? "Création..." : "Créer le patient"}
          </Button>
        </div>
      </form>
    </div>
  );
}
