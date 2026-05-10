// artifacts/vetcare/src/components/ProprietaireB2BSection.tsx
// Sprint e-invoicing — Section B2B à intégrer dans le formulaire propriétaire
// Usage: importer dans le formulaire de création/édition d'un propriétaire
// et conditionner l'affichage au toggle typeClient === 'entreprise'

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Building2, User } from "lucide-react";

interface ProprietaireB2BData {
  typeClient: "particulier" | "entreprise";
  raisonSociale?: string;
  siren?: string;
  siret?: string;
  tvaIntra?: string;
  codeServiceExecutant?: string;
  paysIso2?: string;
}

interface ProprietaireB2BSectionProps {
  value: ProprietaireB2BData;
  onChange: (data: Partial<ProprietaireB2BData>) => void;
}

export function ProprietaireB2BSection({ value, onChange }: ProprietaireB2BSectionProps) {
  const isEntreprise = value.typeClient === "entreprise";

  const handleToggle = (checked: boolean) => {
    onChange({ typeClient: checked ? "entreprise" : "particulier" });
  };

  return (
    <div className="space-y-4">
      {/* Toggle Particulier / Entreprise */}
      <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
        <div className="flex items-center gap-3">
          {isEntreprise ? (
            <Building2 className="h-4 w-4 text-blue-600" />
          ) : (
            <User className="h-4 w-4 text-gray-500" />
          )}
          <div>
            <p className="text-sm font-medium leading-none">
              {isEntreprise ? "Client professionnel (B2B)" : "Client particulier (B2C)"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEntreprise
                ? "Élevage, GAEC, SAS, entreprise… Champs SIRET et TVA requis pour la facturation électronique"
                : "Propriétaire particulier — facturation B2C standard"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Particulier</span>
          <Switch checked={isEntreprise} onCheckedChange={handleToggle} />
          <span className="text-xs text-muted-foreground">Entreprise</span>
        </div>
      </div>

      {/* Champs B2B — affichés uniquement si typeClient = entreprise */}
      {isEntreprise && (
        <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">
              Informations professionnelles
            </span>
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
              Factur-X
            </Badge>
          </div>

          {/* Raison sociale */}
          <div className="space-y-1">
            <Label htmlFor="raison_sociale" className="text-xs">
              Raison sociale <span className="text-red-500">*</span>
            </Label>
            <Input
              id="raison_sociale"
              placeholder="GAEC des Pinsons, EARL Martin…"
              value={value.raisonSociale ?? ""}
              onChange={(e) => onChange({ raisonSociale: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* SIREN */}
            <div className="space-y-1">
              <Label htmlFor="siren" className="text-xs">
                SIREN (9 chiffres)
              </Label>
              <Input
                id="siren"
                placeholder="123456789"
                maxLength={9}
                value={value.siren ?? ""}
                onChange={(e) => onChange({ siren: e.target.value.replace(/\D/g, "") })}
                className="h-8 text-sm font-mono"
              />
            </div>

            {/* SIRET */}
            <div className="space-y-1">
              <Label htmlFor="siret" className="text-xs">
                SIRET (14 chiffres)
              </Label>
              <Input
                id="siret"
                placeholder="12345678900001"
                maxLength={14}
                value={value.siret ?? ""}
                onChange={(e) => onChange({ siret: e.target.value.replace(/\D/g, "") })}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          {/* TVA intracommunautaire */}
          <div className="space-y-1">
            <Label htmlFor="tva_intra" className="text-xs">
              N° TVA intracommunautaire
            </Label>
            <Input
              id="tva_intra"
              placeholder="FR12345678901"
              maxLength={13}
              value={value.tvaIntra ?? ""}
              onChange={(e) => onChange({ tvaIntra: e.target.value.toUpperCase() })}
              className="h-8 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Requis uniquement pour les échanges B2B intracommunautaires (hors France)
            </p>
          </div>

          {/* Code service executant (B2G) */}
          <div className="space-y-1">
            <Label htmlFor="code_service_executant" className="text-xs">
              Code service exécutant{" "}
              <span className="text-muted-foreground font-normal">(administration publique uniquement)</span>
            </Label>
            <Input
              id="code_service_executant"
              placeholder="Ex: DDFIP75"
              value={value.codeServiceExecutant ?? ""}
              onChange={(e) => onChange({ codeServiceExecutant: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hook utilitaire pour intégrer dans un formulaire React ─────────────────────
export function useProprietaireB2B(initialData?: Partial<ProprietaireB2BData>) {
  const [b2bData, setB2bData] = useState<ProprietaireB2BData>({
    typeClient: initialData?.typeClient ?? "particulier",
    raisonSociale: initialData?.raisonSociale ?? "",
    siren: initialData?.siren ?? "",
    siret: initialData?.siret ?? "",
    tvaIntra: initialData?.tvaIntra ?? "",
    codeServiceExecutant: initialData?.codeServiceExecutant ?? "",
    paysIso2: initialData?.paysIso2 ?? "FR",
  });

  const handleChange = (data: Partial<ProprietaireB2BData>) => {
    setB2bData((prev) => ({ ...prev, ...data }));
  };

  // Données à envoyer à l'API (strip champs vides)
  const getApiPayload = () => ({
    typeClient: b2bData.typeClient,
    ...(b2bData.typeClient === "entreprise" && {
      raisonSociale: b2bData.raisonSociale || null,
      siren: b2bData.siren || null,
      siret: b2bData.siret || null,
      tvaIntra: b2bData.tvaIntra || null,
      codeServiceExecutant: b2bData.codeServiceExecutant || null,
    }),
    paysIso2: b2bData.paysIso2 || "FR",
  });

  return { b2bData, handleChange, getApiPayload };
}
