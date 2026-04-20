import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Conditionnement {
  dose: number;
  label: string;
}

interface Molecule {
  id: string;
  nom: string;
  dciCourte: string;
  especes: ("chien" | "chat" | "nac")[];
  doses: {
    espece: "chien" | "chat" | "nac";
    min_mg_kg: number;
    max_mg_kg: number;
    frequence: string;
    duree: string;
    voie: string;
    notes?: string;
  }[];
  conditionnements: Conditionnement[];
  categorie: string;
  stupefiant?: boolean;
}

const MOLECULES: Molecule[] = [
  {
    id: "carprofen",
    nom: "Carprofène",
    dciCourte: "Carprofène",
    especes: ["chien"],
    doses: [{ espece: "chien", min_mg_kg: 4, max_mg_kg: 4, frequence: "1×/j", duree: "5–7 j", voie: "PO" }],
    conditionnements: [{ dose: 20, label: "20 mg" }, { dose: 50, label: "50 mg" }, { dose: 100, label: "100 mg" }],
    categorie: "AINS",
  },
  {
    id: "meloxicam",
    nom: "Méloxicam",
    dciCourte: "Méloxicam",
    especes: ["chien", "chat"],
    doses: [
      { espece: "chien", min_mg_kg: 0.1, max_mg_kg: 0.2, frequence: "1×/j (0.2 J1, puis 0.1)", duree: "5–7 j", voie: "PO / SC", notes: "0.2 mg/kg J1, 0.1 mg/kg J2+" },
      { espece: "chat", min_mg_kg: 0.05, max_mg_kg: 0.05, frequence: "1×/j max 3 j", duree: "≤ 3 j", voie: "SC", notes: "Usage limité chez le chat" },
    ],
    conditionnements: [{ dose: 2.5, label: "2,5 mg" }, { dose: 7.5, label: "7,5 mg" }],
    categorie: "AINS",
  },
  {
    id: "amoxicilline",
    nom: "Amoxicilline",
    dciCourte: "Amoxicilline",
    especes: ["chien", "chat"],
    doses: [
      { espece: "chien", min_mg_kg: 10, max_mg_kg: 20, frequence: "2×/j", duree: "7–14 j", voie: "PO" },
      { espece: "chat", min_mg_kg: 10, max_mg_kg: 20, frequence: "2×/j", duree: "7–14 j", voie: "PO" },
    ],
    conditionnements: [{ dose: 40, label: "40 mg" }, { dose: 200, label: "200 mg" }, { dose: 500, label: "500 mg" }],
    categorie: "Antibiotique",
  },
  {
    id: "amox-clav",
    nom: "Amoxicilline-acide clavulanique",
    dciCourte: "Amox-Clav",
    especes: ["chien", "chat"],
    doses: [
      { espece: "chien", min_mg_kg: 12.5, max_mg_kg: 12.5, frequence: "2×/j", duree: "7–14 j", voie: "PO" },
      { espece: "chat", min_mg_kg: 12.5, max_mg_kg: 12.5, frequence: "2×/j", duree: "7–14 j", voie: "PO" },
    ],
    conditionnements: [{ dose: 50, label: "50 mg" }, { dose: 200, label: "200 mg" }, { dose: 400, label: "400 mg" }],
    categorie: "Antibiotique",
  },
  {
    id: "metronidazole",
    nom: "Métronidazole",
    dciCourte: "Métronidazole",
    especes: ["chien", "chat"],
    doses: [
      { espece: "chien", min_mg_kg: 15, max_mg_kg: 25, frequence: "2×/j", duree: "5–7 j", voie: "PO" },
      { espece: "chat", min_mg_kg: 10, max_mg_kg: 15, frequence: "2×/j", duree: "5–7 j", voie: "PO" },
    ],
    conditionnements: [{ dose: 250, label: "250 mg" }, { dose: 500, label: "500 mg" }],
    categorie: "Antibiotique / Antiprotozoaire",
  },
  {
    id: "prednisolone",
    nom: "Prédnisolone",
    dciCourte: "Prédnisolone",
    especes: ["chien", "chat"],
    doses: [
      { espece: "chien", min_mg_kg: 0.5, max_mg_kg: 2, frequence: "1×/j matin", duree: "7–21 j puis dégressif", voie: "PO" },
      { espece: "chat", min_mg_kg: 1, max_mg_kg: 2, frequence: "1×/j matin", duree: "7–14 j puis dégressif", voie: "PO" },
    ],
    conditionnements: [{ dose: 5, label: "5 mg" }, { dose: 20, label: "20 mg" }],
    categorie: "Corticoïde",
  },
  {
    id: "furosemide",
    nom: "Furosémide",
    dciCourte: "Furosémide",
    especes: ["chien", "chat"],
    doses: [
      { espece: "chien", min_mg_kg: 1, max_mg_kg: 4, frequence: "2×/j", duree: "chronique", voie: "PO" },
      { espece: "chat", min_mg_kg: 1, max_mg_kg: 2, frequence: "2×/j", duree: "chronique", voie: "PO" },
    ],
    conditionnements: [{ dose: 10, label: "10 mg" }, { dose: 40, label: "40 mg" }],
    categorie: "Diurétique",
  },
  {
    id: "omeprazole",
    nom: "Oméprazole",
    dciCourte: "Oméprazole",
    especes: ["chien", "chat"],
    doses: [
      { espece: "chien", min_mg_kg: 0.7, max_mg_kg: 1, frequence: "1×/j", duree: "7–28 j", voie: "PO" },
      { espece: "chat", min_mg_kg: 0.7, max_mg_kg: 1, frequence: "1×/j", duree: "7–28 j", voie: "PO" },
    ],
    conditionnements: [{ dose: 10, label: "10 mg" }, { dose: 20, label: "20 mg" }],
    categorie: "Gastro-protecteur",
  },
  {
    id: "enrofloxacine",
    nom: "Enrofloxacine",
    dciCourte: "Enrofloxacine",
    especes: ["chien", "chat"],
    doses: [
      { espece: "chien", min_mg_kg: 5, max_mg_kg: 10, frequence: "1×/j", duree: "7–14 j", voie: "PO / SC", notes: "Antibiotique critique — usage raisonné" },
      { espece: "chat", min_mg_kg: 5, max_mg_kg: 5, frequence: "1×/j", duree: "7 j max", voie: "PO", notes: "Max 5 mg/kg chez le chat — risque rétinien" },
    ],
    conditionnements: [{ dose: 50, label: "50 mg" }, { dose: 150, label: "150 mg" }],
    categorie: "Antibiotique",
  },
  {
    id: "enalapril",
    nom: "Énalapril",
    dciCourte: "Énalapril",
    especes: ["chien", "chat"],
    doses: [
      { espece: "chien", min_mg_kg: 0.25, max_mg_kg: 0.5, frequence: "1–2×/j", duree: "chronique", voie: "PO" },
      { espece: "chat", min_mg_kg: 0.25, max_mg_kg: 0.5, frequence: "1×/j", duree: "chronique", voie: "PO" },
    ],
    conditionnements: [{ dose: 2.5, label: "2,5 mg" }, { dose: 5, label: "5 mg" }],
    categorie: "Cardio (IEC)",
  },
  {
    id: "ketamine",
    nom: "Kétamine",
    dciCourte: "Kétamine",
    especes: ["chien", "chat"],
    doses: [
      { espece: "chien", min_mg_kg: 5, max_mg_kg: 10, frequence: "dose unique IV/IM", duree: "anesthésie", voie: "IV / IM", notes: "Toujours associer à une BZD ou alpha-2" },
      { espece: "chat", min_mg_kg: 10, max_mg_kg: 20, frequence: "dose unique IV/IM", duree: "anesthésie", voie: "IV / IM", notes: "Protocole anesthésique" },
    ],
    conditionnements: [{ dose: 500, label: "500 mg/10 mL" }],
    categorie: "Anesthésique",
    stupefiant: true,
  },
];

const CATEGORIES = Array.from(new Set(MOLECULES.map(m => m.categorie))).sort();

interface DoseCalculatorProps {
  poids?: number | null;
  espece?: string | null;
}

export function DoseCalculator({ poids, espece }: DoseCalculatorProps) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string>("");
  const [poidsLocal, setPoidsLocal] = useState<string>(poids?.toString() ?? "");
  const [selectedEspece, setSelectedEspece] = useState<"chien" | "chat" | "nac">(
    (espece?.toLowerCase() === "chat" ? "chat" : espece?.toLowerCase() === "chien" ? "chien" : "chien") as any
  );

  const molecule = MOLECULES.find(m => m.id === selectedId);
  const doseConfig = molecule?.doses.find(d => d.espece === selectedEspece);
  const p = parseFloat(poidsLocal);
  const poidsOk = !isNaN(p) && p > 0;

  function calculer(mg_kg: number) {
    if (!poidsOk) return null;
    return Math.round(mg_kg * p * 10) / 10;
  }

  const doseMin = doseConfig ? calculer(doseConfig.min_mg_kg) : null;
  const doseMax = doseConfig ? calculer(doseConfig.max_mg_kg) : null;

  function tablettes(totalMg: number | null, cond: Conditionnement) {
    if (totalMg === null) return null;
    const n = totalMg / cond.dose;
    if (n < 0.25) return "< ¼ cp";
    const fractions = [0.25, 0.5, 0.75, 1];
    const rounded = Math.ceil(n * 4) / 4;
    const whole = Math.floor(rounded);
    const frac = rounded - whole;
    const fracStr = frac === 0.25 ? "¼" : frac === 0.5 ? "½" : frac === 0.75 ? "¾" : "";
    return `${whole > 0 ? whole : ""}${fracStr || ""} cp`.trim();
  }

  function buildTextResult(): string {
    if (!molecule || !doseConfig || !poidsOk) return "";
    const dose = doseMin === doseMax ? `${doseMin} mg` : `${doseMin}–${doseMax} mg`;
    const bestCond = molecule.conditionnements[Math.floor(molecule.conditionnements.length / 2)];
    const cp = tablettes(doseMax ?? doseMin, bestCond);
    return `${molecule.nom} ${doseConfig.min_mg_kg}${doseConfig.min_mg_kg !== doseConfig.max_mg_kg ? `–${doseConfig.max_mg_kg}` : ""} mg/kg × ${p} kg = ${dose}/prise — ${cp} de ${bestCond.label} ${doseConfig.frequence} pendant ${doseConfig.duree} (${doseConfig.voie})`;
  }

  function handleCopy() {
    const text = buildTextResult();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Posologie copiée dans le presse-papiers" });
    });
  }

  const filteredMolecules = selectedEspece
    ? MOLECULES.filter(m => m.especes.includes(selectedEspece))
    : MOLECULES;

  return (
    <Card className="border-dashed border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-800">
          <Calculator className="h-4 w-4" />
          Calculateur de posologie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Espèce</Label>
            <Select value={selectedEspece} onValueChange={v => { setSelectedEspece(v as any); setSelectedId(""); }}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chien">Chien</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="nac">NAC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Poids (kg)</Label>
            <Input
              className="h-8 text-xs mt-1"
              type="number"
              step="0.1"
              min="0"
              value={poidsLocal}
              onChange={e => setPoidsLocal(e.target.value)}
              placeholder={poids ? poids.toString() : "Ex: 28.5"}
            />
          </div>
          <div>
            <Label className="text-xs">Molécule</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => {
                  const mols = filteredMolecules.filter(m => m.categorie === cat);
                  if (!mols.length) return null;
                  return (
                    <div key={cat}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">{cat}</div>
                      {mols.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nom}
                          {m.stupefiant && " ⚠️"}
                        </SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {molecule && doseConfig && (
          <div className="rounded-md border border-blue-200 bg-white p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{molecule.nom}</span>
              <Badge variant="outline" className="text-xs">{doseConfig.voie}</Badge>
              <Badge variant="outline" className="text-xs">{doseConfig.frequence}</Badge>
              <Badge variant="outline" className="text-xs">{doseConfig.duree}</Badge>
              {molecule.stupefiant && <Badge variant="destructive" className="text-xs">STUPÉFIANT</Badge>}
            </div>

            {doseConfig.notes && (
              <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">⚠️ {doseConfig.notes}</p>
            )}

            {poidsOk ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-muted-foreground mb-1">Dose ({doseMin === doseMax ? doseConfig.min_mg_kg : `${doseConfig.min_mg_kg}–${doseConfig.max_mg_kg}`} mg/kg × {p} kg)</div>
                    <div className="font-bold text-blue-900 text-sm">
                      {doseMin === doseMax ? `${doseMin} mg` : `${doseMin}–${doseMax} mg`}
                      <span className="text-xs font-normal text-muted-foreground"> / prise</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {molecule.conditionnements.map(cond => (
                      <div key={cond.dose} className="flex justify-between text-xs bg-gray-50 rounded px-2 py-1">
                        <span className="text-muted-foreground">{cond.label}</span>
                        <span className="font-medium">
                          {doseMin === doseMax
                            ? tablettes(doseMin, cond)
                            : `${tablettes(doseMin, cond)} – ${tablettes(doseMax, cond)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={handleCopy}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copier la posologie calculée
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">Saisissez le poids pour calculer la dose</p>
            )}
          </div>
        )}

        {!molecule && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Sélectionnez une molécule pour calculer la posologie automatiquement
          </p>
        )}
      </CardContent>
    </Card>
  );
}
