import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { User, Building, Shield, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";

interface ParametresClinique {
  id: number | null;
  nomClinique: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  siteWeb: string | null;
  siret: string | null;
  numeroOrdre: string | null;
  numTVA: string | null;
  horaires: string | null;
  mentionsLegales: string | null;
}

async function fetchClinique(): Promise<ParametresClinique> {
  const r = await fetch(`${API_BASE}/parametres-clinique`);
  if (!r.ok) throw new Error("Erreur serveur");
  return r.json();
}

async function saveClinique(data: Omit<ParametresClinique, "id">): Promise<ParametresClinique> {
  const r = await fetch(`${API_BASE}/parametres-clinique`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Erreur serveur");
  return r.json();
}

function CliniqueForm() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["parametres-clinique"],
    queryFn: fetchClinique,
  });

  const [form, setForm] = useState({
    nomClinique: "",
    adresse: "",
    codePostal: "",
    ville: "",
    telephone: "",
    email: "",
    siteWeb: "",
    siret: "",
    numeroOrdre: "",
    numTVA: "",
    horaires: "",
    mentionsLegales: "",
  });

  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        nomClinique: data.nomClinique ?? "",
        adresse: data.adresse ?? "",
        codePostal: data.codePostal ?? "",
        ville: data.ville ?? "",
        telephone: data.telephone ?? "",
        email: data.email ?? "",
        siteWeb: data.siteWeb ?? "",
        siret: data.siret ?? "",
        numeroOrdre: data.numeroOrdre ?? "",
        numTVA: data.numTVA ?? "",
        horaires: data.horaires ?? "",
        mentionsLegales: data.mentionsLegales ?? "",
      });
      setIsDirty(false);
    }
  }, [data]);

  const { mutate, isPending } = useMutation({
    mutationFn: saveClinique,
    onSuccess: () => {
      toast({ title: "Paramètres enregistrés", description: "Les informations de la clinique ont été mises à jour." });
      qc.invalidateQueries({ queryKey: ["parametres-clinique"] });
      setIsDirty(false);
    },
    onError: () => toast({ title: "Erreur", description: "Impossible d'enregistrer.", variant: "destructive" }),
  });

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setIsDirty(true);
  }

  function handleSave() {
    mutate({
      nomClinique: form.nomClinique || null,
      adresse: form.adresse || null,
      codePostal: form.codePostal || null,
      ville: form.ville || null,
      telephone: form.telephone || null,
      email: form.email || null,
      siteWeb: form.siteWeb || null,
      siret: form.siret || null,
      numeroOrdre: form.numeroOrdre || null,
      numTVA: form.numTVA || null,
      horaires: form.horaires || null,
      mentionsLegales: form.mentionsLegales || null,
    });
  }

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <Label>Nom de la clinique</Label>
          <Input
            placeholder="Nom de votre clinique"
            value={form.nomClinique}
            onChange={e => update("nomClinique", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Adresse</Label>
          <Input
            placeholder="Adresse complète"
            value={form.adresse}
            onChange={e => update("adresse", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Code postal</Label>
            <Input
              placeholder="Code postal"
              value={form.codePostal}
              onChange={e => update("codePostal", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ville</Label>
            <Input
              placeholder="Ville"
              value={form.ville}
              onChange={e => update("ville", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Telephone</Label>
            <Input
              placeholder="01 23 45 67 89"
              value={form.telephone}
              onChange={e => update("telephone", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="contact@clinique.fr"
              value={form.email}
              onChange={e => update("email", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Site web</Label>
          <Input
            placeholder="https://www.clinique-veterinaire.fr"
            value={form.siteWeb}
            onChange={e => update("siteWeb", e.target.value)}
          />
        </div>
      </div>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informations légales</p>

      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>SIRET</Label>
            <Input
              placeholder="12345678901234"
              value={form.siret}
              onChange={e => update("siret", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>N° TVA intracommunautaire</Label>
            <Input
              placeholder="FR12345678901"
              value={form.numTVA}
              onChange={e => update("numTVA", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>N° Ordre vétérinaire (RPPS / ONVS)</Label>
          <Input
            placeholder="ONVS-12345"
            value={form.numeroOrdre}
            onChange={e => update("numeroOrdre", e.target.value)}
          />
        </div>
      </div>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informations complémentaires</p>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <Label>Horaires d'ouverture</Label>
          <Textarea
            placeholder="Lun-Ven : 8h-19h&#10;Sam : 9h-17h&#10;Urgences 24h/24"
            value={form.horaires}
            onChange={e => update("horaires", e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Mentions légales (sur les documents)</Label>
          <Textarea
            placeholder="Ordonnance valable 3 mois. Médicaments réservés à l'usage vétérinaire."
            value={form.mentionsLegales}
            onChange={e => update("mentionsLegales", e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isPending || !isDirty}>
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" />Enregistrer</>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function ParametresPage() {
  const { user } = useUser();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">Gérez votre clinique et les préférences de l'application</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informations du compte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Nom</span>
              <p className="font-medium mt-1">{user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium mt-1">{user?.primaryEmailAddress?.emailAddress || "—"}</p>
            </div>
          </div>
          <Separator />
          <div className="text-sm text-muted-foreground">
            Pour modifier vos informations personnelles, utilisez votre profil Clerk.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Clinique vétérinaire
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CliniqueForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Intelligence artificielle
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-muted-foreground">L'intelligence artificielle est intégrée via Claude (Anthropic) et utilisée pour :</p>
          <ul className="space-y-1 text-muted-foreground list-disc list-inside">
            <li>Générer des diagnostics différentiels</li>
            <li>Rédiger des ordonnances automatiques</li>
            <li>Analyser les données cliniques</li>
            <li>Optimiser la gestion des stocks (JIT)</li>
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="secondary">Claude claude-sonnet-4-6</Badge>
            <span className="text-xs text-muted-foreground">connecté</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
